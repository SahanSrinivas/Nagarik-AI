"""Citizen-facing tracking — combines issue state + notifications into a
single timeline rendered on /tracking/[id]."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2.shape import to_shape
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.models import Citizen, Crew, Issue
from nagarik.notifications import Notification

router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.get("/{issue_id}")
def tracking(issue_id: uuid.UUID, db: Session = Depends(get_db)) -> dict:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")

    reporter = db.get(Citizen, issue.reporter_id)
    crew = db.get(Crew, issue.assigned_crew_id) if issue.assigned_crew_id else None
    pt = to_shape(issue.location)

    notifs = db.scalars(
        select(Notification)
        .where(Notification.issue_id == issue.id)
        .order_by(Notification.created_at.asc())
    ).all()

    return {
        "issue": {
            "id": str(issue.id),
            "type": getattr(issue.type, "value", str(issue.type)),
            "severity": issue.severity,
            "status": getattr(issue.status, "value", str(issue.status)),
            "address": issue.address,
            "ward": issue.ward,
            "lat": pt.y,
            "lng": pt.x,
            "description": issue.description,
            "before_photo_url": issue.before_photo_url,
            "after_photo_url": issue.after_photo_url,
            "routed_department": issue.routed_department,
            "sla_deadline": issue.sla_deadline.isoformat() if issue.sla_deadline else None,
            "scheduled_at": issue.scheduled_at.isoformat() if issue.scheduled_at else None,
            "resolved_at": issue.resolved_at.isoformat() if issue.resolved_at else None,
            "created_at": issue.created_at.isoformat(),
        },
        "reporter": {
            "id": str(reporter.id) if reporter else None,
            "name": reporter.name if reporter else None,
            "xp": reporter.xp if reporter else 0,
        },
        "crew": {
            "id": str(crew.id),
            "name": crew.name,
            "department": crew.department,
        } if crew else None,
        "timeline": [
            {
                "id": str(n.id),
                "kind": n.kind,
                "title": n.title,
                "body": n.body,
                "channel": n.channel,
                "created_at": n.created_at.isoformat(),
                "read_at": n.read_at.isoformat() if n.read_at else None,
            }
            for n in notifs
        ],
    }


@router.post("/{issue_id}/read")
def mark_read(issue_id: uuid.UUID, db: Session = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    db.execute(
        update(Notification)
        .where(Notification.issue_id == issue_id, Notification.read_at.is_(None))
        .values(read_at=now)
    )
    db.commit()
    return {"marked_read_at": now.isoformat()}
