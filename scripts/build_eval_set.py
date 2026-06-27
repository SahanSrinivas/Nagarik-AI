"""Build a Vision-agent eval set: balanced civic + random non-civic URLs.

Phase 1 of the guardrail-empirical-eval pipeline. Writes
data/eval/dataset.jsonl with one record per image:

    {"id": "pothole_001", "category": "pothole", "expected_civic": true,
     "url": "https://upload.wikimedia.org/...", "source": "wikimedia"}

We collect URLs only — no bytes downloaded here. Gemini fetches the image
directly during the eval run, same as it would for a real citizen
submission. That keeps this script fast (~1-2 min total) and cheap (no
bandwidth on our side).

Sources:
- Wikimedia Commons API for the 7 civic categories (free, no auth)
- Lorem Picsum for random non-civic stock photos (free, no auth)

Run:
    python scripts/build_eval_set.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "eval"
OUT_FILE = OUT_DIR / "dataset.jsonl"

# Per-category Wikimedia Commons categories to crawl. Multiple categories
# per civic label maximize yield where any single one is thin. Encroachment
# is the hardest (India-specific concept) so we lean on street-vendor categories.
WIKIMEDIA_CATEGORIES: dict[str, list[str]] = {
    "pothole": [
        "Potholes",                # has subcategories — recurses
        "Sinkholes",               # adjacent — recurses
        "Damaged pavements",       # adjacent
    ],
    "garbage": [
        "Garbage dumps",
        "Litter",
        "Waste in India",
        "Illegal dumping",
    ],
    "streetlight": [
        "Broken lamps",
        "Damaged street lights",
        "Street lighting in India",  # broader — yields functional + broken
    ],
    "water_leak": [
        "Water leaks",
        "Burst pipes",
        "Pipe leaks",
        "Water damage",
        "Plumbing",       # broad — Gemini will filter to actual leaks via the prompt
    ],
    "sewage": [
        "Sewage",
        "Open sewers",
        "Manholes",
    ],
    "tree_fall": [
        "Fallen trees",
        "Trees blown down",
        "Hurricane damage to trees",
    ],
    "encroachment": [
        "Street vendors in India",
        "Illegal construction",
        "Encroachment",
    ],
}

TARGET_PER_CATEGORY = 100        # cap per civic category
TARGET_NONCIVIC = 500            # random non-civic from Lorem Picsum
WIKI_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "NagarikAI-EvalScraper/0.1 (https://nagarikai.xyz)"


_HTTP = httpx.Client(timeout=20, headers={"User-Agent": USER_AGENT}, follow_redirects=True)


def _wiki_get(params: dict) -> dict:
    """Polite Wikimedia API call — adds the required User-Agent.

    Uses httpx because Python 3.14's bundled certifi has gaps on macOS;
    httpx ships its own trust store and works reliably with HTTPS.
    """
    r = _HTTP.get(WIKI_API, params=params)
    r.raise_for_status()
    return r.json()


def scrape_wikimedia_category(category: str, limit: int, *, _depth: int = 0, _seen: set | None = None) -> list[str]:
    """Return up to `limit` image file titles from a Commons category.

    Recurses into subcategories (max depth 3) because many top-level
    categories like "Potholes" only contain country subcategories, not
    files. Tracks visited categories to avoid cycles.
    """
    if _depth > 3:
        return []
    if _seen is None:
        _seen = set()
    if category in _seen:
        return []
    _seen.add(category)

    titles: list[str] = []
    subcats: list[str] = []
    cmcontinue = None
    while len(titles) < limit:
        params = {
            "action": "query", "format": "json",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmtype": "file|subcat",
            "cmlimit": min(500, limit - len(titles) + 50),
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        try:
            data = _wiki_get(params)
        except Exception as exc:  # noqa: BLE001
            print(f"    ! wikimedia error for {category!r}: {exc}", file=sys.stderr)
            break
        for row in data.get("query", {}).get("categorymembers", []):
            t = row.get("title", "")
            ns = row.get("ns")
            if ns == 6 and t.startswith("File:"):
                titles.append(t)
            elif ns == 14 and t.startswith("Category:"):
                subcats.append(t[len("Category:"):])
        cmcontinue = data.get("continue", {}).get("cmcontinue")
        if not cmcontinue:
            break
        time.sleep(0.1)

    # Recurse into subcategories until we hit limit
    for sub in subcats:
        if len(titles) >= limit:
            break
        more = scrape_wikimedia_category(sub, limit - len(titles), _depth=_depth + 1, _seen=_seen)
        titles.extend(more)
    return titles[:limit]


def wiki_resolve_urls(titles: list[str]) -> dict[str, str]:
    """Resolve File: titles → direct image URLs. Batches of 50."""
    urls: dict[str, str] = {}
    for i in range(0, len(titles), 50):
        batch = titles[i : i + 50]
        params = {
            "action": "query", "format": "json",
            "titles": "|".join(batch),
            "prop": "imageinfo",
            "iiprop": "url|mime|size",
            "iiurlwidth": 800,
        }
        try:
            data = _wiki_get(params)
        except Exception as exc:  # noqa: BLE001
            print(f"    ! wikimedia url-resolve error: {exc}", file=sys.stderr)
            continue
        for page in data.get("query", {}).get("pages", {}).values():
            ii = (page.get("imageinfo") or [{}])[0]
            mime = ii.get("mime", "")
            if not mime.startswith("image/"):
                continue          # skip SVG / videos
            if mime in {"image/svg+xml", "image/tiff", "image/x-xcf"}:
                continue          # Gemini doesn't accept these
            url = ii.get("thumburl") or ii.get("url")
            if url:
                urls[page["title"]] = url
        time.sleep(0.1)
    return urls


def build_civic_records() -> list[dict]:
    """Walk every (category → wikimedia-category) and collect URL records."""
    records: list[dict] = []
    for civic_label, wiki_cats in WIKIMEDIA_CATEGORIES.items():
        all_titles: list[str] = []
        for cat in wiki_cats:
            if len(all_titles) >= TARGET_PER_CATEGORY:
                break
            print(f"  · {civic_label} / Category:{cat}")
            got = scrape_wikimedia_category(cat, TARGET_PER_CATEGORY - len(all_titles))
            print(f"      → {len(got)} files")
            # Dedup across multiple source cats
            for t in got:
                if t not in all_titles:
                    all_titles.append(t)
        url_map = wiki_resolve_urls(all_titles)
        for idx, title in enumerate(sorted(url_map.keys())):
            records.append({
                "id": f"{civic_label}_{idx + 1:03d}",
                "category": civic_label,
                "expected_civic": True,
                "url": url_map[title],
                "source": "wikimedia",
                "wiki_title": title,
            })
        print(f"  ✓ {civic_label}: {sum(1 for r in records if r['category'] == civic_label)} usable URLs")
    return records


def build_noncivic_records() -> list[dict]:
    """500 random stock photos via Lorem Picsum predictable IDs.

    Picsum's `/id/N/640/480` returns a 640×480 JPEG for any N in 0..1084.
    Picking N = 1..500 gives 500 distinct random photos — diverse subjects,
    none of them civic-issue-like.
    """
    records = []
    for n in range(1, TARGET_NONCIVIC + 1):
        records.append({
            "id": f"random_{n:03d}",
            "category": "random_noncivic",
            "expected_civic": False,
            "url": f"https://picsum.photos/id/{n}/640/480",
            "source": "picsum",
        })
    return records


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Phase 1 — scraping eval set into {OUT_FILE.relative_to(ROOT)}\n")

    print("== Civic (Wikimedia Commons) ==")
    civic = build_civic_records()
    print(f"\n== Non-civic (Lorem Picsum) ==")
    noncivic = build_noncivic_records()
    print(f"  ✓ {len(noncivic)} URLs\n")

    records = civic + noncivic
    with OUT_FILE.open("w") as fp:
        for r in records:
            fp.write(json.dumps(r) + "\n")

    print(f"\n== Summary ==")
    by_cat: dict[str, int] = {}
    for r in records:
        by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1
    for cat, n in sorted(by_cat.items()):
        print(f"  {cat:22s} {n:>4}")
    print(f"  {'TOTAL':22s} {len(records):>4}")
    print(f"\n✓ wrote {OUT_FILE.relative_to(ROOT)}  ({len(records)} URLs)")


if __name__ == "__main__":
    main()
