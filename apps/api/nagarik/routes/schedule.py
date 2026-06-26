"""MILP scheduling endpoint — solves CVRPTW for a given day and returns routes."""

from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.milp.cvrptw import CVRPTWInput, IssueNode, CrewVehicle, solve_cvrptw, naive_fifo_baseline
from nagarik.models import Crew, Issue, IssueStatus
from nagarik.schemas import ScheduleRequest, ScheduleResponse

router = APIRouter(prefix="/schedule", tags=["schedule"])


def _enrich_routes(routes: list[dict], crews: list[Crew], issues: list[Issue]) -> list[dict]:
    """Decorate solver output with lat/lng + crew name so the map can draw polylines.

    Also merges the solver's per-stop ``stop_times`` (arrival_clock_min,
    depart_clock_min, service_min, travel_min_from_prev) back onto the
    matching stop so the schedule board can render an HH:MM timeline.
    """
    crew_by_id = {str(c.id): c for c in crews}
    issue_by_id = {str(i.id): i for i in issues}
    enriched: list[dict] = []
    for r in routes:
        crew = crew_by_id.get(r["crew_id"])
        if crew is None:
            continue
        depot = to_shape(crew.depot_location)
        # Index stop_times by issue_id so we can join in O(1).
        time_by_id = {s["issue_id"]: s for s in r.get("stop_times", [])}
        stops = []
        for iid in r["sequence"]:
            iss = issue_by_id.get(iid)
            if iss is None:
                continue
            p = to_shape(iss.location)
            t = time_by_id.get(iid, {})
            stops.append({
                "issue_id": iid,
                "lat": p.y,
                "lng": p.x,
                "type": getattr(iss.type, "value", str(iss.type)),
                "severity": iss.severity,
                "address": iss.address,
                "arrival_clock_min": t.get("arrival_clock_min"),
                "depart_clock_min":  t.get("depart_clock_min"),
                "service_min":       t.get("service_min"),
                "travel_min_from_prev": t.get("travel_min_from_prev"),
            })
        enriched.append({
            "crew_id": r["crew_id"],
            "crew_name": crew.name,
            "department": crew.department,
            "depot": {"lat": depot.y, "lng": depot.x},
            "stops": stops,
            "total_km": r["total_km"],
            "total_time_min": r.get("total_time_min", 0),
            "shift_start_hour": r.get("shift_start_hour", crew.shift_start_hour),
            "shift_end_hour":   r.get("shift_end_hour",   crew.shift_end_hour),
        })
    return enriched


@router.post("/solve", response_model=ScheduleResponse)
def solve(req: ScheduleRequest, db: Session = Depends(get_db)) -> ScheduleResponse:
    try:
        target = datetime.fromisoformat(req.date).date()
    except ValueError as e:
        raise HTTPException(400, "date must be YYYY-MM-DD") from e

    crew_stmt = select(Crew).where(Crew.is_active.is_(True))
    if req.ward:
        crew_stmt = crew_stmt.where(Crew.department.ilike(f"%{req.ward}%"))
    crews = db.scalars(crew_stmt).all()
    if req.max_crews:
        crews = crews[: req.max_crews]
    if not crews:
        raise HTTPException(400, "no active crews available")

    issue_stmt = select(Issue).where(
        Issue.status.in_([IssueStatus.VERIFIED, IssueStatus.TRIAGED]),
        Issue.duplicate_of_id.is_(None),
    )
    if req.ward:
        issue_stmt = issue_stmt.where(Issue.ward == req.ward)
    open_issues = db.scalars(issue_stmt.limit(200)).all()

    if not open_issues:
        return ScheduleResponse(
            solver_status="empty", runtime_seconds=0.0, routes=[], metrics={"served": 0}
        )

    nodes = [
        IssueNode(
            id=str(i.id),
            lat=to_shape(i.location).y,
            lng=to_shape(i.location).x,
            type=i.type.value if hasattr(i.type, "value") else str(i.type),
            severity=i.severity,
            sla_deadline=i.sla_deadline or datetime.combine(target, time(18, 0), tzinfo=timezone.utc),
            service_minutes=20,
        )
        for i in open_issues
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

    payload = CVRPTWInput(issues=nodes, crews=vehicles, date=target)
    result = solve_cvrptw(payload)
    # Enrich with coordinates + crew names so the frontend can draw the map.
    result["routes"] = _enrich_routes(result.get("routes", []), list(crews), list(open_issues))
    return ScheduleResponse(**result)


@router.post("/compare", response_model=dict)
def compare(req: ScheduleRequest, db: Session = Depends(get_db)) -> dict:
    """Side-by-side comparison: naive FIFO baseline vs MILP optimized.

    This is the demo-killing endpoint — judges see concrete %-improvement numbers
    computed on whatever live data the DB holds.
    """
    target = datetime.fromisoformat(req.date).date()
    crews = list(db.scalars(select(Crew).where(Crew.is_active.is_(True))).all())
    open_issues = list(
        db.scalars(
            select(Issue)
            .where(
                Issue.status.in_([IssueStatus.VERIFIED, IssueStatus.TRIAGED]),
                Issue.duplicate_of_id.is_(None),
            )
            .limit(200)
        ).all()
    )
    if not crews or not open_issues:
        raise HTTPException(400, "need crews + open issues for comparison")

    nodes = [
        IssueNode(
            id=str(i.id),
            lat=to_shape(i.location).y,
            lng=to_shape(i.location).x,
            type=i.type.value if hasattr(i.type, "value") else str(i.type),
            severity=i.severity,
            sla_deadline=i.sla_deadline or datetime.combine(target, time(18, 0), tzinfo=timezone.utc),
            service_minutes=20,
        )
        for i in open_issues
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
    payload = CVRPTWInput(issues=nodes, crews=vehicles, date=target)
    fifo = naive_fifo_baseline(payload)
    milp = solve_cvrptw(payload)

    def _pct(a: float, b: float) -> float | None:
        return None if not a else round(100 * (1 - b / a), 1)

    return {
        "fifo": fifo["metrics"],
        "milp": milp["metrics"],
        "improvement": {
            "km_reduction_pct": _pct(fifo["metrics"].get("total_km", 0), milp["metrics"].get("total_km", 0)),
            "additional_served": (milp["metrics"].get("served", 0)) - (fifo["metrics"].get("served", 0)),
        },
        "n_issues": len(open_issues),
        "n_crews": len(crews),
    }
