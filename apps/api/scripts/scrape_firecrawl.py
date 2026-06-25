"""Real iChangeMyCity scraper via Firecrawl.

iChangeMyCity is an AngularJS SPA — complaint cards render client-side, so
plain HTTP requests get an empty shell. Firecrawl runs a real headless
browser, waits for the JS to settle, and returns rendered HTML/markdown.

Set FIRECRAWL_API_KEY in .env (https://www.firecrawl.dev/app/api-keys).
Free tier = 500 credits; each list page = 1 credit, so 200 pages fits.

Usage:
    python -m scripts.scrape_firecrawl --city bangalore --pages 50 \
        --out ../../data/raw/icmc_firecrawl.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from pathlib import Path

import httpx

FIRECRAWL_BASE = "https://api.firecrawl.dev/v1"
ICMC_BASE = "https://www.ichangemycity.com"
LIST_PATH = "/complaints/{city}/all/{page}"

CARD_SELECTORS = ".complaint-card, .complaint, article.complaint, .complaint-list-item"


def firecrawl_scrape(client: httpx.Client, url: str, api_key: str) -> dict:
    """Hit Firecrawl /v1/scrape and return the parsed JSON response."""
    r = client.post(
        f"{FIRECRAWL_BASE}/scrape",
        json={
            "url": url,
            "formats": ["html", "markdown"],
            # Wait for JS-rendered complaint cards to appear before snapshotting.
            "waitFor": 3000,
            "timeout": 30000,
            "onlyMainContent": False,
        },
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def extract_records(rendered: dict, page_url: str) -> list[dict]:
    """Parse the Firecrawl response into complaint records.

    Firecrawl returns both HTML (after JS render) and markdown. We parse the
    HTML with BeautifulSoup since the cards have stable data attributes.
    """
    from bs4 import BeautifulSoup

    data = rendered.get("data", {}) or rendered
    html = data.get("html") or data.get("rawHtml") or ""
    if not html:
        return []

    soup = BeautifulSoup(html, "lxml")
    out: list[dict] = []
    for card in soup.select(CARD_SELECTORS):
        rec = {
            "id": card.get("data-id") or card.get("data-complaint-id") or card.get("id"),
            "title": _text(card, ".title, h3, h4, .complaint-title"),
            "category": _text(card, ".category, .tag, .label, .complaint-category"),
            "status": _text(card, ".status, .complaint-status"),
            "ward": _text(card, ".ward, .location, .complaint-location"),
            "reported_at": _text(card, ".reported, .date, time, .complaint-date"),
            "resolved_at": _text(card, ".resolved-date, .complaint-resolved"),
            "lat": _attr(card, "[data-lat], .map", "data-lat"),
            "lng": _attr(card, "[data-lng], .map", "data-lng"),
            "url": _href(card, "a.detail-link, a.title, a"),
            "source_page": page_url,
        }
        if any(v for v in rec.values() if v):
            out.append(rec)
    return out


def _text(node, sel: str) -> str | None:
    el = node.select_one(sel)
    return el.get_text(strip=True) if el else None


def _attr(node, sel: str, attr: str) -> str | None:
    el = node.select_one(sel)
    return el.get(attr) if el else None


def _href(node, sel: str) -> str | None:
    el = node.select_one(sel)
    if el is None:
        return None
    href = el.get("href")
    return (ICMC_BASE + href) if href and href.startswith("/") else href


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="bangalore")
    ap.add_argument("--pages", type=int, default=20)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--sleep", type=float, default=0.5)
    args = ap.parse_args()

    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        print("ERROR: set FIRECRAWL_API_KEY in env or .env")
        print("Get one at https://www.firecrawl.dev/app/api-keys")
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []

    with httpx.Client() as client:
        for p in range(1, args.pages + 1):
            url = ICMC_BASE + LIST_PATH.format(city=args.city, page=p)
            try:
                resp = firecrawl_scrape(client, url, api_key)
            except httpx.HTTPError as e:
                print(f"page {p:>3} firecrawl error: {e}")
                continue

            batch = extract_records(resp, url)
            print(f"page {p:>3}: {len(batch):>3} records")
            if not batch and p > 2:
                # Two consecutive empty pages → end-of-results.
                print("two empty pages, stopping early")
                break
            records.extend(batch)
            time.sleep(args.sleep)

    args.out.write_text(json.dumps(records, indent=2, default=str))
    print(f"\nwrote {len(records)} records → {args.out}")
    print("\nNext: python -m scripts.load_icmc --input", args.out)
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
