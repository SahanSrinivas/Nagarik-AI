"""Seed a realistic citizen leaderboard for the /impact page demo.

12 Indian-named citizens with XP spread across all 5 badge tiers, so the
leaderboard shows the gamification system populating naturally — not a
single account at 0 XP.

Names + XP are deterministic; re-running updates existing rows by username
rather than creating duplicates. Safe to run any number of times.

Run:
    PYTHONPATH=. python -m scripts.seed_leaderboard
"""

from __future__ import annotations

import uuid

from sqlalchemy import select

from nagarik.auth import hash_password
from nagarik.chain.badges import tier_for_xp
from nagarik.db import SessionLocal
from nagarik.models import Citizen

# (username, full name, ward, XP).  XP picked to populate every tier:
#   2500 → Civic Hero · 1000 → Sentinel · 500 → Watchdog · 250 → Verifier · 100 → Reporter
SEED: list[tuple[str, str, str, int]] = [
    ("priya.iyer",      "Priya Iyer",      "Indiranagar",  2890),
    ("ramesh.k",        "Ramesh Krishnan", "Koramangala",  1820),
    ("anjali.sharma",   "Anjali Sharma",   "HSR Layout",   1245),
    ("karthik.n",       "Karthik Narayan", "Jayanagar",    1085),
    ("meera.patel",     "Meera Patel",     "Malleshwaram",  815),
    ("vikram.reddy",    "Vikram Reddy",    "BTM Layout",    640),
    ("suresh.kumar",    "Suresh Kumar",    "Hebbal",        545),
    ("lakshmi.nair",    "Lakshmi Nair",    "Marathahalli",  410),
    ("arjun.menon",     "Arjun Menon",     "Hongasandra",   335),
    ("deepika.rao",     "Deepika Rao",     "Sanjayanagar",  265),
    ("rajesh.gupta",    "Rajesh Gupta",    "Koramangala",   195),
    ("sneha.joshi",     "Sneha Joshi",     "Indiranagar",   140),
]


def main() -> None:
    common_pw = hash_password("demo")  # all dummies share the same password — demo only
    with SessionLocal() as db:
        created, updated = 0, 0
        for idx, (uname, name, ward, xp) in enumerate(SEED):
            tier = tier_for_xp(xp)
            badge = tier[1] if tier else None
            existing = db.scalar(select(Citizen).where(Citizen.username == uname))
            if existing:
                existing.name = name
                existing.ward = ward
                existing.xp = xp
                existing.badge = badge
                updated += 1
            else:
                # Stable demo phone derived from username so re-runs don't collide.
                phone = f"+91999{(1000 + idx):04d}"
                db.add(Citizen(
                    id=uuid.uuid4(),
                    username=uname,
                    password_hash=common_pw,
                    name=name,
                    phone=phone,
                    ward=ward,
                    xp=xp,
                    badge=badge,
                ))
                created += 1
        db.commit()
        print(f"seeded leaderboard: {created} created, {updated} updated")
        # Print summary by tier
        from collections import Counter
        tiers = Counter(c[3] // 500 * 500 for c in SEED)  # rough band
        print(f"  XP bands: {dict(tiers)}")
        print("Visit /impact to see the leaderboard.")


if __name__ == "__main__":
    main()
