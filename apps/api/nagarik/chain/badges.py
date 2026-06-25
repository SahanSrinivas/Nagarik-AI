"""BadgeClient — mint soulbound NFT badges at XP milestones.

Citizens start without a wallet; we custody on their behalf using a
deterministic address derived from their phone number + a server secret.
When they later claim, we'd implement key migration — out of scope for the
hackathon, but architecturally clean.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass

from nagarik.chain.settings import get_chain_settings

# (xp_threshold, tier_name, image_url)
MILESTONES: list[tuple[int, str, str]] = [
    (100,  "Reporter",  "ipfs://bafy.../reporter.png"),
    (250,  "Verifier",  "ipfs://bafy.../verifier.png"),
    (500,  "Watchdog",  "ipfs://bafy.../watchdog.png"),
    (1000, "Sentinel",  "ipfs://bafy.../sentinel.png"),
    (2500, "Civic Hero", "ipfs://bafy.../hero.png"),
]


@dataclass(slots=True)
class MintResult:
    enabled: bool
    tier: str
    wallet: str | None = None
    token_id: int | None = None
    tx_hash: str | None = None


def derive_wallet(phone: str, secret: str) -> str:
    """Deterministic placeholder address from phone — replaced by real key
    management when we add a non-custodial flow. Kept stable so the same
    phone always gets the same wallet across deploys.
    """
    digest = hmac.new(secret.encode(), phone.encode(), hashlib.sha256).digest()
    return "0x" + digest[:20].hex()


def tier_for_xp(xp: int) -> tuple[int, str, str] | None:
    eligible = [m for m in MILESTONES if xp >= m[0]]
    return eligible[-1] if eligible else None


def _token_uri(phone: str, tier: str, xp: int, image: str) -> str:
    body = {
        "name": f"NagarikAI {tier}",
        "description": f"Civic contribution badge earned at {xp} XP. Soulbound — non-transferable.",
        "image": image,
        "attributes": [
            {"trait_type": "tier", "value": tier},
            {"trait_type": "xp_at_mint", "value": xp},
            {"trait_type": "platform", "value": "NagarikAI"},
        ],
    }
    # Inline data URI keeps the demo dependency-free; production would upload to IPFS.
    return "data:application/json;base64," + _b64(json.dumps(body, separators=(",", ":")))


def _b64(s: str) -> str:
    import base64
    return base64.b64encode(s.encode()).decode()


def mint_for(phone: str, xp: int) -> MintResult:
    milestone = tier_for_xp(xp)
    if milestone is None:
        return MintResult(enabled=False, tier="none")

    threshold, tier, image = milestone
    cs = get_chain_settings()

    if not cs.chain_enabled or not cs.badge_contract or not cs.chain_signer_pk:
        # Off-chain shadow mode — still returns the wallet so /impact can show pending badges.
        wallet = derive_wallet(phone, cs.chain_signer_pk or "demo-secret")
        return MintResult(enabled=False, tier=tier, wallet=wallet)

    from web3 import Web3
    from eth_account import Account

    w3 = Web3(Web3.HTTPProvider(cs.chain_rpc_url))
    acct = Account.from_key(cs.chain_signer_pk)
    wallet = derive_wallet(phone, cs.chain_signer_pk)
    uri = _token_uri(phone, tier, xp, image)

    abi = [
        {
            "inputs": [
                {"name": "citizen", "type": "address"},
                {"name": "tokenURI_", "type": "string"},
                {"name": "tier", "type": "string"},
            ],
            "name": "mint",
            "outputs": [{"name": "tokenId", "type": "uint256"}],
            "stateMutability": "nonpayable",
            "type": "function",
        }
    ]
    contract = w3.eth.contract(address=Web3.to_checksum_address(cs.badge_contract), abi=abi)
    nonce = w3.eth.get_transaction_count(acct.address)
    tx = contract.functions.mint(Web3.to_checksum_address(wallet), uri, tier).build_transaction(
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

    token_id = None
    for log in receipt["logs"]:
        if len(log["topics"]) >= 3 and log["topics"][0].hex().startswith("0x"):
            try:
                token_id = int(log["topics"][3].hex(), 16)
                break
            except (TypeError, ValueError, IndexError):
                continue

    return MintResult(
        enabled=True, tier=tier, wallet=wallet, token_id=token_id, tx_hash=tx_hash.hex()
    )
