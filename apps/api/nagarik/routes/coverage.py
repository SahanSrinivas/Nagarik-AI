"""Coverage probe — quick GET endpoint the /report client can call to
check whether a lat/lng is inside BBMP jurisdiction before submission.

Saves the citizen a wasted submit + 422 round-trip, and lets the UI
show an inline warning the moment they share their location.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from nagarik.geo.resolver import reverse_ward

router = APIRouter(prefix="/coverage", tags=["coverage"])


@router.get("/check")
def check(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> dict:
    match = reverse_ward(lat, lng)
    if match is None:
        return {
            "inside_bbmp": False,
            "lat": lat,
            "lng": lng,
            "message": "Outside BBMP jurisdiction. NagarikAI only handles "
                       "Bengaluru BBMP wards today.",
        }
    name, ward_no = match
    return {
        "inside_bbmp": True,
        "lat": lat,
        "lng": lng,
        "ward": name,
        "ward_no": ward_no,
    }
