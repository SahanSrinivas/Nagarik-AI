"""Run the FIFO-vs-MILP backtest on the issues currently in Postgres.

After running scripts/ingest_bbmp_backlog.py the DB holds real BBMP-derived
issues across 243 real Bengaluru wards. This script lifts them, calls the
two solvers head-to-head, and prints the comparison numbers we put in
docs/PITCH.md.

Usage:
    python -m scripts.run_real_backtest             # all open issues
    python -m scripts.run_real_backtest --cap 800   # cap issue count
"""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime, time, timezone
from pathlib import Path

from geoalchemy2.shape import to_shape
from sqlalchemy import select

from nagarik.db import SessionLocal
from nagarik.milp.cvrptw import CVRPTWInput, CrewVehicle, IssueNode, naive_fifo_baseline, solve_cvrptw
from nagarik.models import Crew, Issue, IssueStatus


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cap", type=int, default=600, help="cap how many issues to feed the solver")
    ap.add_argument("--out", type=Path, default=Path("../../data/processed/backtest.json"))
    args = ap.parse_args()

    with SessionLocal() as db:
        crews = list(db.scalars(select(Crew).where(Crew.is_active.is_(True))).all())
        issues = list(
            db.scalars(
                select(Issue)
                .where(
                    Issue.status.in_([IssueStatus.VERIFIED, IssueStatus.TRIAGED]),
                    Issue.duplicate_of_id.is_(None),
                )
                .limit(args.cap)
            ).all()
        )

    if not crews or not issues:
        print(f"need both crews ({len(crews)}) and issues ({len(issues)}) in DB")
        return 1

    today = date.today()
    nodes = [
        IssueNode(
            id=str(i.id),
            lat=to_shape(i.location).y,
            lng=to_shape(i.location).x,
            type=i.type.value if hasattr(i.type, "value") else str(i.type),
            severity=i.severity,
            sla_deadline=i.sla_deadline or datetime.combine(today, time(18, 0), tzinfo=timezone.utc),
            service_minutes=20,
        )
        for i in issues
    ]
    vehicles = [
        CrewVehicle(
            id=str(c.id),
            depot_lat=to_shape(c.depot_location).y,
            depot_lng=to_shape(c.depot_location).x,
            skills=list(c.skills or []),
            capacity=c.daily_capacity,
            shift_start_hour=c.shift_start_hour,
            shift_end_hour=c.shift_end_hour,
        )
        for c in crews
    ]
    payload = CVRPTWInput(issues=nodes, crews=vehicles, date=today)

    print(f"\n=== Backtest on real BBMP backlog ===")
    print(f"issues fed to solver: {len(nodes):,} (capped)  ·  crews: {len(vehicles)}\n")

    fifo = naive_fifo_baseline(payload)
    milp = solve_cvrptw(payload)

    rows = [
        ("Served issues",   fifo["metrics"]["served"],   milp["metrics"]["served"]),
        ("Unserved",        fifo["metrics"]["unserved"], milp["metrics"]["unserved"]),
        ("Total km driven", fifo["metrics"]["total_km"], milp["metrics"]["total_km"]),
        ("Solver runtime (s)", fifo["runtime_seconds"],  milp["runtime_seconds"]),
    ]
    print(f"{'Metric':<22} {'FIFO baseline':>16} {'MILP optimized':>18}")
    print("-" * 60)
    for name, a, b in rows:
        print(f"{name:<22} {a!s:>16} {b!s:>18}")

    summary: dict[str, object] = {
        "source": "real BBMP backlog via community-hero/data/ward_backlog.json (OpenCity / Janaagraha H1-2025)",
        "n_issues": len(nodes),
        "n_crews": len(vehicles),
        "fifo_metrics": fifo["metrics"],
        "milp_metrics": milp["metrics"],
    }
    if fifo["metrics"]["total_km"]:
        km_saving = 100 * (1 - milp["metrics"]["total_km"] / fifo["metrics"]["total_km"])
        print(f"\nDistance reduction: {km_saving:.1f}%")
        summary["km_reduction_pct"] = round(km_saving, 1)
    served_gain = milp["metrics"]["served"] - fifo["metrics"]["served"]
    print(f"Additional issues served: {served_gain}")
    summary["additional_served"] = served_gain

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(summary, indent=2, default=str))
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
