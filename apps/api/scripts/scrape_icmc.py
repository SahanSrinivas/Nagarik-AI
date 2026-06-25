"""Scrape iChangeMyCity (Janaagraha) historical complaints into data/raw/icmc.json.

NOTE on data access: Janaagraha publishes complaint data via their public
listing pages and a partner API for researchers. For the hackathon we hit
their public complaint listing pages and parse them; for the production
product we'd request researcher API access (free for civic-tech use).

Usage:
    python -m scripts.scrape_icmc --city bangalore --pages 50 --out ../../data/raw/icmc.json
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

BASE = "https://www.ichangemycity.com"
LIST_PATH = "/complaints/{city}/all/{page}"
HEADERS = {
    "User-Agent": (
        "NagarikAI-Hackathon-Scraper/0.1 "
        "(contact: 26sahan@gmail.com - academic backtest only)"
    )
}


def fetch_page(client: httpx.Client, city: str, page: int) -> list[dict]:
    """Parse one listing page into structured records.

    The DOM selectors below are based on the public-site layout as of late 2024;
    if the site changes, update SELECTORS — that's the only piece to maintain.
    """
    url = BASE + LIST_PATH.format(city=city, page=page)
    r = client.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    cards = soup.select(".complaint-card, .complaint, article.complaint")
    out: list[dict] = []
    for c in cards:
        out.append(
            {
                "id": c.get("data-id") or c.get("id"),
                "title": _text(c, ".title, h3, h4"),
                "category": _text(c, ".category, .tag, .label"),
                "status": _text(c, ".status"),
                "ward": _text(c, ".ward, .location"),
                "reported_at": _text(c, ".reported, .date, time"),
                "resolved_at": _text(c, ".resolved-date"),
                "lat": _attr(c, ".map", "data-lat"),
                "lng": _attr(c, ".map", "data-lng"),
                "url": _href(c, "a.detail-link, a.title"),
            }
        )
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
    return (BASE + href) if href and href.startswith("/") else href


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="bangalore")
    ap.add_argument("--pages", type=int, default=50)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--sleep", type=float, default=1.0, help="seconds between requests (be kind)")
    args = ap.parse_args()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    records: list[dict] = []

    with httpx.Client(follow_redirects=True) as client:
        for p in range(1, args.pages + 1):
            try:
                batch = fetch_page(client, args.city, p)
            except httpx.HTTPError as e:
                print(f"page {p} failed: {e}")
                continue
            print(f"page {p}: {len(batch)} records")
            if not batch:
                break
            records.extend(batch)
            time.sleep(args.sleep)

    args.out.write_text(json.dumps(records, indent=2, default=str))
    print(f"\nWrote {len(records)} records to {args.out}")


if __name__ == "__main__":
    main()
