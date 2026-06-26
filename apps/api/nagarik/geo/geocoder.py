"""OSM Nominatim geocoder — last-resort fallback when neither EXIF nor
browser GPS is available, but the citizen typed a free-text address.

Why Nominatim?
  - Free, no API key, governed by the OSM Foundation
  - Real Bengaluru coverage (OSM has dense BBMP ward data)
  - 1 request / second per-IP soft limit; we never bulk-geocode here

Why NOT Google Geocoding?
  - Costs $$ at scale
  - ToS prohibits storing results without their map
  - We only need a fallback for at most a few % of submissions

We always include a strong User-Agent (per Nominatim ToS) and a 5s timeout.
On any failure we return None; the caller marks the issue as unknown.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

log = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Bengaluru bounding box: viewbox biases results to BBMP wards even when the
# query is short ("4th cross HSR Layout" → matches HSR Layout, not Houston).
BLR_VIEWBOX = (77.4, 13.15, 77.85, 12.80)  # left, top, right, bottom

USER_AGENT = "NagarikAI/0.1 (civic-tech hackathon; contact: 26sahan@gmail.com)"


@dataclass(slots=True)
class GeocodeHit:
    lat: float
    lng: float
    display_name: str
    confidence: float  # 0..1 — derived from Nominatim's `importance`


def geocode_address(
    query: str,
    *,
    city: str = "Bengaluru",
    timeout: float = 5.0,
) -> GeocodeHit | None:
    """Geocode a free-text address to (lat, lng), biased to Bengaluru."""
    q = (query or "").strip()
    if not q:
        return None
    # Append city if not already mentioned — improves precision dramatically.
    if "bengaluru" not in q.lower() and "bangalore" not in q.lower():
        q = f"{q}, {city}"

    params = {
        "q": q,
        "format": "json",
        "limit": "1",
        "viewbox": ",".join(str(v) for v in BLR_VIEWBOX),
        "bounded": "1",
        "addressdetails": "0",
    }

    try:
        with httpx.Client(timeout=timeout, headers={"User-Agent": USER_AGENT}) as client:
            r = client.get(NOMINATIM_URL, params=params)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("nominatim: %s", exc)
        return None

    if not data:
        return None

    top = data[0]
    try:
        lat = float(top["lat"])
        lng = float(top["lon"])
    except (KeyError, ValueError):
        return None

    # Nominatim's `importance` is roughly 0..1; treat below 0.3 as low-confidence.
    importance = float(top.get("importance", 0.3))
    return GeocodeHit(
        lat=round(lat, 6),
        lng=round(lng, 6),
        display_name=str(top.get("display_name", q))[:200],
        confidence=round(max(0.0, min(1.0, importance)), 3),
    )
