"""Load the scraped iChangeMyCity records into Postgres.

Usage:
    python -m scripts.load_icmc --input ../../data/raw/icmc.json
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from nagarik.db import SessionLocal
from nagarik.models import Citizen, Issue, IssueStatus, IssueType

CATEGORY_MAP = {
    "garbage": IssueType.GARBAGE,
    "solid waste": IssueType.GARBAGE,
    "pothole": IssueType.POTHOLE,
    "road": IssueType.POTHOLE,
    "streetlight": IssueType.STREETLIGHT,
    "light": IssueType.STREETLIGHT,
    "water": IssueType.WATER_LEAK,
    "leakage": IssueType.WATER_LEAK,
    "sewage": IssueType.SEWAGE,
    "drainage": IssueType.SEWAGE,
    "tree": IssueType.TREE_FALL,
    "encroachment": IssueType.ENCROACHMENT,
}

STATUS_MAP = {
    "resolved": IssueStatus.RESOLVED,
    "closed": IssueStatus.CLOSED,
    "open": IssueStatus.REPORTED,
    "in progress": IssueStatus.IN_PROGRESS,
    "rejected": IssueStatus.REJECTED,
}


def map_category(raw: str | None) -> IssueType:
    if not raw:
        return IssueType.OTHER
    lo = raw.lower()
    for key, val in CATEGORY_MAP.items():
        if key in lo:
            return val
    return IssueType.OTHER


def map_status(raw: str | None) -> IssueStatus:
    if not raw:
        return IssueStatus.REPORTED
    return STATUS_MAP.get(raw.lower().strip(), IssueStatus.REPORTED)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    args = ap.parse_args()

    records = json.loads(args.input.read_text())
    print(f"loading {len(records)} records from {args.input}")

    with SessionLocal() as db:
        demo = db.query(Citizen).first()
        if demo is None:
            demo = Citizen(phone="+910000000000", name="Historical Import")
            db.add(demo)
            db.flush()

        loaded = 0
        for r in records:
            try:
                lat = float(r.get("lat") or 0)
                lng = float(r.get("lng") or 0)
            except (TypeError, ValueError):
                continue
            if lat == 0 or lng == 0:
                continue

            reported_at = r.get("reported_at")
            try:
                created_at = datetime.fromisoformat(reported_at) if reported_at else datetime.now(timezone.utc)
            except ValueError:
                created_at = datetime.now(timezone.utc)

            issue = Issue(
                reporter_id=demo.id,
                type=map_category(r.get("category")),
                severity=3,
                status=map_status(r.get("status")),
                location=from_shape(Point(lng, lat), srid=4326),
                address=None,
                ward=r.get("ward"),
                description=r.get("title") or "",
                created_at=created_at,
            )
            db.add(issue)
            loaded += 1

        db.commit()
        print(f"loaded {loaded} issues into Postgres")


if __name__ == "__main__":
    main()
