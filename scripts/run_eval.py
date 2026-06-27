"""Phase 2 — run the Vision agent (Gemini 2.5 Flash + hardened prompt)
against every image in data/eval/dataset.jsonl. Writes predictions to
data/eval/predictions.jsonl, resumable.

Doesn't touch the prod DB. Uses the exact PROMPT + guardrail logic from
nagarik/agents/vision_agent.py so the scores reflect what citizens get.

Concurrency: ThreadPoolExecutor with 20 workers (Gemini's free tier
default is 60 RPM, paid is 1000+ — adjust GEMINI_RPM_LIMIT if rate-limited).

Run:
    GOOGLE_API_KEY=... python scripts/run_eval.py [--limit N] [--workers 20]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

import httpx

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "data" / "eval" / "dataset.jsonl"
LOCAL_MANIFEST = ROOT / "data" / "eval" / "dataset_local.jsonl"
PREDICTIONS = ROOT / "data" / "eval" / "predictions.jsonl"

# Import the SAME prompt + constants the production agent uses so scores
# reflect what citizens actually get. We don't import vision_agent itself
# because it pulls SQLAlchemy / models and bursts the cold-start budget.
sys.path.insert(0, str(ROOT / "apps" / "api"))
from nagarik.agents.vision_agent import (  # noqa: E402
    ALLOWED_TYPES,
    CIVIC_TYPES,
    MIN_CIVIC_CONFIDENCE,
    PROMPT,
    _GEMINI_ALLOWED_MIMES,
)


def _fetch_image(url: str) -> tuple[bytes, str]:
    """Same fetch + MIME-normalisation as the production agent.

    Wikimedia Commons enforces a strict User-Agent policy — strings without
    a contact URL get 403'd. The format below complies with their guidance
    (project URL + email-style contact).
    """
    ua = "NagarikAI-Eval/0.1 (https://nagarikai.xyz; ops@nagarikai.xyz) httpx"
    with httpx.Client(follow_redirects=True, timeout=30) as client:
        r = client.get(url, headers={"User-Agent": ua, "Accept": "image/*"})
        r.raise_for_status()
        mime = r.headers.get("content-type", "image/jpeg").split(";")[0].strip().lower()
        if mime not in _GEMINI_ALLOWED_MIMES:
            try:
                import io
                from PIL import Image
                img = Image.open(io.BytesIO(r.content)).convert("RGB")
                buf = io.BytesIO()
                img.save(buf, "JPEG", quality=88)
                return buf.getvalue(), "image/jpeg"
            except Exception as exc:  # noqa: BLE001
                raise ValueError(f"unsupported MIME {mime!r}: {exc}") from exc
        return r.content, mime


def _parse_json(text: str) -> dict | None:
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not m:
            return None
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return None


def _load_local(path: Path) -> tuple[bytes, str]:
    """Read pre-downloaded image bytes + infer MIME from extension."""
    mime_by_ext = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif",
    }
    mime = mime_by_ext.get(path.suffix.lower(), "image/jpeg")
    if mime not in _GEMINI_ALLOWED_MIMES:
        import io
        from PIL import Image
        img = Image.open(path).convert("RGB")
        buf = io.BytesIO(); img.save(buf, "JPEG", quality=88)
        return buf.getvalue(), "image/jpeg"
    return path.read_bytes(), mime


def classify(client, row: dict) -> dict:
    """Same logic flow as vision_agent.run_vision, no DB writes.

    Prefers a pre-downloaded file (row['local_path']) when present so the
    eval doesn't re-hit Wikipedia's rate-limited thumb server.
    """
    from google.genai import types as gtypes
    try:
        if row.get("local_path"):
            image_bytes, mime = _load_local(ROOT / row["local_path"])
        else:
            image_bytes, mime = _fetch_image(row["url"])
    except Exception as exc:  # noqa: BLE001
        return {"rejected": True, "rejection_reason": f"image fetch failed: {exc.__class__.__name__}",
                "type": "other", "confidence": 0.0, "is_civic_issue": False}
    parts = [gtypes.Part.from_bytes(data=image_bytes, mime_type=mime)]
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[*parts, PROMPT],
            config=gtypes.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
                thinking_config=gtypes.ThinkingConfig(thinking_budget=0),
                max_output_tokens=800,
            ),
        )
        text = getattr(resp, "text", "") or ""
    except Exception as exc:  # noqa: BLE001
        return {"rejected": True, "rejection_reason": f"gemini error: {exc.__class__.__name__}",
                "type": "other", "confidence": 0.0, "is_civic_issue": False}
    parsed = _parse_json(text)
    if not parsed:
        return {"rejected": True, "rejection_reason": "parse failure",
                "type": "other", "confidence": 0.0, "is_civic_issue": False}
    raw_type = str(parsed.get("type", "other")).lower().strip()
    classified = raw_type if raw_type in ALLOWED_TYPES else "other"
    try:
        confidence = max(0.0, min(1.0, float(parsed.get("confidence", 0.5))))
    except (TypeError, ValueError):
        confidence = 0.5
    is_civic = bool(parsed.get("is_civic_issue", classified in CIVIC_TYPES))
    is_indoor = bool(parsed.get("indoor", False))
    refusal = str(parsed.get("refusal_reason", "")).strip()
    rejected = (not is_civic) or is_indoor or classified == "other" or confidence < MIN_CIVIC_CONFIDENCE
    return {
        "rejected": rejected,
        "rejection_reason": refusal if rejected else "",
        "type": classified,
        "confidence": confidence,
        "is_civic_issue": is_civic,
        "indoor": is_indoor,
        "raw": parsed,
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=None, help="cap total images")
    p.add_argument("--workers", type=int, default=20, help="concurrent Gemini calls")
    args = p.parse_args()

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        # Fall back to Secret Manager (same one prod uses)
        try:
            import subprocess
            api_key = subprocess.check_output(
                ["gcloud", "secrets", "versions", "access", "latest",
                 "--secret=GOOGLE_API_KEY", "--project=nagarikai-demo"],
                text=True
            ).strip()
            print("(GOOGLE_API_KEY loaded from Secret Manager)")
        except Exception as exc:  # noqa: BLE001
            sys.exit(f"GOOGLE_API_KEY not set and Secret Manager fetch failed: {exc}")

    # Resume support — skip already-predicted IDs
    done_ids: set[str] = set()
    if PREDICTIONS.exists():
        with PREDICTIONS.open() as fp:
            for line in fp:
                try:
                    done_ids.add(json.loads(line)["id"])
                except (json.JSONDecodeError, KeyError):
                    pass
        print(f"Resuming — {len(done_ids)} predictions already on disk")

    # Load dataset — prefer the local manifest (pre-downloaded bytes) if it exists.
    src = LOCAL_MANIFEST if LOCAL_MANIFEST.exists() else DATASET
    print(f"Source manifest: {src.relative_to(ROOT)}")
    rows = [json.loads(l) for l in src.read_text().splitlines() if l.strip()]
    pending = [r for r in rows if r["id"] not in done_ids]
    if args.limit:
        pending = pending[: args.limit]
    print(f"To classify: {len(pending)} (skipping {len(done_ids)} already done)")
    print(f"Workers: {args.workers}\n")

    from google import genai
    client = genai.Client(api_key=api_key)

    write_lock = Lock()
    fp_out = PREDICTIONS.open("a", buffering=1)
    counter = {"n": 0, "ok": 0, "fail": 0, "t0": time.time()}

    def _classify_one(row: dict) -> None:
        result = classify(client, row)
        rec = {**row, **{f"pred_{k}": v for k, v in result.items() if k != "raw"}}
        with write_lock:
            fp_out.write(json.dumps(rec) + "\n")
            counter["n"] += 1
            counter["ok" if not result.get("rejection_reason", "").startswith(("image fetch", "gemini error", "parse")) else "fail"] += 1
            if counter["n"] % 25 == 0 or counter["n"] == len(pending):
                rate = counter["n"] / max(0.1, time.time() - counter["t0"])
                eta = (len(pending) - counter["n"]) / max(rate, 0.01)
                print(f"  [{counter['n']:>4}/{len(pending)}]  rate={rate:.1f}/s  ETA={int(eta)}s  errors={counter['fail']}")

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = [ex.submit(_classify_one, r) for r in pending]
        for f in as_completed(futures):
            f.result()  # propagate exceptions

    fp_out.close()
    print(f"\n✓ {counter['n']} predictions written to {PREDICTIONS.relative_to(ROOT)}")
    print(f"  fetch/api/parse errors: {counter['fail']}")


if __name__ == "__main__":
    main()
