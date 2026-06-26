"""How does the system know where a report is? Three sources, in priority:

  1. EXIF GPS in the photo — the most truthful when present
  2. Browser geolocation submitted by the client
  3. Neither → mark as `unknown` and surface to ops

We never pick just one in isolation. If both EXIF and browser GPS exist,
we cross-check them — if they disagree by more than CROSS_CHECK_KM the
report is flagged so an operator can decide which to trust.

After we have a (lat, lng) we do a point-in-polygon lookup against the
real KGIS ward polygons (243 polygons cached on import) to set
`Issue.ward` so the operator dashboard and MILP can reason about it.

Designed to never raise — every failure path returns a usable
ResolvedLocation with `source=…` describing what happened.
"""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import httpx

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[4]
WARDS_PATH = REPO_ROOT / "data" / "processed" / "wards.geojson"

CROSS_CHECK_KM = 5.0  # EXIF vs browser disagreement threshold


class LocationSource:
    EXIF_ONLY = "exif_only"
    BROWSER_ONLY = "browser_only"
    EXIF_AND_BROWSER_AGREE = "exif_and_browser_agree"
    EXIF_PREFERRED_BROWSER_DISAGREES = "exif_preferred_browser_disagrees"
    GEOCODED_FROM_ADDRESS = "geocoded_from_address"
    UNKNOWN = "unknown"


@dataclass(slots=True)
class ResolvedLocation:
    lat: float | None
    lng: float | None
    ward: str | None
    ward_no: int | None
    source: str
    exif_lat: float | None = None
    exif_lng: float | None = None
    browser_lat: float | None = None
    browser_lng: float | None = None
    cross_check_km: float | None = None    # set when both signals exist
    flagged_for_review: bool = False
    geocoded_display: str | None = None
    geocoder_confidence: float | None = None


# --------------------------------------------------------------------------
# EXIF
# --------------------------------------------------------------------------

_HEIF_REGISTERED = False


def _ensure_heif_opener() -> None:
    """Register pillow-heif once so PIL.Image.open accepts iPhone .heic files."""
    global _HEIF_REGISTERED
    if _HEIF_REGISTERED:
        return
    try:
        import pillow_heif  # type: ignore[import-not-found]

        pillow_heif.register_heif_opener()
        _HEIF_REGISTERED = True
    except ImportError:
        # Without pillow-heif we silently lose iPhone EXIF; JPEG path still works.
        _HEIF_REGISTERED = True  # don't re-try every call


def extract_exif_gps(image_bytes: bytes) -> tuple[float, float] | None:
    """Return (lat, lng) if the JPEG/HEIC has GPS EXIF, else None.

    Cleanly returns None on missing libs, corrupt headers, or stripped EXIF.
    HEIC support requires pillow-heif; we register it lazily on first call.
    """
    try:
        from PIL import ExifTags, Image
    except ImportError:
        return None

    _ensure_heif_opener()

    try:
        import io
        img = Image.open(io.BytesIO(image_bytes))
        # Calls .getexif() — newer Pillow API; works on JPEG, TIFF, some PNG.
        exif = img.getexif()
        if not exif:
            return None
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
        if not gps_ifd:
            return None

        lat_tuple = gps_ifd.get(ExifTags.GPS.GPSLatitude)
        lat_ref = gps_ifd.get(ExifTags.GPS.GPSLatitudeRef)
        lng_tuple = gps_ifd.get(ExifTags.GPS.GPSLongitude)
        lng_ref = gps_ifd.get(ExifTags.GPS.GPSLongitudeRef)
        if not (lat_tuple and lng_tuple and lat_ref and lng_ref):
            return None

        lat = _dms_to_dd(lat_tuple)
        lng = _dms_to_dd(lng_tuple)
        if str(lat_ref).upper() == "S":
            lat = -lat
        if str(lng_ref).upper() == "W":
            lng = -lng
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return None
        return (round(lat, 6), round(lng, 6))
    except Exception as exc:  # noqa: BLE001 — never raise from resolver
        log.debug("exif gps extract failed: %s", exc)
        return None


def _dms_to_dd(dms: Iterable) -> float:
    """Convert ((d, m, s)) — degrees/minutes/seconds — to decimal degrees.

    EXIF stores rational numbers; PIL hands them back as floats already.
    """
    d, m, s = (float(x) for x in dms)
    return d + (m / 60.0) + (s / 3600.0)


# --------------------------------------------------------------------------
# Ward lookup
# --------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _ward_polygons():
    """Load wards.geojson once and prepare (name, ward_no, shapely.Polygon)."""
    if not WARDS_PATH.exists():
        log.warning("wards.geojson not found at %s — ward attribution disabled", WARDS_PATH)
        return []
    try:
        from shapely.geometry import shape
    except ImportError:
        log.warning("shapely missing — ward attribution disabled")
        return []
    fc = json.loads(WARDS_PATH.read_text())
    out = []
    for feature in fc.get("features", []):
        props = feature.get("properties", {}) or {}
        geom = feature.get("geometry")
        if not geom:
            continue
        name = props.get("KGISWardNa") or props.get("name") or props.get("ward") or "Unknown"
        ward_no = props.get("KGISWardNo") or props.get("ward_no")
        try:
            ward_no = int(ward_no) if ward_no is not None else None
        except (TypeError, ValueError):
            ward_no = None
        out.append((name, ward_no, shape(geom)))
    log.info("loaded %d ward polygons for attribution", len(out))
    return out


def reverse_ward(lat: float, lng: float) -> tuple[str, int | None] | None:
    """Point-in-polygon over 243 real KGIS BBMP polygons. ~1 ms per call."""
    polys = _ward_polygons()
    if not polys:
        return None
    try:
        from shapely.geometry import Point
    except ImportError:
        return None
    pt = Point(lng, lat)
    for name, no, poly in polys:
        if poly.contains(pt):
            return (name, no)
    return None


# --------------------------------------------------------------------------
# Reconciliation
# --------------------------------------------------------------------------

def haversine_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def resolve(
    *,
    photo_bytes: bytes | None = None,
    browser_lat: float | None = None,
    browser_lng: float | None = None,
    address: str | None = None,
) -> ResolvedLocation:
    """The single entry point. Always returns a ResolvedLocation.

    Priority: EXIF > browser GPS > free-text address (Nominatim) > unknown.
    """
    exif: tuple[float, float] | None = None
    if photo_bytes:
        exif = extract_exif_gps(photo_bytes)

    exif_lat = exif[0] if exif else None
    exif_lng = exif[1] if exif else None

    chosen_lat: float | None = None
    chosen_lng: float | None = None
    source = LocationSource.UNKNOWN
    cross_check: float | None = None
    flagged = False
    geocoded_display: str | None = None
    geocoder_confidence: float | None = None

    # --- Tier 1: EXIF (with cross-check) ----------------------------------
    if exif and browser_lat is not None and browser_lng is not None:
        cross_check = haversine_km(exif_lat, exif_lng, browser_lat, browser_lng)
        if cross_check <= CROSS_CHECK_KM:
            chosen_lat, chosen_lng = exif_lat, exif_lng
            source = LocationSource.EXIF_AND_BROWSER_AGREE
        else:
            chosen_lat, chosen_lng = exif_lat, exif_lng
            source = LocationSource.EXIF_PREFERRED_BROWSER_DISAGREES
            flagged = True
    elif exif:
        chosen_lat, chosen_lng = exif_lat, exif_lng
        source = LocationSource.EXIF_ONLY
    elif browser_lat is not None and browser_lng is not None:
        chosen_lat, chosen_lng = browser_lat, browser_lng
        source = LocationSource.BROWSER_ONLY

    # --- Tier 2: free-text address via Nominatim --------------------------
    if chosen_lat is None and address and address.strip():
        from nagarik.geo.geocoder import geocode_address

        hit = geocode_address(address)
        if hit is not None:
            chosen_lat, chosen_lng = hit.lat, hit.lng
            source = LocationSource.GEOCODED_FROM_ADDRESS
            geocoded_display = hit.display_name
            geocoder_confidence = hit.confidence
            # Low-confidence geocodes should be reviewed by ops.
            if hit.confidence < 0.4:
                flagged = True

    ward_name: str | None = None
    ward_no: int | None = None
    if chosen_lat is not None and chosen_lng is not None:
        match = reverse_ward(chosen_lat, chosen_lng)
        if match is not None:
            ward_name, ward_no = match

    return ResolvedLocation(
        lat=chosen_lat,
        lng=chosen_lng,
        ward=ward_name,
        ward_no=ward_no,
        source=source,
        exif_lat=exif_lat,
        exif_lng=exif_lng,
        browser_lat=browser_lat,
        browser_lng=browser_lng,
        cross_check_km=round(cross_check, 3) if cross_check is not None else None,
        flagged_for_review=flagged,
        geocoded_display=geocoded_display,
        geocoder_confidence=geocoder_confidence,
    )


def resolve_from_url(
    photo_url: str | None,
    *,
    browser_lat: float | None = None,
    browser_lng: float | None = None,
    address: str | None = None,
    timeout: float = 15.0,
) -> ResolvedLocation:
    """Convenience: fetch photo bytes from URL then call resolve()."""
    photo_bytes: bytes | None = None
    if photo_url:
        try:
            with httpx.Client(follow_redirects=True, timeout=timeout) as client:
                r = client.get(photo_url, headers={"User-Agent": "NagarikAI-Geo/0.1"})
                r.raise_for_status()
                photo_bytes = r.content
        except httpx.HTTPError as exc:
            log.warning("geo: failed to fetch photo %s: %s", photo_url, exc)
    return resolve(
        photo_bytes=photo_bytes,
        browser_lat=browser_lat,
        browser_lng=browser_lng,
        address=address,
    )
