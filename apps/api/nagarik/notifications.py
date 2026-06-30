"""Closes the feedback loop — every meaningful agent transition writes a
human-readable Notification row addressed to the issue reporter.

In production this fans out to WhatsApp Business API (AiSensy) + Web Push.
For the hackathon we just persist them; the /tracking page polls + renders.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from nagarik.db import Base, SessionLocal
from nagarik.models import Issue
from nagarik.timeutil import fmt_ist


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("issues.id"), index=True)
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizens.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))           # "classified" / "verified" / "scheduled" / ...
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(String(500))
    channel: Mapped[str] = mapped_column(String(20), default="in_app")  # in_app | whatsapp | push | sms
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---- Human-friendly copy per status transition ----------------------------

TEMPLATES: dict[str, tuple[str, str]] = {
    "classified":      ("AI saw your photo",          "We classified it as {type} (severity {severity}/5). Routing to the right department now."),
    "deduped":         ("Matched an existing report", "Looks like {original_id} flagged this nearby first. We've merged your report and you'll get its updates too."),
    "triaged":         ("Routed to {dept}",           "Filed with {dept}. SLA: by {sla}."),
    "verified":        ("Verified by your neighbours","{count} nearby citizens confirmed. The crew dispatcher just picked it up."),
    "scheduled":       ("Crew assigned",              "Crew {crew} will visit on {when}. Optimized via our MILP route solver."),
    "in_progress":     ("Crew on-site",               "The team is at the location right now."),
    "resolved":        ("Marked resolved",            "{dept} reported the fix. After-photo verified by CLIP at {sim}% similarity. +{xp} XP earned."),
    "rejected":        ("Couldn't proceed",           "We had to reject this report — usually a duplicate or out of scope."),
    "acked_by_dept":   ("{dept} acknowledged",        "A supervisor at {dept} opened your ticket. They have your details and the SLA clock continues to run."),
    "blocked_by_crew": ("Crew flagged a problem",     "The assigned crew couldn't complete this on first attempt ({reason}). Supervisor has been notified."),
    "escalated_lvl1":  ("Missed SLA — escalated",     "{dept} didn't act in time. We've re-pinged the dept supervisor directly."),
    "escalated_lvl2":  ("Escalated to councillor",    "{dept} still silent 24h on. Ward councillor has been looped in."),
    "escalated_lvl3":  ("RTI draft prepared",         "72h with no movement. We've drafted an RTI you can file in one tap from your dashboard."),
    "diy_unlocked":    ("Community DIY unlocked",     "{dept} hasn't acted. Neighbours can now pledge funds or volunteer hours to fix this together."),
    "diy_threshold":   ("Community Heroes assembled", "Threshold met — your DIY workplan is ready. Tap to see the schedule."),
}


def emit(
    issue_id: str,
    kind: str,
    *,
    extras: dict[str, Any] | None = None,
    channel: str = "in_app",
) -> Notification | None:
    tpl = TEMPLATES.get(kind)
    if tpl is None:
        return None

    with SessionLocal() as db:
        issue = db.get(Issue, issue_id)
        if issue is None:
            return None

        ctx: dict[str, Any] = {
            "type": getattr(issue.type, "value", issue.type),
            "severity": issue.severity,
            "dept": issue.routed_department or "the department",
            "sla": fmt_ist(issue.sla_deadline) if issue.sla_deadline else "soon",
            **(extras or {}),
        }
        # Safe formatting — missing keys render as the literal {name}.
        title = _safe_format(tpl[0], ctx)
        body = _safe_format(tpl[1], ctx)

        n = Notification(
            issue_id=issue.id,
            citizen_id=issue.reporter_id,
            kind=kind,
            title=title,
            body=body,
            channel=channel,
            delivered_at=datetime.now(timezone.utc),
            payload=ctx,
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        # Cache the id as a plain string BEFORE the session closes — otherwise
        # accessing issue.id after the with-block triggers a lazy refresh on a
        # detached instance and crashes the fanout (sqlalchemy.exc.DetachedInstanceError).
        issue_id_str = str(issue.id)

    # Fan out the same kind to WhatsApp if the citizen opted in on /report.
    # Imported lazily + wrapped in try/except so a misconfigured provider
    # never blocks the in-DB notification (which the UI polls anyway).
    try:
        from nagarik.whatsapp import send_citizen_update
        send_citizen_update(issue_id_str, kind, extras=ctx)
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).warning("whatsapp fanout failed for %s: %s", kind, exc)

    return n


def _safe_format(template: str, ctx: dict[str, Any]) -> str:
    class _Missing(dict):
        def __missing__(self, key: str) -> str:
            return "{" + key + "}"

    return template.format_map(_Missing(ctx))
