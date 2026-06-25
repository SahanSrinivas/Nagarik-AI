"""Community verification — 3 confirmations promotes an issue to VERIFIED."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.models import Citizen, Issue, IssueStatus, Verification
from nagarik.schemas import VerificationCreate

router = APIRouter(prefix="/issues/{issue_id}/verify", tags=["verification"])

XP_PER_VERIFICATION = 5
THRESHOLD = 3


@router.post("", status_code=201)
def add_verification(
    issue_id: uuid.UUID,
    payload: VerificationCreate,
    db: Session = Depends(get_db),
) -> dict:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")

    # TODO: pull real citizen from auth context.
    demo = db.scalar(select(Citizen).limit(1))
    assert demo is not None, "seed at least one citizen before verifying"

    v = Verification(issue_id=issue.id, citizen_id=demo.id, **payload.model_dump())
    db.add(v)

    demo.xp += XP_PER_VERIFICATION

    confirms = db.scalar(
        select(func.count(Verification.id)).where(
            Verification.issue_id == issue.id, Verification.confirms.is_(True)
        )
    )
    if confirms is not None and confirms + 1 >= THRESHOLD and issue.status == IssueStatus.TRIAGED:
        issue.status = IssueStatus.VERIFIED

    db.commit()
    return {"verifications": (confirms or 0) + 1, "promoted": issue.status == IssueStatus.VERIFIED}
