"""MILP scheduling endpoint — solves CVRPTW for a given day and returns routes."""

from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.milp.cvrptw import CVRPTWInput, IssueNode, CrewVehicle, solve_cvrptw
from nagarik.models import Crew, Issue, IssueStatus
from nagarik.schemas import ScheduleRequest, ScheduleResponse

router = APIRouter(prefix="/schedule", tags=["schedule"])


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

    result = solve_cvrptw(CVRPTWInput(issues=nodes, crews=vehicles, date=target))
    return ScheduleResponse(**result)
