"""One-shot deploy script for AuditAnchor + CivicBadge.

Requires py-solc-x + web3 + a funded signer on Polygon Amoy testnet
(get free MATIC at faucet.polygon.technology).

Usage:
    python -m nagarik.chain.deploy
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from nagarik.chain.settings import get_chain_settings


def main() -> int:
    cs = get_chain_settings()
    if not cs.chain_enabled:
        print("CHAIN_ENABLED is false — set it in .env before deploying.")
        return 1
    if not cs.chain_signer_pk:
        print("CHAIN_SIGNER_PK is empty — set it (no 0x prefix).")
        return 1

    try:
        from solcx import compile_source, install_solc
        from web3 import Web3
        from eth_account import Account
    except ImportError:
        print("install web3 py-solc-x eth-account to deploy: pip install web3 py-solc-x eth-account")
        return 1

    install_solc("0.8.24")

    contracts_dir = Path(__file__).parent / "contracts"
    artifacts: dict[str, dict] = {}
    for sol in ("AuditAnchor.sol", "CivicBadge.sol"):
        src = (contracts_dir / sol).read_text()
        compiled = compile_source(src, solc_version="0.8.24", output_values=["abi", "bin"])
        # compile_source returns keys like "<stdin>:CivicBadge"
        ((name, artifact),) = list(compiled.items())
        artifacts[sol[:-4]] = artifact

    w3 = Web3(Web3.HTTPProvider(cs.chain_rpc_url))
    acct = Account.from_key(cs.chain_signer_pk)
    print(f"signer: {acct.address}")
    print(f"balance: {w3.from_wei(w3.eth.get_balance(acct.address), 'ether')} MATIC")

    deployed: dict[str, str] = {}
    nonce = w3.eth.get_transaction_count(acct.address)
    for name, art in artifacts.items():
        contract = w3.eth.contract(abi=art["abi"], bytecode=art["bin"])
        tx = contract.constructor(acct.address).build_transaction(
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
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        deployed[name] = receipt["contractAddress"]
        nonce += 1
        print(f"{name} deployed: {receipt['contractAddress']} (gas {receipt['gasUsed']:,})")

    out = Path("chain_addresses.json")
    out.write_text(json.dumps(deployed, indent=2))
    print(f"\nwrote {out} — copy these into .env as ANCHOR_CONTRACT / BADGE_CONTRACT")
    return 0


if __name__ == "__main__":
    sys.exit(main())
