"""Pre-download every eval image to local disk so the eval loop doesn't
hit Wikipedia's thumb-server rate limit. Polite single-threaded with 0.3s
between requests + exponential-backoff retries on 429/5xx.

Saves bytes to data/eval/images/<id>.<ext> and writes a manifest at
data/eval/dataset_local.jsonl pointing each id at its local path.

Resumable — files that already exist on disk are skipped.

Run:
    python scripts/download_eval_images.py
"""

from __future__ import annotations

import json
import random
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "data" / "eval" / "dataset.jsonl"
IMG_DIR = ROOT / "data" / "eval" / "images"
MANIFEST = ROOT / "data" / "eval" / "dataset_local.jsonl"

# Wikimedia bans generic UAs; a contact URL is required. Rotate just two
# (one HTTPX, one Mozilla-style) so we don't look like a single bot.
USER_AGENTS = [
    "NagarikAI-Eval/0.1 (https://nagarikai.xyz; ops@nagarikai.xyz) httpx",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) NagarikAI-Eval/0.1 (ops@nagarikai.xyz)",
]


def _ext_for(url: str, content_type: str) -> str:
    """Pick a sane extension for the saved file."""
    ct = content_type.lower().split(";")[0].strip()
    mime_map = {
        "image/jpeg": ".jpg",
        "image/png":  ".png",
        "image/webp": ".webp",
        "image/heic": ".heic",
        "image/heif": ".heif",
    }
    if ct in mime_map:
        return mime_map[ct]
    # fall back to extension from URL
    for e in (".jpg", ".jpeg", ".png", ".webp"):
        if e in url.lower():
            return ".jpg" if e == ".jpeg" else e
    return ".bin"


def _download(client: httpx.Client, url: str, dest_base: Path) -> Path | None:
    """Download with backoff retries. Returns the final saved path or None."""
    # If any file with this base already exists, skip — resumable.
    for ext in (".jpg", ".png", ".webp", ".heic", ".heif"):
        if dest_base.with_suffix(ext).exists():
            return dest_base.with_suffix(ext)

    backoff = 1.0
    for attempt in range(5):
        ua = USER_AGENTS[attempt % len(USER_AGENTS)]
        try:
            r = client.get(url, headers={"User-Agent": ua, "Accept": "image/*"})
        except httpx.RequestError as exc:
            print(f"    ! {dest_base.name} network error: {exc}", file=sys.stderr)
            time.sleep(backoff); backoff *= 2; continue

        if r.status_code in (429, 503):
            # Honour Retry-After if present, else exponential backoff
            ra = r.headers.get("retry-after")
            wait = float(ra) if ra and ra.isdigit() else backoff
            time.sleep(wait); backoff *= 2; continue
        if r.status_code >= 400:
            print(f"    ! {dest_base.name} HTTP {r.status_code}", file=sys.stderr)
            return None

        ext = _ext_for(url, r.headers.get("content-type", ""))
        dest = dest_base.with_suffix(ext)
        dest.write_bytes(r.content)
        return dest
    print(f"    ! {dest_base.name} exhausted retries", file=sys.stderr)
    return None


def main() -> None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    rows = [json.loads(l) for l in DATASET.read_text().splitlines() if l.strip()]

    # Order: civic first (Wikipedia, hardest), then non-civic. Slight randomization
    # within civic to avoid hammering the same Wikipedia category in sequence.
    civic = [r for r in rows if r["expected_civic"]]
    noncivic = [r for r in rows if not r["expected_civic"]]
    random.shuffle(civic)
    ordered = civic + noncivic

    print(f"Pre-downloading {len(ordered)} images → {IMG_DIR.relative_to(ROOT)}/")
    print(f"  ({len(civic)} civic + {len(noncivic)} non-civic)\n")

    client = httpx.Client(timeout=30, follow_redirects=True)
    out_fp = MANIFEST.open("w", buffering=1)

    counts = {"ok": 0, "fail": 0, "skipped": 0}
    t0 = time.time()
    for i, row in enumerate(ordered, 1):
        dest_base = IMG_DIR / row["id"]
        existing = next((dest_base.with_suffix(e) for e in (".jpg", ".png", ".webp", ".heic", ".heif")
                         if dest_base.with_suffix(e).exists()), None)
        if existing:
            counts["skipped"] += 1
            local_path = existing
        else:
            local_path = _download(client, row["url"], dest_base)
            if local_path is None:
                counts["fail"] += 1
                continue
            counts["ok"] += 1
            # Polite delay only after an actual fetch (not skip)
            time.sleep(0.3 if not row["url"].startswith("https://picsum") else 0.0)

        out_fp.write(json.dumps({
            **row,
            "local_path": str(local_path.relative_to(ROOT)),
        }) + "\n")

        if i % 50 == 0 or i == len(ordered):
            dt = time.time() - t0
            print(f"  [{i:>4}/{len(ordered)}] ok={counts['ok']} skipped={counts['skipped']} "
                  f"fail={counts['fail']}  ({dt:.0f}s)")

    out_fp.close()
    client.close()

    print(f"\n✓ Done. ok={counts['ok']} skipped={counts['skipped']} fail={counts['fail']}")
    print(f"  Manifest: {MANIFEST.relative_to(ROOT)}")
    # Quick coverage report
    from collections import Counter
    cat_counts: Counter = Counter()
    for line in MANIFEST.read_text().splitlines():
        if line.strip():
            cat_counts[json.loads(line)["category"]] += 1
    print("\nLocal coverage per category:")
    for cat, n in sorted(cat_counts.items()):
        print(f"  {cat:22s} {n:>4}")


if __name__ == "__main__":
    main()
