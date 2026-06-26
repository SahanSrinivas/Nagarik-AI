"""Auto-progress simulator — walks a demo ticket through every status.

In production the loop ends at SCHEDULED. From there a crew lead has to
press Start in /crew/[id], do the work, and upload an after-photo before
ResolutionAgent runs. None of that happens in a demo, so the citizen's
tracking page stalled at 'Awaiting next update'.

This module simulates the missing manual steps with ~5-second pauses so
a judge can watch a ticket cross the whole pipeline live:

    TRIAGED → SCHEDULED → (sleep 4s) → VERIFIED
                          (sleep 5s) → IN_PROGRESS
                          (sleep 7s) → RESOLVED  (+10 XP to reporter)

Disabled by setting DEMO_AUTO_PROGRESS=0 in the API env.
"""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy import update

from nagarik.db import SessionLocal
from nagarik.models import Citizen, Issue, IssueStatus

log = logging.getLogger(__name__)

# Per-step pauses (seconds). Total wall-clock ~16s after the agent loop.
STEP_DELAYS = {
    "verified":     4,
    "in_progress":  5,
    "resolved":     7,
}

XP_PER_RESOLVED = 10
STUB_AFTER_PHOTO = "https://placehold.co/600x400.jpg?text=after-photo"


def _set_status(issue_id: str, status: IssueStatus, *, resolved: bool = False) -> Issue | None:
    """Atomically flip an issue's status. Returns the refreshed row, or None
    if the issue has since been deleted."""
    with SessionLocal() as db:
        values: dict = {"status": status}
        if resolved:
            values["resolved_at"] = datetime.now(timezone.utc)
            values["after_photo_url"] = STUB_AFTER_PHOTO
        db.execute(update(Issue).where(Issue.id == uuid.UUID(issue_id)).values(**values))
        db.commit()
        return db.get(Issue, uuid.UUID(issue_id))


def _award_xp(reporter_id: uuid.UUID, amount: int) -> int:
    with SessionLocal() as db:
        c = db.get(Citizen, reporter_id)
        if c is None:
            return 0
        c.xp = (c.xp or 0) + amount
        db.commit()
        return c.xp


def _simulate(issue_id: str) -> None:
    """The actual sleep-and-flip loop. Runs inside a daemon thread."""
    from nagarik.notifications import emit

    try:
        # Step 1 — verified by community (no status change needed; the
        # tracking page reads from the notification timeline). Emit it so
        # the citizen sees 'verified by your neighbours'.
        time.sleep(STEP_DELAYS["verified"])
        with SessionLocal() as db:
            issue = db.get(Issue, uuid.UUID(issue_id))
            if issue is None:
                return
            # Skip if already past triage (e.g., a real crew acted on it).
            if issue.status in (IssueStatus.RESOLVED, IssueStatus.CLOSED, IssueStatus.REJECTED):
                return
        emit(issue_id, "verified", extras={"count": 3})

        # Step 2 — in_progress
        time.sleep(STEP_DELAYS["in_progress"])
        issue = _set_status(issue_id, IssueStatus.IN_PROGRESS)
        if issue is None:
            return
        emit(issue_id, "in_progress")

        # Step 3 — resolved + after-photo stub + +10 XP to reporter
        time.sleep(STEP_DELAYS["resolved"])
        issue = _set_status(issue_id, IssueStatus.RESOLVED, resolved=True)
        if issue is None:
            return
        new_xp = _award_xp(issue.reporter_id, XP_PER_RESOLVED) if issue.reporter_id else 0
        emit(issue_id, "resolved",
             extras={"sim": "97", "xp": XP_PER_RESOLVED, "new_xp": new_xp})
        log.info("demo_progress: %s walked to RESOLVED, reporter now at %d XP", issue_id, new_xp)
    except Exception as exc:  # noqa: BLE001
        log.warning("demo_progress: simulation failed for %s: %s", issue_id, exc)


def maybe_simulate(issue_id: str) -> None:
    """Kick off the simulation in a daemon thread iff DEMO_AUTO_PROGRESS is on.

    No-op when DEMO_AUTO_PROGRESS=0. The thread is non-blocking so the
    agent loop returns immediately and the citizen's tracking page starts
    auto-refreshing within seconds.
    """
    if os.environ.get("DEMO_AUTO_PROGRESS", "1") == "0":
        return
    t = threading.Thread(target=_simulate, args=(issue_id,), daemon=True,
                         name=f"demo-progress-{issue_id[:8]}")
    t.start()
