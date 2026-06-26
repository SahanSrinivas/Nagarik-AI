"""Department supervisor surface — the OTHER side of the citizen app.

A supervisor logs in at /dept-login → JWT carries their department_id →
these endpoints filter every ticket / stat / delivery-log entry by that
department. Crew leads share most read endpoints but can't ack or
reassign.

Routes:
  GET  /supervisor/me              # alias of /auth/dept-me for convenience
  GET  /supervisor/queue           # open tickets for the dept, SLA-sorted
  GET  /supervisor/issue/{id}      # detail for one ticket
  POST /supervisor/issue/{id}/ack  # mark as acked_by_dept
  POST /supervisor/issue/{id}/escalate  # manual escalation bump
  POST /supervisor/issue/{id}/reassign-crew  # override MILP pick
  GET  /supervisor/stats           # today's KPIs
  GET  /supervisor/delivery-log    # tail of data/delivery_log.jsonl filtered by dept
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.shape import to_shape
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from nagarik.auth import current_dept_user
from nagarik.db import get_db
from nagarik.delivery import recent_log_entries
from nagarik.models import AgentEvent, Crew, Department, DepartmentUser, Issue, IssueStatus

router = APIRouter(prefix="/supervisor", tags=["supervisor"])

OPEN_STATUSES = (
    IssueStatus.TRIAGED,
    IssueStatus.VERIFIED,
    IssueStatus.SCHEDULED,
    IssueStatus.IN_PROGRESS,
)


def _to_queue_row(issue: Issue, now: datetime) -> dict[str, Any]:
    pt = to_shape(issue.location)
    sla_remaining_min: int | None = None
    sla_tone = "green"
    if issue.sla_deadline:
        delta = (issue.sla_deadline - now).total_seconds() / 60
        sla_remaining_min = int(delta)
        if delta < 0:
            sla_tone = "red"
        elif delta < 120:
            sla_tone = "amber"
    return {
        "id": str(issue.id),
        "type": getattr(issue.type, "value", str(issue.type)),
        "severity": issue.severity,
        "status": getattr(issue.status, "value", str(issue.status)),
        "ward": issue.ward,
        "address": issue.address,
        "lat": pt.y,
        "lng": pt.x,
        "description": (issue.description or "")[:200],
        "before_photo_url": issue.before_photo_url,
        "before_video_url": getattr(issue, "before_video_url", None),
        "delivered_at": issue.delivered_at.isoformat() if issue.delivered_at else None,
        "delivered_channel": issue.delivered_channel,
        "acked_at": issue.acked_at.isoformat() if issue.acked_at else None,
        "escalation_level": int(issue.escalation_level or 0),
        "sla_deadline": issue.sla_deadline.isoformat() if issue.sla_deadline else None,
        "sla_remaining_min": sla_remaining_min,
        "sla_tone": sla_tone,
        "created_at": issue.created_at.isoformat(),
    }


@router.get("/me")
def supervisor_me(
    user: Annotated[DepartmentUser, Depends(current_dept_user)],
    db: Session = Depends(get_db),
) -> dict:
    dept = db.get(Department, user.department_id)
    return {
        "id": str(user.id),
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "department": {
            "id": str(dept.id) if dept else None,
            "code": dept.code if dept else None,
            "name": dept.name if dept else None,
            "primary_channel": dept.primary_channel if dept else None,
            "whatsapp_number": dept.whatsapp_number if dept else None,
            "email": dept.email if dept else None,
        } if dept else None,
    }


@router.get("/queue")
def queue(
    user: Annotated[DepartmentUser, Depends(current_dept_user)],
    db: Session = Depends(get_db),
    only_open: bool = Query(True, description="Hide resolved/rejected by default"),
    limit: int = Query(100, le=500),
) -> dict:
    dept = db.get(Department, user.department_id)
    if dept is None:
        raise HTTPException(404, "department not found")
    now = datetime.now(timezone.utc)
    stmt = select(Issue).where(Issue.routed_department == dept.name)
    if only_open:
        stmt = stmt.where(Issue.status.in_(OPEN_STATUSES))
    stmt = stmt.order_by(
        # Breached first (sla_deadline ASC NULLS LAST is what we want, but the
        # simplest portable expression is by sla_deadline ASC — NULLs sort last
        # in PG by default with ASC).
        Issue.sla_deadline.asc().nullslast(),
        Issue.severity.desc(),
    ).limit(limit)
    rows = [_to_queue_row(i, now) for i in db.scalars(stmt).all()]
    summary = {
        "total": len(rows),
        "breached": sum(1 for r in rows if r["sla_tone"] == "red"),
        "amber": sum(1 for r in rows if r["sla_tone"] == "amber"),
        "green": sum(1 for r in rows if r["sla_tone"] == "green"),
        "acked": sum(1 for r in rows if r["acked_at"]),
        "escalated": sum(1 for r in rows if r["escalation_level"] > 0),
    }
    return {"department": dept.name, "summary": summary, "items": rows}


@router.get("/issue/{issue_id}")
def issue_detail(
    issue_id: uuid.UUID,
    user: Annotated[DepartmentUser, Depends(current_dept_user)],
    db: Session = Depends(get_db),
) -> dict:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")
    dept = db.get(Department, user.department_id)
    if dept is None or issue.routed_department != dept.name:
        raise HTTPException(403, "issue is not routed to your department")

    crew = db.get(Crew, issue.assigned_crew_id) if issue.assigned_crew_id else None
    events = db.scalars(
        select(AgentEvent).where(AgentEvent.issue_id == issue.id)
        .order_by(AgentEvent.created_at.asc())
    ).all()
    pt = to_shape(issue.location)
    return {
        "issue": {
            **_to_queue_row(issue, datetime.now(timezone.utc)),
            "ai_classification": issue.ai_classification,
            "ai_confidence": issue.ai_confidence,
            "scheduled_at": issue.scheduled_at.isoformat() if issue.scheduled_at else None,
            "escalated_at": issue.escalated_at.isoformat() if issue.escalated_at else None,
        },
        "crew": {
            "id": str(crew.id),
            "name": crew.name,
            "department": crew.department,
        } if crew else None,
        "events": [
            {
                "agent": e.agent, "status": e.status,
                "duration_ms": e.duration_ms,
                "created_at": e.created_at.isoformat(),
                "payload": e.payload,
            } for e in events
        ],
    }


@router.post("/issue/{issue_id}/ack")
def ack(
    issue_id: uuid.UUID,
    user: Annotated[DepartmentUser, Depends(current_dept_user)],
    db: Session = Depends(get_db),
) -> dict:
    if user.role != "supervisor":
        raise HTTPException(403, "only supervisors can acknowledge tickets")
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")
    dept = db.get(Department, user.department_id)
    if dept is None or issue.routed_department != dept.name:
        raise HTTPException(403, "issue is not routed to your department")
    if issue.acked_at:
        return {"id": str(issue.id), "acked_at": issue.acked_at.isoformat(), "already_acked": True}

    now = datetime.now(timezone.utc)
    db.execute(update(Issue).where(Issue.id == issue.id).values(acked_at=now))
    db.commit()

    # Citizen-facing notification — closes the loop.
    from nagarik.notifications import emit
    emit(str(issue.id), "acked_by_dept", extras={"dept": dept.name})
    return {"id": str(issue.id), "acked_at": now.isoformat()}


@router.post("/issue/{issue_id}/escalate")
def escalate(
    issue_id: uuid.UUID,
    user: Annotated[DepartmentUser, Depends(current_dept_user)],
    db: Session = Depends(get_db),
) -> dict:
    """Manual supervisor bump — same effect as the watcher firing."""
    if user.role != "supervisor":
        raise HTTPException(403, "only supervisors can escalate manually")
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")
    dept = db.get(Department, user.department_id)
    if dept is None or issue.routed_department != dept.name:
        raise HTTPException(403, "issue is not routed to your department")
    new_level = min(3, int(issue.escalation_level or 0) + 1)
    now = datetime.now(timezone.utc)
    db.execute(
        update(Issue).where(Issue.id == issue.id)
        .values(escalation_level=new_level, escalated_at=now)
    )
    db.commit()
    from nagarik.notifications import emit
    emit(str(issue.id), f"escalated_lvl{new_level}", extras={"dept": dept.name, "level": new_level})
    return {"id": str(issue.id), "escalation_level": new_level}


@router.post("/issue/{issue_id}/reassign-crew")
def reassign_crew(
    issue_id: uuid.UUID,
    crew_id: uuid.UUID,
    user: Annotated[DepartmentUser, Depends(current_dept_user)],
    db: Session = Depends(get_db),
) -> dict:
    if user.role != "supervisor":
        raise HTTPException(403, "only supervisors can reassign crews")
    issue = db.get(Issue, issue_id)
    crew = db.get(Crew, crew_id)
    if issue is None or crew is None:
        raise HTTPException(404, "issue or crew not found")
    dept = db.get(Department, user.department_id)
    if dept is None or issue.routed_department != dept.name or crew.department != dept.name:
        raise HTTPException(403, "issue and crew must both belong to your department")
    db.execute(
        update(Issue).where(Issue.id == issue.id)
        .values(assigned_crew_id=crew.id, status=IssueStatus.SCHEDULED)
    )
    db.commit()
    return {"id": str(issue.id), "assigned_crew_id": str(crew.id), "crew_name": crew.name}


@router.get("/stats")
def stats(
    user: Annotated[DepartmentUser, Depends(current_dept_user)],
    db: Session = Depends(get_db),
) -> dict:
    """Today's KPIs for the supervisor dashboard."""
    dept = db.get(Department, user.department_id)
    if dept is None:
        raise HTTPException(404, "department not found")
    today = date.today()
    day_start = datetime.combine(today, time(0, 0), tzinfo=timezone.utc)
    day_end = datetime.combine(today, time(23, 59, 59), tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)

    base = select(Issue).where(Issue.routed_department == dept.name)
    opened_today = db.scalar(
        select(func.count()).select_from(Issue)
        .where(Issue.routed_department == dept.name,
               Issue.created_at.between(day_start, day_end))
    ) or 0
    acked_today = db.scalar(
        select(func.count()).select_from(Issue)
        .where(Issue.routed_department == dept.name,
               Issue.acked_at.between(day_start, day_end))
    ) or 0
    resolved_today = db.scalar(
        select(func.count()).select_from(Issue)
        .where(Issue.routed_department == dept.name,
               Issue.resolved_at.between(day_start, day_end))
    ) or 0
    open_now = db.scalar(
        select(func.count()).select_from(Issue)
        .where(Issue.routed_department == dept.name,
               Issue.status.in_(OPEN_STATUSES))
    ) or 0
    breached_now = db.scalar(
        select(func.count()).select_from(Issue)
        .where(Issue.routed_department == dept.name,
               Issue.status.in_(OPEN_STATUSES),
               Issue.sla_deadline.isnot(None),
               Issue.sla_deadline < now)
    ) or 0
    # SLA on-time = resolved within sla_deadline / total resolved (last 7 days).
    week_ago = now - timedelta(days=7)
    week_resolved = db.scalars(
        select(Issue).where(
            Issue.routed_department == dept.name,
            Issue.resolved_at.isnot(None),
            Issue.resolved_at >= week_ago,
        )
    ).all()
    on_time = sum(1 for i in week_resolved
                  if i.sla_deadline and i.resolved_at and i.resolved_at <= i.sla_deadline)
    on_time_pct = (on_time / len(week_resolved) * 100) if week_resolved else None

    return {
        "department": dept.name,
        "today": {
            "opened": int(opened_today),
            "acked": int(acked_today),
            "resolved": int(resolved_today),
        },
        "open_now": int(open_now),
        "breached_now": int(breached_now),
        "sla_ontime_7d_pct": round(on_time_pct, 1) if on_time_pct is not None else None,
        "resolved_7d": len(week_resolved),
    }


@router.get("/delivery-log")
def delivery_log(
    user: Annotated[DepartmentUser, Depends(current_dept_user)],
    db: Session = Depends(get_db),
    limit: int = Query(50, le=200),
) -> dict:
    """Filtered tail of data/delivery_log.jsonl — only entries for this dept."""
    dept = db.get(Department, user.department_id)
    if dept is None:
        raise HTTPException(404, "department not found")
    entries = recent_log_entries(limit=limit * 4)  # widen, then filter
    filtered = [e for e in entries if e.get("dept_code") == dept.code or e.get("dept") == dept.name]
    return {"department": dept.name, "entries": filtered[:limit]}


@router.get("/crews")
def crews_for_dept(
    user: Annotated[DepartmentUser, Depends(current_dept_user)],
    db: Session = Depends(get_db),
) -> dict:
    """List crews of the supervisor's department — used by the reassign UI."""
    dept = db.get(Department, user.department_id)
    if dept is None:
        raise HTTPException(404, "department not found")
    crews = db.scalars(
        select(Crew).where(Crew.department == dept.name, Crew.is_active.is_(True))
        .order_by(Crew.name)
    ).all()
    return {
        "crews": [
            {"id": str(c.id), "name": c.name, "skills": list(c.skills or []),
             "daily_capacity": c.daily_capacity}
            for c in crews
        ]
    }
