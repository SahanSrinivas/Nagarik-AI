"""Agent 2 — DedupAgent.

Two-stage dedup:
  1. Geographic prefilter — PostGIS ST_DWithin within 50m
  2. Semantic check — CLIP image-embedding cosine ≥ 0.90

If a candidate clears both, the new issue is marked as a duplicate of the
older one and the rest of the agent loop short-circuits.

CLIP runs lazily — if open_clip isn't installed or no photo is attached,
we fall back to geo-only matching so the pipeline never blocks.
"""

from __future__ import annotations

from sqlalchemy import select, update

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Issue, IssueStatus

DEDUP_RADIUS_M = 50
COSINE_THRESHOLD = 0.90


def _try_embedding(url: str | None) -> list[float] | None:
    if not url:
        return None
    try:
        from nagarik.embed.clip_embedder import embed_image_url

        return embed_image_url(url)
    except Exception:  # noqa: BLE001 — embedding failures must not kill dedup
        return None


def run_dedup(state: AgentState) -> AgentState:
    with SessionLocal() as db:
        issue = db.get(Issue, state["issue_id"])
        if issue is None:
            return state

        # Compute (or skip) embedding for this issue.
        emb = _try_embedding(issue.before_photo_url)
        if emb is not None:
            db.execute(
                update(Issue).where(Issue.id == issue.id).values(image_embedding=emb)
            )

        # Geographic prefilter — fast, indexed by GIST.
        candidates = db.scalars(
            select(Issue)
            .where(
                Issue.id != issue.id,
                Issue.type == issue.type,
                Issue.created_at < issue.created_at,
                Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED, IssueStatus.REJECTED]),
                Issue.location.ST_DWithin(issue.location, DEDUP_RADIUS_M),
            )
            .order_by(Issue.created_at.asc())
            .limit(5)
        ).all()

        chosen: Issue | None = None
        if emb is not None and candidates:
            # pgvector cosine similarity — pick the closest candidate that clears the threshold.
            from sqlalchemy import func

            ranked = db.scalars(
                select(Issue)
                .where(Issue.id.in_([c.id for c in candidates if c.image_embedding is not None]))
                .order_by(func.cosine_distance(Issue.image_embedding, emb).asc())
                .limit(1)
            ).all()
            if ranked:
                from nagarik.embed.clip_embedder import cosine

                if cosine(emb, ranked[0].image_embedding) >= COSINE_THRESHOLD:
                    chosen = ranked[0]

        # Fallback: with no embeddings on either side, trust geography alone.
        if chosen is None and candidates and emb is None:
            chosen = candidates[0]

        if chosen is not None:
            db.execute(
                update(Issue)
                .where(Issue.id == issue.id)
                .values(duplicate_of_id=chosen.id, status=IssueStatus.DEDUPED)
            )
            db.commit()
            return {**state, "is_duplicate": True, "duplicate_of_id": str(chosen.id)}  # type: ignore[return-value]

        db.execute(update(Issue).where(Issue.id == issue.id).values(status=IssueStatus.DEDUPED))
        db.commit()
        return {**state, "is_duplicate": False, "duplicate_of_id": None}  # type: ignore[return-value]
