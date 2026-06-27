"""Seed 2 crews per department with realistic Bengaluru depot locations + skills.

Idempotent — checks (department, name) uniqueness before inserting. Without
this, the Scheduler agent has nothing to assign and the Resolution path
can never close end-to-end. Departments are pulled from the same SOP_TABLE
that seed_departments.py uses, so the two seed scripts stay aligned.

Run:
    PYTHONPATH=. python -m scripts.seed_crews
"""

from __future__ import annotations

import uuid
from collections import OrderedDict

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import select

from nagarik.agents.guardrails import SOP_TABLE
from nagarik.db import SessionLocal
from nagarik.models import Crew

# Two depots per dept, chosen roughly across north + south Bengaluru so the
# MILP CVRPTW solver has interesting routing to do. Coordinates are public
# landmarks (BBMP ward offices) — nothing sensitive here.
CREW_TEMPLATES: dict[str, list[dict]] = {
    "BBMP Roads": [
        {"name": "Roads North · Hebbal",   "lat": 13.0358, "lng": 77.5970, "skills": ["pothole"]},
        {"name": "Roads South · Banashankari", "lat": 12.9249, "lng": 77.5469, "skills": ["pothole"]},
    ],
    "BBMP SWM": [
        {"name": "SWM Central · Shivajinagar", "lat": 12.9853, "lng": 77.6051, "skills": ["garbage"]},
        {"name": "SWM East · Indiranagar",     "lat": 12.9716, "lng": 77.6412, "skills": ["garbage"]},
    ],
    "BESCOM Streetlight": [
        {"name": "BESCOM North · Yelahanka", "lat": 13.1007, "lng": 77.5963, "skills": ["streetlight"]},
        {"name": "BESCOM South · Jayanagar", "lat": 12.9279, "lng": 77.5832, "skills": ["streetlight"]},
    ],
    "BWSSB": [
        {"name": "BWSSB West · Malleshwaram", "lat": 13.0036, "lng": 77.5712, "skills": ["water_leak", "sewage"]},
        {"name": "BWSSB East · Whitefield",   "lat": 12.9698, "lng": 77.7500, "skills": ["water_leak", "sewage"]},
    ],
    "BBMP Horticulture": [
        {"name": "Hort · Cubbon Park",  "lat": 12.9763, "lng": 77.5929, "skills": ["tree_fall"]},
        {"name": "Hort · Lalbagh",      "lat": 12.9507, "lng": 77.5848, "skills": ["tree_fall"]},
    ],
    "BBMP Town Planning": [
        {"name": "Town Planning · BTM",     "lat": 12.9166, "lng": 77.6101, "skills": ["encroachment"]},
        {"name": "Town Planning · Koramangala", "lat": 12.9352, "lng": 77.6245, "skills": ["encroachment"]},
    ],
    "BBMP Helpdesk": [
        {"name": "Helpdesk · Central",   "lat": 12.9716, "lng": 77.5946, "skills": ["other"]},
    ],
}


def main() -> None:
    # Departments come from the same SOP table the dept seeder uses, so the
    # two scripts can never drift.
    unique_depts: "OrderedDict[str, None]" = OrderedDict()
    for _, (dept_name, _sla) in SOP_TABLE.items():
        unique_depts.setdefault(dept_name, None)

    print(f"Seeding crews across {len(unique_depts)} departments...")

    inserted = 0
    skipped = 0
    with SessionLocal() as db:
        for dept_name in unique_depts:
            templates = CREW_TEMPLATES.get(dept_name, [])
            if not templates:
                print(f"  ! {dept_name}: no template — add one to seed_crews.CREW_TEMPLATES")
                continue
            for tpl in templates:
                existing = db.scalar(
                    select(Crew).where(Crew.department == dept_name, Crew.name == tpl["name"])
                )
                if existing is not None:
                    skipped += 1
                    print(f"  · {dept_name:22s} {tpl['name']!r:<42}  (already present)")
                    continue
                pt = Point(tpl["lng"], tpl["lat"])
                db.add(Crew(
                    id=uuid.uuid4(),
                    name=tpl["name"],
                    department=dept_name,
                    depot_location=from_shape(pt, srid=4326),
                    skills=tpl["skills"],
                    daily_capacity=8,
                    shift_start_hour=9,
                    shift_end_hour=18,
                    is_active=True,
                ))
                inserted += 1
                print(f"  + {dept_name:22s} {tpl['name']!r:<42}  skills={tpl['skills']}")
        db.commit()

    print()
    print(f"Done. inserted={inserted}  skipped={skipped}")


if __name__ == "__main__":
    main()
