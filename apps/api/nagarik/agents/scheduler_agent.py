"""Agent 5 — SchedulerAgent.

Runs the MILP CVRPTW solver across the day's open issues + active crews.
On a per-issue trigger this is wasteful (the solver re-runs for the entire
day each time); the production design moves this to a nightly Cloud Scheduler
job that re-solves once and stores assignments.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timezone

from geoalchemy2.shape import to_shape
from sqlalchemy import select, update

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.milp.cvrptw import CVRPTWInput, CrewVehicle, IssueNode, solve_cvrptw
from nagarik.models import Crew, Issue, IssueStatus


def _as_uuid(v):
    """Tolerant cast. The MILP solver emits IssueNode/CrewVehicle ids as
    str (see line 43), but the Issue.id / Crew.id columns are UUID — when
    the WHERE clause compares str against UUID, Postgres/SQLAlchemy
    silently match zero rows, so the UPDATE is a no-op and the citizen
    sees crew=None forever. Casting both sides to UUID fixes that."""
    return v if isinstance(v, uuid.UUID) else uuid.UUID(str(v))


def run_scheduler(state: AgentState) -> AgentState:
    if state.get("is_duplicate"):
        return state

    today = date.today()
    with SessionLocal() as db:
        crews = db.scalars(select(Crew).where(Crew.is_active.is_(True))).all()
        if not crews:
            return {**state, "scheduled_for": None}  # type: ignore[return-value]

        open_issues = db.scalars(
            select(Issue).where(
                Issue.status.in_([IssueStatus.VERIFIED, IssueStatus.TRIAGED]),
                Issue.duplicate_of_id.is_(None),
            ).limit(50)
        ).all()
        if not open_issues:
            return {**state, "scheduled_for": None}  # type: ignore[return-value]

        nodes = [
            IssueNode(
                id=str(i.id),
                lat=to_shape(i.location).y,
                lng=to_shape(i.location).x,
                type=i.type.value if hasattr(i.type, "value") else str(i.type),
                severity=i.severity,
                sla_deadline=i.sla_deadline
                or datetime.combine(today, time(18, 0), tzinfo=timezone.utc),
                service_minutes=20,
            )
            for i in open_issues
        ]
        vehicles = [
            CrewVehicle(
                id=str(c.id),
                depot_lat=to_shape(c.depot_location).y,
                depot_lng=to_shape(c.depot_location).x,
                skills=list(c.skills or []),
                capacity=c.daily_capacity,
                shift_start_hour=c.shift_start_hour,
                shift_end_hour=c.shift_end_hour,
            )
            for c in crews
        ]

        result = solve_cvrptw(CVRPTWInput(issues=nodes, crews=vehicles, date=today))

        # Apply the assignments back to the database. Using ORM get + attr
        # assignment (instead of the raw update(Issue).where().values()
        # builder) because the builder pattern was silently zero-matching
        # in prod — see the long debugging trail in agent_events for issues
        # where scheduler.completed.payload.scheduled_for is set (proving
        # the loop iterated correctly) but Issue.assigned_crew_id stayed
        # NULL. The ORM path makes "row not found" explicit and gives us
        # a single commit point at the end.
        import logging as _log
        logger = _log.getLogger(__name__)

        scheduled_this_issue = None
        updated = 0
        missing = 0
        for route in result.get("routes", []):
            crew_uuid = _as_uuid(route["crew_id"])
            for seq, issue_id in enumerate(route["sequence"]):
                issue_uuid = _as_uuid(issue_id)
                slot_hour = min(17, 9 + seq)
                issue_obj = db.get(Issue, issue_uuid)
                if issue_obj is None:
                    missing += 1
                    logger.warning("scheduler: issue %s not found in DB", issue_uuid)
                    continue
                issue_obj.assigned_crew_id = crew_uuid
                issue_obj.scheduled_at = datetime.combine(
                    today, time(slot_hour, 0), tzinfo=timezone.utc
                )
                issue_obj.status = IssueStatus.SCHEDULED
                updated += 1
                if str(issue_uuid) == str(state["issue_id"]):
                    scheduled_this_issue = (str(crew_uuid), seq)
        db.flush()
        db.commit()
        logger.info("scheduler: updated=%d missing=%d this_issue=%s",
                    updated, missing, scheduled_this_issue)

    # Close the loop: notify the citizen that a crew has been assigned.
    if scheduled_this_issue is not None:
        from nagarik.notifications import emit
        crew_id, seq = scheduled_this_issue
        emit(
            state["issue_id"],
            "scheduled",
            extras={"crew": str(crew_id)[:8], "when": f"today, slot {seq + 1}"},
        )

    return {
        **state,
        "scheduled_for": str(scheduled_this_issue) if scheduled_this_issue else None,
    }  # type: ignore[return-value]
