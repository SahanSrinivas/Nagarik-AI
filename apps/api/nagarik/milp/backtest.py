"""Run the MILP solver and the naive FIFO baseline on the same issue set,
print the comparison numbers that go on the pitch deck.

Usage:
    python -m nagarik.milp.backtest --issues 100 --crews 8
"""

from __future__ import annotations

import argparse
import random
from datetime import date, datetime, timedelta, timezone

from nagarik.milp.cvrptw import (
    CVRPTWInput,
    CrewVehicle,
    IssueNode,
    naive_fifo_baseline,
    solve_cvrptw,
)

# Rough Bangalore bounding box.
BLR_LAT = (12.85, 13.10)
BLR_LNG = (77.45, 77.75)
TYPES = ["pothole", "garbage", "streetlight", "water_leak", "sewage"]


def synth(n_issues: int, n_crews: int, seed: int = 7) -> CVRPTWInput:
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    issues = [
        IssueNode(
            id=f"i{i:04d}",
            lat=rng.uniform(*BLR_LAT),
            lng=rng.uniform(*BLR_LNG),
            type=rng.choice(TYPES),
            severity=rng.randint(1, 5),
            sla_deadline=now + timedelta(hours=rng.randint(4, 96)),
            service_minutes=rng.choice([15, 20, 30]),
        )
        for i in range(n_issues)
    ]
    crews = [
        CrewVehicle(
            id=f"c{c:02d}",
            depot_lat=rng.uniform(*BLR_LAT),
            depot_lng=rng.uniform(*BLR_LNG),
            skills=rng.sample(TYPES, k=rng.randint(2, 4)),
            capacity=rng.randint(6, 12),
        )
        for c in range(n_crews)
    ]
    return CVRPTWInput(issues=issues, crews=crews, date=date.today())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--issues", type=int, default=100)
    parser.add_argument("--crews", type=int, default=8)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    payload = synth(args.issues, args.crews, args.seed)

    print(f"\n=== Backtest: {args.issues} issues, {args.crews} crews ===\n")

    fifo = naive_fifo_baseline(payload)
    milp = solve_cvrptw(payload)

    rows = [
        ("Served issues",   fifo["metrics"]["served"], milp["metrics"]["served"]),
        ("Unserved",        fifo["metrics"]["unserved"], milp["metrics"]["unserved"]),
        ("Total km driven", fifo["metrics"]["total_km"], milp["metrics"]["total_km"]),
        ("Solver runtime (s)", fifo["runtime_seconds"], milp["runtime_seconds"]),
    ]
    print(f"{'Metric':<22} {'FIFO baseline':>16} {'MILP optimized':>18}")
    print("-" * 60)
    for name, a, b in rows:
        print(f"{name:<22} {a!s:>16} {b!s:>18}")

    if fifo["metrics"]["total_km"]:
        km_saving = 100 * (1 - milp["metrics"]["total_km"] / fifo["metrics"]["total_km"])
        print(f"\nDistance reduction: {km_saving:.1f}%")
    served_gain = milp["metrics"]["served"] - fifo["metrics"]["served"]
    print(f"Additional issues served: {served_gain}")


if __name__ == "__main__":
    main()
