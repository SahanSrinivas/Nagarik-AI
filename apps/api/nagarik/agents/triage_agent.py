"""Agent 3 — TriageAgent.

Maps (issue_type, severity, location) → (department, SLA hours).
Uses a hard-coded SOP table for the hackathon; the real product would call
Claude Sonnet to handle ambiguous categories and overlapping jurisdictions.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Issue, IssueStatus

# Bangalore SOP: department + SLA per issue type.
SOP: dict[str, tuple[str, int]] = {
    "pothole": ("BBMP Roads", 72),
    "garbage": ("BBMP SWM", 24),
    "streetlight": ("BESCOM Streetlight", 48),
    "water_leak": ("BWSSB", 12),
    "sewage": ("BWSSB", 24),
    "tree_fall": ("BBMP Horticulture", 6),
    "encroachment": ("BBMP Town Planning", 168),
    "other": ("BBMP Helpdesk", 72),
}


def run_triage(state: AgentState) -> AgentState:
    # If the upstream dedup flagged a duplicate, skip routing.
    if state.get("is_duplicate"):
        return state

    issue_type = state.get("classified_type", "other")
    severity = state.get("severity", 3)
    department, sla_hours = SOP.get(issue_type, SOP["other"])

    # High severity halves the SLA.
    if severity >= 4:
        sla_hours = max(2, sla_hours // 2)

    deadline = datetime.now(timezone.utc) + timedelta(hours=sla_hours)

    with SessionLocal() as db:
        db.execute(
            update(Issue)
            .where(Issue.id == state["issue_id"])
            .values(
                routed_department=department,
                sla_deadline=deadline,
                status=IssueStatus.TRIAGED,
            )
        )
        db.commit()

    return {
        **state,
        "routed_department": department,
        "sla_hours": sla_hours,
    }  # type: ignore[return-value]
