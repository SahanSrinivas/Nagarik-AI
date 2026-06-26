"""Crew-facing endpoints — what a BBMP Roads driver opens on their phone.

`/crew/{crew_id}/today` returns the MILP-assigned stops for today + a
summary header. `/crew/.../start` and `/crew/.../complete` advance status
and trigger the ResolutionAgent on completion.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from geoalchemy2.shape import to_shape
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from nagarik.agents.graph import run_agent_loop
from nagarik.db import get_db
from nagarik.models import Crew, Issue, IssueStatus

router = APIRouter(prefix="/crew", tags=["crew"])


@router.get("/{crew_id}/today")
def todays_route(crew_id: uuid.UUID, db: Session = Depends(get_db)) -> dict:
    crew = db.get(Crew, crew_id)
    if crew is None:
        raise HTTPException(404, "crew not found")

    today = date.today()
    start_of_day = datetime.combine(today, time(0, 0), tzinfo=timezone.utc)
    end_of_day = datetime.combine(today, time(23, 59, 59), tzinfo=timezone.utc)

    stmt = (
        select(Issue)
        .where(
            Issue.assigned_crew_id == crew.id,
            Issue.status.in_([IssueStatus.SCHEDULED, IssueStatus.IN_PROGRESS]),
            Issue.scheduled_at.between(start_of_day, end_of_day),
        )
        .order_by(Issue.scheduled_at.asc())
    )
    stops = []
    for issue in db.scalars(stmt).all():
        pt = to_shape(issue.location)
        stops.append({
            "id": str(issue.id),
            "type": getattr(issue.type, "value", str(issue.type)),
            "severity": issue.severity,
            "status": getattr(issue.status, "value", str(issue.status)),
            "address": issue.address,
            "ward": issue.ward,
            "lat": pt.y,
            "lng": pt.x,
            "description": (issue.description or "")[:160],
            "before_photo_url": issue.before_photo_url,
            "after_photo_url": issue.after_photo_url,
            "scheduled_at": issue.scheduled_at.isoformat() if issue.scheduled_at else None,
            "sla_deadline": issue.sla_deadline.isoformat() if issue.sla_deadline else None,
        })

    depot = to_shape(crew.depot_location)
    return {
        "crew": {
            "id": str(crew.id),
            "name": crew.name,
            "department": crew.department,
            "skills": list(crew.skills or []),
            "depot": {"lat": depot.y, "lng": depot.x},
            "shift_start_hour": crew.shift_start_hour,
            "shift_end_hour": crew.shift_end_hour,
        },
        "date": today.isoformat(),
        "stops": stops,
        "summary": {
            "total": len(stops),
            "completed": sum(1 for s in stops if s["after_photo_url"]),
            "in_progress": sum(1 for s in stops if s["status"] == "in_progress"),
        },
    }


@router.post("/{crew_id}/start/{issue_id}")
def start_stop(
    crew_id: uuid.UUID,
    issue_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> dict:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")
    if issue.assigned_crew_id != crew_id:
        raise HTTPException(403, "not assigned to this crew")

    db.execute(
        update(Issue)
        .where(Issue.id == issue_id)
        .values(status=IssueStatus.IN_PROGRESS)
    )
    db.commit()

    # Tell the citizen.
    from nagarik.notifications import emit
    emit(str(issue_id), "in_progress")
    return {"id": str(issue_id), "status": "in_progress"}


@router.post("/{crew_id}/complete/{issue_id}")
def complete_stop(
    crew_id: uuid.UUID,
    issue_id: uuid.UUID,
    after_photo_url: str,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    """Crew uploads the after-photo. Triggers ResolutionAgent (CLIP + CNN audit)."""
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")
    if issue.assigned_crew_id != crew_id:
        raise HTTPException(403, "not assigned to this crew")
    if not after_photo_url:
        raise HTTPException(400, "after_photo_url required")

    db.execute(
        update(Issue)
        .where(Issue.id == issue_id)
        .values(after_photo_url=after_photo_url, status=IssueStatus.IN_PROGRESS)
    )
    db.commit()

    # Re-fire the agent loop; ResolutionAgent will now have an after-photo to score.
    bg.add_task(run_agent_loop, str(issue_id))

    return {
        "id": str(issue_id),
        "after_photo_url": after_photo_url,
        "next": "ResolutionAgent will verify within ~3s (CLIP scene + pothole CNN)",
    }
