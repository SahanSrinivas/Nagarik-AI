"""AnchorClient — batches AgentEvent hashes and writes Merkle roots to chain.

Lazy-imports web3 so the rest of the app starts without crypto deps installed.
When CHAIN_ENABLED is False (the default), every call is a no-op that just
returns the local hash — perfect for development.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from nagarik.chain.merkle import leaf_hash, merkle_root
from nagarik.chain.settings import get_chain_settings


@dataclass(slots=True)
class AnchorResult:
    enabled: bool
    root_hex: str
    batch_id: int | None = None
    tx_hash: str | None = None


def _canonical(event: dict) -> bytes:
    """Stable byte representation of an AgentEvent for hashing.

    Keys are sorted; floats are serialized with full precision. Whatever
    we hash here must be reproducible by any external auditor.
    """
    return json.dumps(event, sort_keys=True, separators=(",", ":")).encode()


def event_leaf(event: dict) -> bytes:
    return leaf_hash(_canonical(event))


def anchor_batch(events: list[dict]) -> AnchorResult:
    leaves = [_canonical(e) for e in events]
    root = merkle_root(leaves)
    root_hex = "0x" + root.hex()

    cs = get_chain_settings()
    if not cs.chain_enabled or not cs.anchor_contract or not cs.chain_signer_pk:
        return AnchorResult(enabled=False, root_hex=root_hex)

    # Real path — only loaded when blockchain is opted in.
    from web3 import Web3
    from eth_account import Account

    w3 = Web3(Web3.HTTPProvider(cs.chain_rpc_url))
    acct = Account.from_key(cs.chain_signer_pk)

    abi = [
        {
            "inputs": [
                {"name": "root", "type": "bytes32"},
                {"name": "leafCount", "type": "uint64"},
            ],
            "name": "anchor",
            "outputs": [{"name": "batchId", "type": "uint256"}],
            "stateMutability": "nonpayable",
            "type": "function",
        }
    ]
    contract = w3.eth.contract(address=Web3.to_checksum_address(cs.anchor_contract), abi=abi)

    nonce = w3.eth.get_transaction_count(acct.address)
    tx = contract.functions.anchor(root, len(leaves)).build_transaction(
        {
            "from": acct.address,
            "nonce": nonce,
            "gasPrice": w3.eth.gas_price,
            "chainId": cs.chain_id,
        }
    )
    tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.2)
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    batch_id = None
    for log in receipt["logs"]:
        # Parse RootAnchored event to recover batchId (topic[1]).
        if len(log["topics"]) >= 2:
            try:
                batch_id = int(log["topics"][1].hex(), 16)
                break
            except (TypeError, ValueError):
                continue

    return AnchorResult(
        enabled=True, root_hex=root_hex, batch_id=batch_id, tx_hash=tx_hash.hex()
    )
