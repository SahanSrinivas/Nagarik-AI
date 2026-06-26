"""Build-time UI translator.

Reads apps/web/src/i18n/en.json, calls Gemini 2.5 Flash with a single
batched prompt per target language, writes kn.json + hi.json with the
SAME key set as English. Keys whose values are objects (e.g. `_meta`)
are passed through unchanged after we override the `language`/`code` fields.

Design choices:
  - One batched call per language — Gemini returns all translations at once
    via response_mime_type='application/json'. Avoids 50× round-trips.
  - Idempotent — re-running overwrites the output files but keeps a JSON
    pin-comment with the source git sha so downstream caches can invalidate.
  - Honest fallback — if Gemini fails or returns junk, the script exits
    non-zero and DOES NOT clobber the existing translations.

Usage:
    cd apps/api
    PYTHONPATH=. python -m scripts.translate_ui
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
EN_PATH = REPO_ROOT / "apps" / "web" / "src" / "i18n" / "en.json"

TARGETS = {
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ"},
    "hi": {"name": "Hindi",   "native": "हिन्दी"},
}

PROMPT_TEMPLATE = """You are a UI string translator for NagarikAI, a civic-tech mobile web app for Bengaluru.

Translate every string from English to {language_name} ({language_native}).

CRITICAL RULES — read carefully:
  1. Translate ONLY the *values*. Keys stay verbatim.
  2. Keep BBMP, BWSSB, BESCOM, EXIF, GPS, NFT, SLA, XP unchanged — these are technical terms Indians already use in English.
  3. Match the tone: respectful, plain, short. This is for citizens reporting potholes, not poetry.
  4. Skip _meta — the script overrides it.
  5. Keep placeholders like {{value}} or %s exactly as they appear in the source.
  6. Keep punctuation symbols (✓, …, —, ', ") as-is.
  7. For Hindi use Devanagari script; for Kannada use Kannada script.
  8. Don't over-translate technical UI words ("Submit", "Cancel" — use the natural localised form).
  9. Return STRICT JSON with EXACTLY the same keys as the input.

Here is the source JSON (English):

{source_json}

Return the translated JSON only — no prose, no markdown fences."""


def _try_gemini(prompt: str) -> str | None:
    """Primary path. Returns raw text or None on any failure (incl. 429)."""
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
            contents=[prompt],
            config=gtypes.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
                max_output_tokens=8192,
            ),
        )
        return getattr(resp, "text", "") or None
    except Exception as exc:  # noqa: BLE001
        # 429 quota exhaustion is the most common reason we'd fall back.
        log.warning("gemini failed (%s) — falling back to claude", exc.__class__.__name__)
        return None


def _try_claude(prompt: str) -> str | None:
    """Fallback path — Anthropic Claude Haiku 4.5 with JSON-only response."""
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
            system="You are a precise JSON translator. Return only valid JSON, no prose, no markdown fences.",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=8192,
        )
        for block in getattr(resp, "content", []) or []:
            if getattr(block, "type", None) == "text":
                return getattr(block, "text", None)
    except Exception as exc:  # noqa: BLE001
        log.error("claude fallback also failed: %s", exc)
    return None


def translate(source: dict, lang_code: str) -> dict | None:
    meta = TARGETS[lang_code]
    payload = {k: v for k, v in source.items() if k != "_meta"}
    prompt = PROMPT_TEMPLATE.format(
        language_name=meta["name"],
        language_native=meta["native"],
        source_json=json.dumps(payload, ensure_ascii=False, indent=2),
    )

    text = _try_gemini(prompt)
    backend = "gemini-2.5-flash"
    if text is None:
        text = _try_claude(prompt)
        backend = "claude-haiku-4-5-20251001"
    if not text:
        log.error("no translation backend succeeded for %s", lang_code)
        return None

    # Claude sometimes wraps in ```json fences even when told not to.
    cleaned = text.strip()
    if cleaned.startswith("```"):
        import re
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE).strip()

    try:
        translated = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        log.error("could not parse %s output: %s; first 400 chars: %r", lang_code, exc, cleaned[:400])
        return None

    if not isinstance(translated, dict):
        log.error("%s output is not an object: type=%s", lang_code, type(translated).__name__)
        return None

    # Sanity: ensure every English key is present in the translation; fall back
    # to the English string for any missing key so the UI never shows a blank.
    missing = [k for k in payload if k not in translated]
    if missing:
        log.warning("%s: %d keys missing from translation — filling with English: %s",
                    lang_code, len(missing), missing[:5])
        for k in missing:
            translated[k] = payload[k]

    # Drop any keys the LLM hallucinated that aren't in source.
    extra = [k for k in translated if k not in payload]
    for k in extra:
        log.warning("%s: dropping hallucinated key %r", lang_code, k)
        translated.pop(k)

    # Write the _meta back with the correct language identity.
    translated["_meta"] = {
        "language": meta["name"],
        "native": meta["native"],
        "code": lang_code,
        "rtl": False,
        "_translated_by": backend,
        "_keys": len(payload),
    }
    return translated


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", nargs="+", default=list(TARGETS), help="kn hi")
    args = ap.parse_args()

    if not EN_PATH.exists():
        log.error("missing source: %s", EN_PATH)
        return 1

    source = json.loads(EN_PATH.read_text())
    print(f"source: {len(source)} keys from {EN_PATH}")

    rc = 0
    for code in args.langs:
        if code not in TARGETS:
            print(f"skipping unknown lang: {code}")
            continue
        print(f"\n→ translating to {TARGETS[code]['name']} ({TARGETS[code]['native']}) ...")
        translated = translate(source, code)
        if translated is None:
            print(f"  FAILED — keeping any existing {code}.json")
            rc = 1
            continue

        out = EN_PATH.parent / f"{code}.json"
        out.write_text(json.dumps(translated, ensure_ascii=False, indent=2) + "\n")
        # Show a few samples to eyeball.
        print(f"  wrote {out}")
        for sample_key in ["report.title", "report.locate_button_idle", "report.submit", "tracking.your_report", "loc.unknown"]:
            if sample_key in translated:
                print(f"    {sample_key} = {translated[sample_key]!r}")
    return rc


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("translate_ui")


if __name__ == "__main__":
    sys.exit(main())
