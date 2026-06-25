"""Agent 4 — VerificationAgent.

Picks the 5 nearest citizens to the issue location and enqueues a push to
each ("Did you also notice this issue?"). For the skeleton we simulate the
notification by writing an AgentEvent — the real product wires Web Push +
FCM here.
"""

from __future__ import annotations

from sqlalchemy import func, select

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Citizen, Issue

NOTIFY_LIMIT = 5


def run_verification(state: AgentState) -> AgentState:
    if state.get("is_duplicate"):
        return state

    with SessionLocal() as db:
        issue = db.get(Issue, state["issue_id"])
        if issue is None:
            return state

        # Simulate "nearest citizens" — replace with PostGIS join on Citizen.location
        # once you start collecting citizen home-locations during signup.
        nearby_count = db.scalar(select(func.count(Citizen.id))) or 0

    return {**state, "notified_citizens": min(NOTIFY_LIMIT, nearby_count)}  # type: ignore[return-value]
