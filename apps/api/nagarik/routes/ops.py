"""Operator audit views.

For now the only audit surface we need is the location-flagged list:
issues where the EXIF GPS disagreed with the browser GPS by more than the
threshold OR where the geocoder confidence was low. Ops can pick one and
either confirm the location (snap back to the chosen source) or kill the
report as fraudulent.

In production these endpoints are JWT-guarded; here we keep them open for
the demo flow.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.shape import to_shape
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.models import Issue, IssueStatus

router = APIRouter(prefix="/ops", tags=["ops"])


@router.get("/flagged")
def list_flagged(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
) -> dict:
    """Issues whose location resolution was flagged for review.

    We do a JSON-path filter on the ai_classification.location_resolver block
    that the resolver writes — see nagarik/geo/resolver.py.
    """
    stmt = (
        select(Issue)
        .where(Issue.ai_classification["location_resolver"]["flagged_for_review"].as_boolean().is_(True))
        .order_by(Issue.created_at.desc())
        .limit(limit)
    )
    rows = db.scalars(stmt).all()

    items = []
    for issue in rows:
        loc = (issue.ai_classification or {}).get("location_resolver", {})
        pt = to_shape(issue.location)
        items.append(
            {
                "id": str(issue.id),
                "type": getattr(issue.type, "value", str(issue.type)),
                "status": getattr(issue.status, "value", str(issue.status)),
                "ward": issue.ward,
                "lat": pt.y,
                "lng": pt.x,
                "address": issue.address,
                "description": (issue.description or "")[:120],
                "before_photo_url": issue.before_photo_url,
                "created_at": issue.created_at.isoformat(),
                "source": loc.get("source"),
                "cross_check_km": loc.get("cross_check_km"),
                "exif_lat": loc.get("exif_lat"),
                "exif_lng": loc.get("exif_lng"),
                "browser_lat": loc.get("browser_lat"),
                "browser_lng": loc.get("browser_lng"),
                "geocoded_display": loc.get("geocoded_display"),
                "geocoder_confidence": loc.get("geocoder_confidence"),
            }
        )

    return {"count": len(items), "items": items}


@router.post("/flagged/{issue_id}/confirm")
def confirm_flag(
    issue_id: uuid.UUID,
    keep: str = Query(..., regex="^(exif|browser|current)$"),
    db: Session = Depends(get_db),
) -> dict:
    """Clear the flag on a reviewed issue.

    `keep=current` — operator agrees with whatever the resolver picked
    `keep=exif`    — switch the issue location to the EXIF coordinates
    `keep=browser` — switch the issue location to the browser-submitted coordinates
    """
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")

    loc = (issue.ai_classification or {}).get("location_resolver", {})
    new_lat: float | None = None
    new_lng: float | None = None
    if keep == "exif" and loc.get("exif_lat") is not None:
        new_lat, new_lng = float(loc["exif_lat"]), float(loc["exif_lng"])
    elif keep == "browser" and loc.get("browser_lat") is not None:
        new_lat, new_lng = float(loc["browser_lat"]), float(loc["browser_lng"])

    updates = {
        "ai_classification": {
            **(issue.ai_classification or {}),
            "location_resolver": {
                **loc,
                "flagged_for_review": False,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "review_decision": keep,
            },
        }
    }
    if new_lat is not None and new_lng is not None:
        from geoalchemy2.shape import from_shape
        from shapely.geometry import Point
        from nagarik.geo.resolver import reverse_ward

        updates["location"] = from_shape(Point(new_lng, new_lat), srid=4326)
        ward_match = reverse_ward(new_lat, new_lng)
        if ward_match:
            updates["ward"] = ward_match[0]

    db.execute(update(Issue).where(Issue.id == issue.id).values(**updates))
    db.commit()
    return {"id": str(issue.id), "kept": keep, "new_ward": updates.get("ward", issue.ward)}


@router.post("/flagged/{issue_id}/reject")
def reject_flag(issue_id: uuid.UUID, db: Session = Depends(get_db)) -> dict:
    """Kill a flagged issue as fraudulent / unactionable."""
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")
    loc = (issue.ai_classification or {}).get("location_resolver", {})
    db.execute(
        update(Issue)
        .where(Issue.id == issue.id)
        .values(
            status=IssueStatus.REJECTED,
            ai_classification={
                **(issue.ai_classification or {}),
                "location_resolver": {
                    **loc,
                    "flagged_for_review": False,
                    "reviewed_at": datetime.now(timezone.utc).isoformat(),
                    "review_decision": "rejected",
                },
            },
        )
    )
    db.commit()
    return {"id": str(issue.id), "status": "rejected"}
