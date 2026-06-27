"""Gemini Embedding (Vertex AI hosted) — text embeddings for dedup.

The DedupAgent already does a PostGIS radius check + optional CLIP image
cosine. This module adds a third, cheaper, language-aware signal: it
takes the post-Vision description (type + Gemini notes + focus_label)
and projects it to a 3072-dim semantic vector via Google's
`gemini-embedding-001` model (served from Vertex AI). Cosine on these
vectors catches "same issue, different photo angle" cases that CLIP
misses because the pixels diverge but the semantic content is identical.

Uses the same google-genai SDK + GOOGLE_API_KEY already wired up for the
Vision agent, so there are no new GCP credentials to manage. Calls are
LRU-cached so re-evaluating the same description (common when an agent
re-runs) is free after the first hit.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from nagarik.settings import get_settings

log = logging.getLogger(__name__)

_MODEL = "gemini-embedding-001"


@lru_cache(maxsize=1024)
def embed_text(text: str) -> tuple[float, ...]:
    """Return a normalised embedding from gemini-embedding-001.

    Returns an empty tuple on any failure path (missing API key, network
    error, unexpected response shape) so the caller can decide whether to
    fall back. Cached as a tuple (lru_cache requires hashable return).
    """
    text = (text or "").strip()
    if not text:
        return ()

    settings = get_settings()
    if not settings.google_api_key:
        return ()

    try:
        from google import genai
        # Hard 6s timeout — the dedup agent calls this in a tight loop
        # and a slow Vertex response must NEVER block the downstream
        # Triage agent. Past dedup outage taught us the hard way.
        client = genai.Client(
            api_key=settings.google_api_key,
            http_options={"timeout": 6_000},  # milliseconds
        )
        resp = client.models.embed_content(
            model=_MODEL,
            contents=text,
        )
        embs = getattr(resp, "embeddings", None)
        if embs and len(embs) > 0:
            vec = getattr(embs[0], "values", None) or []
            return tuple(float(v) for v in vec)
    except Exception as exc:  # noqa: BLE001
        log.warning("gemini_embedder: embed_text failed: %s", exc)
    return ()


def cosine(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    """Cosine similarity of two vectors. Returns 0 when either side is empty."""
    if not a or not b or len(a) != len(b):
        return 0.0
    import math
    num = sum(x * y for x, y in zip(a, b, strict=True))
    da = math.sqrt(sum(x * x for x in a))
    db = math.sqrt(sum(y * y for y in b))
    return num / (da * db + 1e-12)
