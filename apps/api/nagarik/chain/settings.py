"""Chain settings — pulled from env, opt-in by default."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class ChainSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Master switch — when False, all chain clients no-op.
    chain_enabled: bool = False

    # Polygon Amoy testnet defaults (free, fast, MATIC faucet at faucet.polygon.technology).
    chain_rpc_url: str = "https://rpc-amoy.polygon.technology"
    chain_id: int = 80002

    # Server-side custody wallet — funds gas for both anchor + badge mints.
    # Keep it small (a few testnet MATIC).
    chain_signer_pk: str = ""           # hex, no 0x prefix
    chain_signer_address: str = ""

    # Contract addresses — deploy via `python -m nagarik.chain.deploy`.
    anchor_contract: str = ""
    badge_contract: str = ""

    # Anchoring cadence — flush a Merkle root every N events.
    anchor_batch_size: int = 50


@lru_cache
def get_chain_settings() -> ChainSettings:
    return ChainSettings()
