"""Runtime string translator — used to localise notification title/body at
read-time on /tracking. Build-time `scripts/translate_ui.py` covers the
static UI strings; this module covers dynamic content that only exists
once an agent has fired (e.g. "Routed to BBMP Roads · SLA by Sat 18:00").

Design:
  - Primary: Gemini 2.5 Flash (low temp, JSON-only, batch up to 16 strings/call)
  - Fallback: Claude Haiku 4.5 on Gemini failure (mid-demo 429 safety net)
  - LRU cache keyed by (text, lang) — every notification template gets
    translated once, then served from RAM forever
  - English in / English out is a no-op (skips the LLM entirely)
  - On any failure we return the source string — the citizen sees English,
    never a blank or an error. /tracking should not break because of a
    flaky translator.

Cost: with 8 notification templates × 3 languages = ~24 unique strings,
after the first 24 hits the cache is fully warm and steady-state is zero
LLM calls regardless of traffic.
"""

from __future__ import annotations

import json
import logging
import os
import re
from functools import lru_cache
from threading import Lock

log = logging.getLogger(__name__)

SUPPORTED = {"en", "hi", "kn"}
LANG_NAMES = {"hi": "Hindi (हिन्दी, Devanagari script)", "kn": "Kannada (ಕನ್ನಡ script)"}

_BATCH_SYSTEM = """You are a precise UI string translator for NagarikAI, a Bengaluru civic-tech app.

Translate the provided array of English strings to {lang_name}.

CRITICAL RULES:
 1. Preserve BBMP, BWSSB, BESCOM, EXIF, GPS, NFT, SLA, XP, IST verbatim.
 2. Preserve numeric values, dates, IDs, and short codes (e.g. "Crew 2a7f8c", "+5 XP").
 3. Match plain civic-help tone — short, respectful, no flourish.
 4. Return STRICT JSON: an array of translated strings, same length, same order as input.
 5. No prose, no markdown, no explanations."""


# --- Cache ----------------------------------------------------------------

_CACHE: dict[tuple[str, str], str] = {}
_CACHE_LOCK = Lock()
_CACHE_MAX = 1024


def _cache_get(text: str, lang: str) -> str | None:
    return _CACHE.get((text, lang))


def _cache_set(text: str, lang: str, translated: str) -> None:
    with _CACHE_LOCK:
        if len(_CACHE) >= _CACHE_MAX:
            # Drop the oldest 128 entries (FIFO-ish; we don't track insertion
            # order strictly, but this caps memory cheaply).
            for k in list(_CACHE.keys())[:128]:
                _CACHE.pop(k, None)
        _CACHE[(text, lang)] = translated


# --- LLM backends ---------------------------------------------------------

def _gemini_batch(texts: list[str], lang_name: str) -> list[str] | None:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        from google.genai import types as gtypes
    except ImportError:
        return None
    try:
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                _BATCH_SYSTEM.format(lang_name=lang_name)
                + "\n\nINPUT:\n"
                + json.dumps(texts, ensure_ascii=False)
            ],
            config=gtypes.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
                max_output_tokens=2048,
            ),
        )
        text = getattr(resp, "text", "") or ""
        return _parse_array(text, len(texts))
    except Exception as exc:  # noqa: BLE001
        log.warning("i18n_runtime gemini failed: %s", exc.__class__.__name__)
        return None


def _claude_batch(texts: list[str], lang_name: str) -> list[str] | None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        from anthropic import Anthropic
    except ImportError:
        return None
    try:
        client = Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            system=_BATCH_SYSTEM.format(lang_name=lang_name),
            messages=[{"role": "user", "content": "INPUT:\n" + json.dumps(texts, ensure_ascii=False)}],
            temperature=0.0,
            max_tokens=2048,
        )
        for block in getattr(resp, "content", []) or []:
            if getattr(block, "type", None) == "text":
                return _parse_array(getattr(block, "text", "") or "", len(texts))
    except Exception as exc:  # noqa: BLE001
        log.warning("i18n_runtime claude failed: %s", exc.__class__.__name__)
    return None


def _parse_array(text: str, expected_len: int) -> list[str] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE).strip()
    try:
        arr = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    if not isinstance(arr, list) or len(arr) != expected_len:
        return None
    return [str(x) for x in arr]


# --- Public API -----------------------------------------------------------

def translate(text: str, lang: str) -> str:
    """Translate ONE string. Never raises; returns the source on any failure."""
    if not text or lang == "en" or lang not in SUPPORTED:
        return text

    cached = _cache_get(text, lang)
    if cached is not None:
        return cached

    out = translate_many([text], lang)
    return out[0]


def translate_many(texts: list[str], lang: str) -> list[str]:
    """Translate many strings in one LLM call (cheaper). Cached per text."""
    if lang == "en" or lang not in SUPPORTED or not texts:
        return list(texts)

    # Partition: hits from cache, misses fetched in one batch.
    misses_idx: list[int] = []
    misses_texts: list[str] = []
    out: list[str] = [""] * len(texts)

    for i, t in enumerate(texts):
        if not t:
            out[i] = t
            continue
        cached = _cache_get(t, lang)
        if cached is not None:
            out[i] = cached
        else:
            misses_idx.append(i)
            misses_texts.append(t)

    if not misses_texts:
        return out

    lang_name = LANG_NAMES.get(lang, lang)
    translated = _gemini_batch(misses_texts, lang_name)
    if translated is None:
        translated = _claude_batch(misses_texts, lang_name)
    if translated is None:
        # Both backends failed — return source for the misses, log once.
        log.warning("i18n_runtime: no backend available for lang=%s", lang)
        for idx, src in zip(misses_idx, misses_texts, strict=False):
            out[idx] = src
        return out

    for idx, src, dst in zip(misses_idx, misses_texts, translated, strict=False):
        _cache_set(src, lang, dst)
        out[idx] = dst
    return out


def cache_stats() -> dict:
    """For ops introspection."""
    by_lang: dict[str, int] = {}
    for _, lang in _CACHE:
        by_lang[lang] = by_lang.get(lang, 0) + 1
    return {"size": len(_CACHE), "max": _CACHE_MAX, "by_lang": by_lang}
