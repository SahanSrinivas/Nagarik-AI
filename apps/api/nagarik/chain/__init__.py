"""On-chain transparency layer.

Two pieces, both optional (toggle via env):

  1. AnchorClient — hashes batches of AgentEvents and writes the Merkle root
     to a registry contract on Polygon Amoy testnet. Anyone can verify a past
     decision by recomputing the hash and checking inclusion.

  2. BadgeClient — mints non-transferable (soulbound) ERC-721 NFTs to
     citizens who cross XP milestones. Wallet-less: we custody on behalf of
     the phone-number identity until they claim.

Both clients no-op gracefully when CHAIN_ENABLED is unset, so the rest of
the platform runs identically with or without blockchain.
"""
