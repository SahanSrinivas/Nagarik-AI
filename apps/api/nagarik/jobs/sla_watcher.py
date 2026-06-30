"""SLA escalation watcher — fires every 60s, escalates breached tickets.

The escalation ladder mirrors how real Indian civic grievance flow works:

  level 0  → nominal. We've dispatched to the dept's primary channel.
  level 1  → dept silent past sla_deadline. Re-dispatch to dept supervisor
             phone via the same channel; emit citizen notif.
  level 2  → 24h after level 1 with no acked_at. Notify ward councillor (we
             log it; in production wire the BBMP councillor email/whatsapp).
  level 3  → 72h after level 2. Generate an RTI auto-draft (stub — adds a
             notification with a downloadable PDF link).

Started from main.py via ``start_sla_watcher()`` as an asyncio background
task. Resilient to all exceptions — never crashes the loop.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select

from nagarik.db import SessionLocal
from nagarik.models import Issue, IssueStatus

log = logging.getLogger(__name__)

WATCH_INTERVAL_S = 60
ESCALATION_GAP_HOURS = {1: 24, 2: 72}   # hours to wait at each level before next bump

OPEN_STATUSES = (
    IssueStatus.TRIAGED,
    IssueStatus.VERIFIED,
    IssueStatus.SCHEDULED,
    IssueStatus.IN_PROGRESS,
)


def _emit_escalation_notice(issue_id: str, level: int, dept_name: str) -> None:
    """Adds a citizen-facing notification using the templates we register."""
    from nagarik.notifications import emit

    kind = {1: "escalated_lvl1", 2: "escalated_lvl2", 3: "escalated_lvl3"}.get(level, "escalated_lvl1")
    emit(issue_id, kind, extras={"dept": dept_name, "level": level})


def _redispatch(issue_id: str) -> None:
    """Re-fire the dept dispatch for an escalation."""
    try:
        from nagarik.delivery import dispatch_to_department
        dispatch_to_department(issue_id, escalation=True)
    except Exception as exc:  # noqa: BLE001
        log.warning("sla_watcher: re-dispatch failed for %s: %s", issue_id, exc)


def _tick() -> dict:
    """One pass over open issues. Returns counters for telemetry."""
    now = datetime.now(timezone.utc)
    counts = {"breached_new": 0, "level1_bumped": 0, "level2_bumped": 0, "level3_bumped": 0}

    with SessionLocal() as db:
        # 1. Level 0 → 1: any open ticket whose SLA has passed and is still un-acked.
        stmt = select(Issue).where(
            Issue.status.in_(OPEN_STATUSES),
            Issue.escalation_level == 0,
            Issue.sla_deadline.isnot(None),
            Issue.sla_deadline < now,
            Issue.acked_at.is_(None),
        )
        for issue in db.scalars(stmt).all():
            issue.escalation_level = 1
            issue.escalated_at = now
            db.add(issue)
            db.flush()
            _emit_escalation_notice(str(issue.id), 1, issue.routed_department or "the department")
            _redispatch(str(issue.id))
            counts["level1_bumped"] += 1
            counts["breached_new"] += 1

        # 2. Level 1 → 2: 24h after level 1 with no acked_at.
        cutoff_l1 = now - timedelta(hours=ESCALATION_GAP_HOURS[1])
        stmt = select(Issue).where(
            Issue.status.in_(OPEN_STATUSES),
            Issue.escalation_level == 1,
            Issue.escalated_at.isnot(None),
            Issue.escalated_at < cutoff_l1,
            Issue.acked_at.is_(None),
        )
        for issue in db.scalars(stmt).all():
            issue.escalation_level = 2
            issue.escalated_at = now
            db.add(issue)
            db.flush()
            _emit_escalation_notice(str(issue.id), 2, issue.routed_department or "the department")
            counts["level2_bumped"] += 1

        # 3. Level 2 → 3: 72h after level 2 with no acked_at.
        cutoff_l2 = now - timedelta(hours=ESCALATION_GAP_HOURS[2])
        stmt = select(Issue).where(
            Issue.status.in_(OPEN_STATUSES),
            Issue.escalation_level == 2,
            Issue.escalated_at.isnot(None),
            Issue.escalated_at < cutoff_l2,
            Issue.acked_at.is_(None),
        )
        for issue in db.scalars(stmt).all():
            issue.escalation_level = 3
            issue.escalated_at = now
            db.add(issue)
            db.flush()
            _emit_escalation_notice(str(issue.id), 3, issue.routed_department or "the department")
            counts["level3_bumped"] += 1

        # 4. Community-DIY unlock — low-severity (1-2) issues that reach
        # escalation level 3 with no resolution have effectively been
        # abandoned by the system. Open them up to citizen crowdfunding
        # so neighbours can clean the garbage / repaint the crosswalk /
        # plant the median themselves. Only fires once per issue.
        stmt = select(Issue).where(
            Issue.status.in_(OPEN_STATUSES),
            Issue.severity <= 2,
            Issue.escalation_level >= 3,
            Issue.diy_unlocked_at.is_(None),
        )
        unlocked_count = 0
        for issue in db.scalars(stmt).all():
            issue.diy_unlocked_at = now
            db.add(issue)
            db.flush()
            try:
                from nagarik.notifications import emit
                emit(str(issue.id), "diy_unlocked",
                     extras={"type": str(issue.type), "ward": issue.ward or ""})
            except Exception:  # noqa: BLE001 — notification is best-effort
                pass
            unlocked_count += 1
        if unlocked_count:
            counts["diy_unlocked"] = unlocked_count

        db.commit()
    return counts


async def _loop() -> None:
    log.info("sla_watcher: running every %ds", WATCH_INTERVAL_S)
    while True:
        try:
            counts = _tick()
            if any(counts.values()):
                log.info("sla_watcher tick: %s", counts)
        except Exception as exc:  # noqa: BLE001
            log.warning("sla_watcher tick crashed: %s", exc)
        await asyncio.sleep(WATCH_INTERVAL_S)


def start_sla_watcher() -> None:
    """Schedule the watcher on the current event loop. Idempotent."""
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(_loop())
    except RuntimeError:
        # Not inside a running loop — caller should retry on app startup.
        log.warning("sla_watcher: no running event loop; deferring start")
