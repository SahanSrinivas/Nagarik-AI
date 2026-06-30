"""Community DIY + crowdfunding — citizen-side pledge endpoints.

Flow:
  1. SLA watcher promotes a sev≤2 issue to escalation_level=3 and sets
     `diy_unlocked_at`. Only after that does the UI surface the pledge module.
  2. Citizens hit POST /issues/{id}/pledges with kind=funds (₹) or hours.
     Pledges are MOCK — no payment gateway runs. The intent counts.
  3. After every pledge we re-evaluate the thresholds. When ANY of:
        Σ hours ≥ HOURS_THRESHOLD
        Σ amount_inr ≥ FUNDS_THRESHOLD
     is true and we haven't already crossed, we:
        - set `diy_threshold_met_at`
        - synthesise a `diy_schedule` (deterministic template — see _build_schedule)
        - emit a 'diy_threshold' notification
  4. GET /issues/{id}/diy returns the projection (totals + pledges +
     schedule) for the citizen-facing module.

Schedule generation is deterministic by issue type — keeps the demo
predictable. The Claude/Gemini hook is left as a TODO at _build_schedule.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.models import Citizen, Issue, Pledge
from nagarik.schemas import DiyState, PledgeCreate, PledgeRead

router = APIRouter(prefix="/issues", tags=["pledges"])

# Threshold knobs. Match the marketing-site copy ("5 volunteers" /
# "₹1,500 cold-mix patch"). Keep at module-top so the e2e seeder can tune.
HOURS_THRESHOLD = 5.0
FUNDS_THRESHOLD = 1500


def _citizen_from_request(request: Request, db: Session) -> Citizen:
    """Resolve the authenticated reporter, falling back to the demo citizen."""
    from nagarik.auth import decode_jwt
    from jose import JWTError as _JWTError

    auth_header = request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        try:
            sub = decode_jwt(auth_header.split(" ", 1)[1]).get("sub")
            if sub:
                row = db.get(Citizen, uuid.UUID(sub))
                if row is not None:
                    return row
        except (_JWTError, ValueError):
            pass
    row = db.scalar(select(Citizen).limit(1))
    if row is None:
        row = Citizen(phone="+910000000000", name="Demo Citizen")
        db.add(row)
        db.flush()
    return row


def _totals(db: Session, issue_id: uuid.UUID) -> tuple[int, float]:
    """(funds_total_inr, hours_total) for an issue across all pledges."""
    funds = db.scalar(
        select(func.coalesce(func.sum(Pledge.amount_inr), 0)).where(
            Pledge.issue_id == issue_id, Pledge.kind == "funds"
        )
    ) or 0
    hours = db.scalar(
        select(func.coalesce(func.sum(Pledge.hours), 0.0)).where(
            Pledge.issue_id == issue_id, Pledge.kind == "hours"
        )
    ) or 0.0
    return int(funds), float(hours)


def _build_schedule(issue: Issue, funds: int, hours: float) -> dict:
    """Type-keyed DIY workplan. Deterministic so the demo is reproducible.

    The shape is consumed by the citizen-facing UI:
      {
        "title": "Saturday garbage clearing — Kalyan Nagar",
        "when":  "Saturday 7-9 AM",
        "what":  "Bag the pile, segregate dry/wet, drop at BBMP transfer.",
        "tools": ["gloves", "large bags", "rake"],
        "safety":"Wear closed shoes. Don't touch sharp objects bare-handed.",
        "meet":  "Outside the corner shop, near the pothole."
      }
    Future: prompt Claude with issue.type + estimated_materials + ward to
    write a richer SOP. For now the keys are stable enough for the UI.
    """
    t = str(issue.type)
    base = {
        "garbage": {
            "title": f"Community garbage clearing — {issue.ward or 'this ward'}",
            "when": "Saturday 7-9 AM",
            "what": "Bag the accumulated pile, segregate wet/dry, drop bags at the nearest BBMP transfer station.",
            "tools": ["heavy gloves", "large garbage bags", "rake", "high-vis vest"],
            "safety": "Wear closed shoes and gloves. Do not touch sharp objects bare-handed. Keep kids back.",
        },
        "encroachment": {
            "title": "Crosswalk repaint",
            "when": "Sunday 6-8 AM (low traffic)",
            "what": "Mask off the existing zebra crossing, repaint with traffic-grade white road paint.",
            "tools": ["road-paint", "rollers", "masking tape", "traffic cones"],
            "safety": "Two volunteers on cone duty at all times. Hi-vis vests mandatory.",
        },
        "streetlight": {
            "title": "Temporary lighting + report",
            "when": "Tonight 7 PM",
            "what": "Hang solar lantern from the pole and file a fresh ticket with the BESCOM ward office.",
            "tools": ["solar lantern", "zip-ties", "ladder"],
            "safety": "Do NOT touch the pole's wiring. This is a stopgap, not a repair.",
        },
    }.get(t, {
        "title": f"Community fix-up for {t.replace('_', ' ')}",
        "when": "Next Saturday morning",
        "what": "Coordinate on the WhatsApp group your ward councillor will create. Document with before/after photos.",
        "tools": ["gloves", "high-vis vest"],
        "safety": "Two-person buddy system. No power tools without permits.",
    })
    base["meet"] = issue.address or f"Pinned location ({issue.ward or 'see map'})"
    base["pledged_funds_inr"] = funds
    base["pledged_hours"] = hours
    base["volunteers_needed"] = max(0, int(round(HOURS_THRESHOLD - hours)))
    return base


def _maybe_trigger_threshold(db: Session, issue: Issue) -> None:
    """Re-evaluate thresholds after a pledge. Idempotent."""
    if issue.diy_threshold_met_at is not None:
        return
    funds, hours = _totals(db, issue.id)
    if hours < HOURS_THRESHOLD and funds < FUNDS_THRESHOLD:
        return
    issue.diy_threshold_met_at = datetime.now(timezone.utc)
    issue.diy_schedule = _build_schedule(issue, funds, hours)
    db.add(issue)
    db.flush()
    try:
        from nagarik.notifications import emit
        emit(str(issue.id), "diy_threshold",
             extras={"funds_inr": funds, "hours": hours})
    except Exception:  # noqa: BLE001 — notification best-effort
        pass


@router.post("/{issue_id}/pledges", response_model=PledgeRead, status_code=201)
def create_pledge(
    issue_id: uuid.UUID,
    payload: PledgeCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> PledgeRead:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")
    if issue.diy_unlocked_at is None:
        raise HTTPException(
            409,
            "DIY not unlocked — pledges open only after this issue breaches its "
            "level-3 SLA. The system still has time to act.",
        )

    # Validate per-kind payload shape: funds needs amount_inr, hours needs hours.
    if payload.kind == "funds" and not payload.amount_inr:
        raise HTTPException(422, "amount_inr required for kind='funds'")
    if payload.kind == "hours" and not payload.hours:
        raise HTTPException(422, "hours required for kind='hours'")

    citizen = _citizen_from_request(request, db)

    pledge = Pledge(
        issue_id=issue.id,
        citizen_id=citizen.id,
        kind=payload.kind,
        amount_inr=payload.amount_inr if payload.kind == "funds" else None,
        hours=payload.hours if payload.kind == "hours" else None,
        note=payload.note,
    )
    db.add(pledge)
    db.flush()

    _maybe_trigger_threshold(db, issue)

    db.commit()
    db.refresh(pledge)
    return PledgeRead.model_validate(pledge)


@router.get("/{issue_id}/diy", response_model=DiyState)
def get_diy_state(issue_id: uuid.UUID, db: Session = Depends(get_db)) -> DiyState:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")
    funds, hours = _totals(db, issue.id)
    pledges = db.scalars(
        select(Pledge).where(Pledge.issue_id == issue.id).order_by(Pledge.created_at.asc())
    ).all()
    return DiyState(
        unlocked=issue.diy_unlocked_at is not None,
        unlocked_at=issue.diy_unlocked_at,
        threshold_met=issue.diy_threshold_met_at is not None,
        threshold_met_at=issue.diy_threshold_met_at,
        funds_total_inr=funds,
        hours_total=hours,
        pledges=[PledgeRead.model_validate(p) for p in pledges],
        schedule=dict(issue.diy_schedule or {}),
    )
