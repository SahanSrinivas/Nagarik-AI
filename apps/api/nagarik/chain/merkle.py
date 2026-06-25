"""Tiny Merkle tree — used to anchor batches of AgentEvents in one tx.

We use SHA-256 (cheap) and standard pair-hashing with right-child duplication
for odd-length levels — the simplest implementation that any verifier (a CA
auditing transparency, a journalist, a curious citizen) can re-implement
without a library.
"""

from __future__ import annotations

import hashlib


def _h(b: bytes) -> bytes:
    return hashlib.sha256(b).digest()


def leaf_hash(payload: bytes) -> bytes:
    return _h(b"\x00" + payload)


def _pair(a: bytes, b: bytes) -> bytes:
    # Domain-separate internal nodes from leaves.
    return _h(b"\x01" + a + b)


def merkle_root(leaves: list[bytes]) -> bytes:
    if not leaves:
        return b"\x00" * 32
    layer = [leaf_hash(l) for l in leaves]
    while len(layer) > 1:
        if len(layer) % 2 == 1:
            layer.append(layer[-1])
        layer = [_pair(layer[i], layer[i + 1]) for i in range(0, len(layer), 2)]
    return layer[0]


def merkle_proof(leaves: list[bytes], index: int) -> list[bytes]:
    """Authentication path for the leaf at `index`."""
    proof: list[bytes] = []
    layer = [leaf_hash(l) for l in leaves]
    idx = index
    while len(layer) > 1:
        if len(layer) % 2 == 1:
            layer.append(layer[-1])
        sibling = idx ^ 1
        proof.append(layer[sibling])
        layer = [_pair(layer[i], layer[i + 1]) for i in range(0, len(layer), 2)]
        idx //= 2
    return proof


def verify(leaf: bytes, proof: list[bytes], index: int, root: bytes) -> bool:
    h = leaf_hash(leaf)
    for sib in proof:
        h = _pair(h, sib) if index % 2 == 0 else _pair(sib, h)
        index //= 2
    return h == root
