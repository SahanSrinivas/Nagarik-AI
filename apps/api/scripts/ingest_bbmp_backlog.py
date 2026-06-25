"""Ingest the real OpenCity / Janaagraha BBMP backlog into our Postgres.

Data source: ../../../community-hero/data/ward_backlog.json — H1-2025 backlog,
243 KGIS wards, 19,194 open complaints distributed across 7 BBMP departments.
Sourced from the OpenCity "Decoding Bengaluru's Civic Complaints" dataset.

What this script does:
  1. Maps the real BBMP taxonomy → NagarikAI's 8-category schema.
  2. Generates one Issue per open backlog complaint (capped per ward to keep
     the demo manageable — bump CAP_PER_WARD_PER_CATEGORY for the full run).
  3. Uses real ward centroids (lat/lng) + small jitter to spread pins on map.
  4. Seeds crews per BBMP department with depot at the densest-backlog ward.

The output dataset feeds:
  - /map (real ward distribution of issues)
  - /milp (CVRPTW now runs on real backlog volume)
  - /dashboard (per-ward stats are real)
  - the MILP backtest comparing our routing optimization against FIFO

Usage:
    python -m scripts.ingest_bbmp_backlog                 # default cap of 5
    python -m scripts.ingest_bbmp_backlog --cap 10 --wipe
"""

from __future__ import annotations

import argparse
import json
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import delete, select

from nagarik.db import SessionLocal
from nagarik.models import AgentEvent, Citizen, Crew, Issue, IssueStatus, IssueType, Verification

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKLOG_PATH = REPO_ROOT.parent / "community-hero" / "data" / "ward_backlog.json"

# BBMP taxonomy → NagarikAI category.
# (sourced from category_department in the real OpenCity CSV)
CATEGORY_MAP: dict[str, list[tuple[IssueType, float]]] = {
    "Electrical":                    [(IssueType.STREETLIGHT, 1.0)],
    "Solid Waste (Garbage) Related": [(IssueType.GARBAGE, 1.0)],
    "Road Maintenance(Engg)":        [(IssueType.POTHOLE, 1.0)],
    "Water Supply / Sewage":         [(IssueType.WATER_LEAK, 0.5), (IssueType.SEWAGE, 0.5)],
    "Forest":                        [(IssueType.TREE_FALL, 1.0)],
    "Health Dept":                   [(IssueType.OTHER, 1.0)],
    "veterinary":                    [(IssueType.OTHER, 1.0)],
    "Others":                        [(IssueType.OTHER, 0.7), (IssueType.ENCROACHMENT, 0.3)],
}

# Severity skew per NagarikAI type (matches our seed script for consistency).
SEVERITY_MEAN = {
    IssueType.GARBAGE: 2.8,
    IssueType.POTHOLE: 3.4,
    IssueType.STREETLIGHT: 2.5,
    IssueType.WATER_LEAK: 4.0,
    IssueType.SEWAGE: 4.2,
    IssueType.TREE_FALL: 3.7,
    IssueType.ENCROACHMENT: 2.2,
    IssueType.OTHER: 2.6,
}

# Each crew handles 1 NagarikAI type.
CREW_SEED: list[tuple[str, str, IssueType, int]] = [
    ("BBMP Roads North",         "BBMP Roads",         IssueType.POTHOLE,     12),
    ("BBMP Roads South",         "BBMP Roads",         IssueType.POTHOLE,     12),
    ("BBMP Roads East",          "BBMP Roads",         IssueType.POTHOLE,     12),
    ("BBMP SWM Central",         "BBMP SWM",           IssueType.GARBAGE,     14),
    ("BBMP SWM South",           "BBMP SWM",           IssueType.GARBAGE,     14),
    ("BESCOM Streetlight A",     "BESCOM Streetlight", IssueType.STREETLIGHT, 10),
    ("BESCOM Streetlight B",     "BESCOM Streetlight", IssueType.STREETLIGHT, 10),
    ("BWSSB Water A",            "BWSSB",              IssueType.WATER_LEAK,   8),
    ("BWSSB Sewage A",           "BWSSB",              IssueType.SEWAGE,       8),
    ("BBMP Horticulture",        "BBMP Horticulture",  IssueType.TREE_FALL,    6),
    ("BBMP Town Planning",       "BBMP Town Planning", IssueType.ENCROACHMENT, 6),
    ("BBMP Helpdesk",            "BBMP Helpdesk",      IssueType.OTHER,        8),
]


def _pick_type(rng: random.Random, bbmp_cat: str) -> IssueType | None:
    mappings = CATEGORY_MAP.get(bbmp_cat)
    if not mappings:
        return None
    x = rng.random()
    acc = 0.0
    for t, p in mappings:
        acc += p
        if x <= acc:
            return t
    return mappings[-1][0]


def _jitter(lat: float, lng: float, rng: random.Random, radius_km: float = 0.6) -> tuple[float, float]:
    import math
    r = rng.random() * radius_km
    theta = rng.random() * 2 * math.pi
    dlat = (r * math.cos(theta)) / 111.0
    dlng = (r * math.sin(theta)) / (111.0 * math.cos(math.radians(lat)))
    return lat + dlat, lng + dlng


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cap", type=int, default=5,
                    help="max issues to generate per ward per BBMP category (default 5)")
    ap.add_argument("--wipe", action="store_true",
                    help="delete all prior issues/crews/citizens before ingest")
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--backlog", type=Path, default=BACKLOG_PATH)
    args = ap.parse_args()

    if not args.backlog.exists():
        print(f"ERROR: backlog file not found at {args.backlog}")
        print("Expected community-hero/data/ward_backlog.json next to NagarikAI/.")
        return 1

    rng = random.Random(args.seed)
    payload = json.loads(args.backlog.read_text())
    meta = payload["meta"]
    print(f"loaded BBMP backlog: {meta['n_wards']} wards, "
          f"{meta['total_complaints']:,} total complaints, "
          f"{meta['total_open']:,} open")

    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        if args.wipe:
            db.execute(delete(AgentEvent))
            db.execute(delete(Verification))
            db.execute(delete(Issue))
            db.execute(delete(Crew))
            db.execute(delete(Citizen))
            db.commit()
            print("wiped prior data")

        # Seed one demo citizen as the reporter (historical-import).
        citizen = db.scalar(select(Citizen).where(Citizen.phone == "+910000000000"))
        if citizen is None:
            citizen = Citizen(id=uuid.uuid4(), phone="+910000000000", name="BBMP Historical Import")
            db.add(citizen)
            db.flush()

        # Crews: pick depot ward as the highest-backlog ward for that category.
        wards = payload["wards"]
        ward_open = {w["ward"]: w for w in wards}
        for crew_name, dept, handles, cap in CREW_SEED:
            existing = db.scalar(select(Crew).where(Crew.name == crew_name))
            if existing:
                continue
            # Find busiest ward for this department.
            dept_key = {
                IssueType.POTHOLE: "Engineering",
                IssueType.GARBAGE: "SWM",
                IssueType.STREETLIGHT: "Electrical",
                IssueType.WATER_LEAK: "General",
                IssueType.SEWAGE: "General",
                IssueType.TREE_FALL: "Forest",
                IssueType.ENCROACHMENT: "General",
                IssueType.OTHER: "General",
            }[handles]
            busiest = max(
                wards,
                key=lambda w: (w.get("open_by_department", {}) or {}).get(dept_key, 0),
            )
            db.add(
                Crew(
                    id=uuid.uuid4(),
                    name=crew_name,
                    department=dept,
                    depot_location=from_shape(Point(busiest["lon"], busiest["lat"]), srid=4326),
                    skills=[handles.value],
                    daily_capacity=cap,
                )
            )

        db.flush()
        print(f"seeded {len(CREW_SEED)} crews at busiest-ward depots")

        # Generate issues.
        created = 0
        per_cat: dict[str, int] = {}
        for w in wards:
            ward_name = w["ward"]
            for bbmp_cat, stats in (w.get("by_category") or {}).items():
                open_cnt = int(stats.get("open", 0))
                if open_cnt <= 0:
                    continue
                n = min(open_cnt, args.cap)
                for _ in range(n):
                    nag_type = _pick_type(rng, bbmp_cat)
                    if nag_type is None:
                        continue
                    lat, lng = _jitter(w["lat"], w["lon"], rng)
                    sev_mean = SEVERITY_MEAN[nag_type]
                    severity = max(1, min(5, int(round(rng.gauss(sev_mean, 0.7)))))
                    age_hours = rng.randint(2, 24 * 60)
                    reported_at = now - timedelta(hours=age_hours)
                    sla = reported_at + timedelta(hours=rng.choice([24, 48, 72, 96]))
                    db.add(
                        Issue(
                            id=uuid.uuid4(),
                            reporter_id=citizen.id,
                            type=nag_type,
                            severity=severity,
                            status=IssueStatus.TRIAGED,
                            location=from_shape(Point(lng, lat), srid=4326),
                            address=f"{ward_name} (Ward {w.get('ward_no')})",
                            ward=ward_name,
                            description=f"BBMP {bbmp_cat} backlog · imported from OpenCity/Janaagraha H1-2025",
                            routed_department=meta["category_department"].get(bbmp_cat, "BBMP Helpdesk"),
                            sla_deadline=sla,
                            ai_classification={
                                "source": "bbmp_opencity_h1_2025",
                                "original_category": bbmp_cat,
                                "ward_no": w.get("ward_no"),
                                "resolution_rate": stats.get("resolution"),
                                "provenance": meta.get("provenance"),
                            },
                            ai_confidence=stats.get("resolution", 0.5),
                            created_at=reported_at,
                        )
                    )
                    created += 1
                    per_cat[nag_type.value] = per_cat.get(nag_type.value, 0) + 1

        db.commit()
        print(f"\ningested {created:,} issues across {len(wards)} real BBMP wards")
        print("by NagarikAI type:")
        for k, v in sorted(per_cat.items(), key=lambda x: -x[1]):
            print(f"  {k:<14} {v:>5}")

    print("\nReady. Try:")
    print("  curl localhost:8000/insights/ward-stats | jq")
    print("  python -m nagarik.milp.backtest --issues 200 --crews 12")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
