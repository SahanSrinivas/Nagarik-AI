"""Agent 2 — DedupAgent.

Looks for issues within 50m radius AND high CLIP-embedding similarity.
If found, marks this issue as a duplicate of the older one and stops the loop.

For the hackathon skeleton, similarity is short-circuited to a PostGIS
nearest-neighbor check; swap in pgvector cosine distance once you've added
real CLIP embeddings to the upload pipeline.
"""

from __future__ import annotations

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import select, update

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Issue, IssueStatus

DEDUP_RADIUS_M = 50


def run_dedup(state: AgentState) -> AgentState:
    with SessionLocal() as db:
        issue = db.get(Issue, state["issue_id"])
        if issue is None:
            return state

        # Use the issue's own location to search nearby older issues of the same type.
        nearby = db.scalars(
            select(Issue)
            .where(
                Issue.id != issue.id,
                Issue.type == issue.type,
                Issue.created_at < issue.created_at,
                Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED, IssueStatus.REJECTED]),
                Issue.location.ST_DWithin(issue.location, DEDUP_RADIUS_M),
            )
            .order_by(Issue.created_at.asc())
            .limit(1)
        ).all()

        if nearby:
            original = nearby[0]
            db.execute(
                update(Issue)
                .where(Issue.id == issue.id)
                .values(
                    duplicate_of_id=original.id,
                    status=IssueStatus.DEDUPED,
                )
            )
            db.commit()
            return {**state, "is_duplicate": True, "duplicate_of_id": str(original.id)}  # type: ignore[return-value]

        db.execute(update(Issue).where(Issue.id == issue.id).values(status=IssueStatus.DEDUPED))
        db.commit()
        return {**state, "is_duplicate": False, "duplicate_of_id": None}  # type: ignore[return-value]
