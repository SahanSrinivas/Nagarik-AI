"""Predictive insights — risk heatmap, top wards, leaderboard."""

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.models import Citizen, Issue, IssueStatus

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/ward-stats")
def ward_stats(db: Session = Depends(get_db)) -> list[dict]:
    stmt = (
        select(
            Issue.ward,
            func.count(Issue.id).label("total"),
            func.count(Issue.id)
            .filter(Issue.status == IssueStatus.RESOLVED)
            .label("resolved"),
        )
        .where(Issue.ward.is_not(None))
        .group_by(Issue.ward)
        .order_by(desc("total"))
        .limit(20)
    )
    return [
        {"ward": r.ward, "total": r.total, "resolved": r.resolved}
        for r in db.execute(stmt).all()
    ]


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Citizen).order_by(Citizen.xp.desc()).limit(20)
    return [
        {"id": str(c.id), "name": c.name or "Anonymous", "xp": c.xp, "badge": c.badge}
        for c in db.scalars(stmt).all()
    ]


@router.get("/hotspot-prediction")
def hotspot_prediction(db: Session = Depends(get_db)) -> list[dict]:
    """Placeholder — replaced in Week 3 by LightGBM model output."""
    return [
        {
            "lat": 12.9716,
            "lng": 77.5946,
            "risk": 0.78,
            "type": "pothole",
            "horizon_days": 30,
            "drivers": ["high rainfall forecast", "high traffic", "history density"],
        }
    ]
