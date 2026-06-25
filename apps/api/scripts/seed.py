"""Seed demo data — 5 citizens, 8 crews, 20 issues across Bangalore.

Idempotent: re-running wipes the demo rows and re-inserts. Safe for live demo prep.

Usage:
    python -m scripts.seed
    python -m scripts.seed --wipe     # also delete agent_events from prior runs
"""

from __future__ import annotations

import argparse
import random
import uuid
from datetime import datetime, timedelta, timezone

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import delete, select

from nagarik.db import SessionLocal
from nagarik.models import AgentEvent, Citizen, Crew, Issue, IssueStatus, IssueType, Verification

# Bangalore neighbourhood anchors — keeps the demo map visually clustered.
NEIGHBOURHOODS = [
    ("Indiranagar", 12.9716, 77.6412, "Ward 76"),
    ("Koramangala", 12.9352, 77.6245, "Ward 151"),
    ("Whitefield", 12.9698, 77.7500, "Ward 84"),
    ("Jayanagar", 12.9279, 77.5832, "Ward 168"),
    ("HSR Layout", 12.9116, 77.6473, "Ward 174"),
    ("Malleshwaram", 13.0036, 77.5712, "Ward 45"),
    ("BTM Layout", 12.9166, 77.6101, "Ward 176"),
    ("Marathahalli", 12.9591, 77.6974, "Ward 85"),
]

DEMO_CITIZENS = [
    ("+919900000001", "Ramesh K."),
    ("+919900000002", "Anjali S."),
    ("+919900000003", "Karthik N."),
    ("+919900000004", "Meera P."),
    ("+919900000005", "Vikram R."),
]

DEMO_CREWS = [
    ("BBMP Roads-N",     "BBMP Roads",         13.0036, 77.5712, ["pothole"],                       10),
    ("BBMP Roads-S",     "BBMP Roads",         12.9116, 77.6473, ["pothole"],                       10),
    ("BBMP SWM-East",    "BBMP SWM",           12.9698, 77.7500, ["garbage"],                       12),
    ("BBMP SWM-West",    "BBMP SWM",           12.9279, 77.5832, ["garbage"],                       12),
    ("BESCOM Lights-1",  "BESCOM Streetlight", 12.9716, 77.6412, ["streetlight"],                    8),
    ("BWSSB Mains-1",    "BWSSB",              12.9352, 77.6245, ["water_leak", "sewage"],           8),
    ("BBMP Trees-1",     "BBMP Horticulture",  13.0036, 77.5712, ["tree_fall"],                      6),
    ("BBMP Helpdesk-1",  "BBMP Helpdesk",      12.9591, 77.6974, ["other", "encroachment"],          8),
]

DEMO_ISSUE_TEMPLATES = [
    ("pothole",      "Deep pothole at 3rd cross — water collects after rain", 4),
    ("pothole",      "Crater near bus stop, two-wheelers crashing weekly",     5),
    ("pothole",      "Edge of the road broken — risk for cyclists",            3),
    ("garbage",      "Black-spot dump near park, smell unbearable",            4),
    ("garbage",      "Wet waste not picked up for 5 days",                     3),
    ("garbage",      "Construction debris dumped on pavement",                 3),
    ("streetlight",  "Streetlight not working for 2 weeks — area unsafe",      3),
    ("streetlight",  "Flickering streetlight, hazard for drivers",             2),
    ("water_leak",   "Pipe burst on main road, water gushing for hours",       5),
    ("water_leak",   "Constant drip from manhole near house — wasting water",  2),
    ("sewage",       "Sewage overflow at corner — health hazard",              5),
    ("sewage",       "Drain blocked, mosquito breeding",                       3),
    ("tree_fall",    "Tree branch fallen across road blocking traffic",        4),
    ("tree_fall",    "Dead tree leaning over pavement — needs urgent cutting", 4),
    ("encroachment", "Shop encroaching 4 feet onto footpath",                  2),
    ("garbage",      "Animal carcass on the road",                             3),
    ("pothole",      "Series of potholes after BWSSB pipe repair not refilled", 3),
    ("streetlight",  "Whole block dark — substation issue?",                   4),
    ("water_leak",   "Slow seepage onto road from underground pipe",           2),
    ("garbage",      "Public toilet overflowing — unusable",                   4),
]


def jitter(lat: float, lng: float, radius_km: float = 0.4, rng: random.Random | None = None) -> tuple[float, float]:
    rng = rng or random
    # ~0.009 deg = 1km at this latitude — close enough for demo clustering.
    return lat + rng.uniform(-radius_km, radius_km) * 0.009, lng + rng.uniform(-radius_km, radius_km) * 0.009


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wipe", action="store_true", help="delete prior agent_events + verifications")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    with SessionLocal() as db:
        if args.wipe:
            db.execute(delete(AgentEvent))
            db.execute(delete(Verification))
            db.execute(delete(Issue))
            db.execute(delete(Crew))
            db.execute(delete(Citizen))
            db.commit()
            print("wiped prior demo rows")

        # Citizens
        citizens: list[Citizen] = []
        for phone, name in DEMO_CITIZENS:
            existing = db.scalar(select(Citizen).where(Citizen.phone == phone))
            if existing:
                citizens.append(existing)
                continue
            c = Citizen(id=uuid.uuid4(), phone=phone, name=name, xp=rng.randint(0, 350))
            db.add(c)
            citizens.append(c)

        # Crews
        for name, dept, lat, lng, skills, cap in DEMO_CREWS:
            existing = db.scalar(select(Crew).where(Crew.name == name))
            if existing:
                continue
            db.add(
                Crew(
                    id=uuid.uuid4(),
                    name=name,
                    department=dept,
                    depot_location=from_shape(Point(lng, lat), srid=4326),
                    skills=skills,
                    daily_capacity=cap,
                )
            )

        db.flush()
        print(f"seeded {len(citizens)} citizens, {len(DEMO_CREWS)} crews")

        # Issues
        now = datetime.now(timezone.utc)
        for idx, (kind, desc, sev) in enumerate(DEMO_ISSUE_TEMPLATES):
            nbhd = NEIGHBOURHOODS[idx % len(NEIGHBOURHOODS)]
            lat, lng = jitter(nbhd[1], nbhd[2], rng=rng)
            reporter = rng.choice(citizens)
            db.add(
                Issue(
                    id=uuid.uuid4(),
                    reporter_id=reporter.id,
                    type=IssueType(kind),
                    severity=sev,
                    status=rng.choice([IssueStatus.TRIAGED, IssueStatus.VERIFIED, IssueStatus.SCHEDULED]),
                    location=from_shape(Point(lng, lat), srid=4326),
                    address=f"{nbhd[0]} — {idx + 1}",
                    ward=nbhd[3],
                    description=desc,
                    routed_department=_dept_for(kind),
                    sla_deadline=now + timedelta(hours=rng.choice([6, 12, 24, 48, 72])),
                    created_at=now - timedelta(hours=rng.randint(1, 96)),
                )
            )

        db.commit()
        print(f"seeded {len(DEMO_ISSUE_TEMPLATES)} demo issues across {len(NEIGHBOURHOODS)} neighbourhoods")
        print("\nready: hit POST /issues from /report, or open /map to see them.")


def _dept_for(kind: str) -> str:
    return {
        "pothole": "BBMP Roads",
        "garbage": "BBMP SWM",
        "streetlight": "BESCOM Streetlight",
        "water_leak": "BWSSB",
        "sewage": "BWSSB",
        "tree_fall": "BBMP Horticulture",
        "encroachment": "BBMP Town Planning",
    }.get(kind, "BBMP Helpdesk")


if __name__ == "__main__":
    main()
