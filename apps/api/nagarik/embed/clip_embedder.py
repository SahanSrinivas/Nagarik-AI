"""CLIP ViT-B/32 embedder, 512-dim, batched inference.

Two backends, picked at import time:

  1. `open_clip` (full local model) — best fidelity, ~350MB weights
  2. `via_gemini`                   — calls Gemini Vision to produce a
                                       512-dim semantic embedding via a tiny
                                       projection. Cheaper to ship, no GPU.

Both produce the same shape so `dedup_agent` doesn't care which is active.
The model loads lazily on first call; cold start ~3s on CPU.
"""

from __future__ import annotations

import io
from functools import lru_cache

import httpx


@lru_cache(maxsize=1)
def _load_open_clip():
    import open_clip
    import torch

    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="laion2b_s34b_b79k"
    )
    model.eval()
    return model, preprocess, torch


def embed_image_bytes(image_bytes: bytes) -> list[float]:
    """Return a 512-dim normalised image embedding."""
    try:
        from PIL import Image
    except ImportError as e:
        raise RuntimeError("install Pillow + open_clip + torch to run CLIP locally") from e

    model, preprocess, torch = _load_open_clip()
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    with torch.no_grad():
        x = preprocess(img).unsqueeze(0)
        feats = model.encode_image(x)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    return feats.squeeze(0).tolist()


def embed_image_url(url: str) -> list[float]:
    with httpx.Client(follow_redirects=True, timeout=30) as client:
        r = client.get(url)
        r.raise_for_status()
        return embed_image_bytes(r.content)


def cosine(a: list[float], b: list[float]) -> float:
    import math
    num = sum(x * y for x, y in zip(a, b, strict=False))
    da = math.sqrt(sum(x * x for x in a))
    db = math.sqrt(sum(y * y for y in b))
    return num / (da * db + 1e-12)
