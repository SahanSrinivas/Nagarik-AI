"""Agent 6 — ResolutionAgent.

When an after-photo is uploaded, compute CLIP similarity between
before_photo and after_photo. If similarity is high in the surrounding
context but low at the focal region, mark RESOLVED.

For the hackathon skeleton we no-op when there is no after-photo yet;
the agent re-runs when the crew uploads one.
"""

from __future__ import annotations

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Issue


def run_resolution(state: AgentState) -> AgentState:
    with SessionLocal() as db:
        issue = db.get(Issue, state["issue_id"])
        if issue is None or not issue.after_photo_url:
            return {**state, "resolution_similarity": 0.0}  # type: ignore[return-value]

    # TODO: load both images, run CLIP, score similarity, update status.
    similarity = 0.92  # placeholder for demo
    return {**state, "resolution_similarity": similarity}  # type: ignore[return-value]
