"""Agent 2 — DedupAgent.

Three-signal dedup:
  1. Geographic prefilter — PostGIS ST_DWithin within 50m
  2. Image semantic — CLIP image-embedding cosine ≥ 0.90
  3. Language semantic — Vertex AI `gemini-embedding-001` cosine on the
     post-Vision description (catches "same issue, different photo angle"
     where the pixels diverge but the semantic content is identical)

If a geo candidate clears EITHER the CLIP threshold OR the text-embedding
threshold, the new issue is marked as a duplicate of the older one and
the rest of the agent loop short-circuits.

Both embedders run lazily — if open_clip isn't installed (CLIP) or the
Gemini API key isn't set (text), that signal is skipped and we fall
back to the remaining signals so the pipeline never blocks.
"""

from __future__ import annotations

from sqlalchemy import select, update

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Issue, IssueStatus

DEDUP_RADIUS_M = 50
COSINE_THRESHOLD = 0.90
TEXT_COSINE_THRESHOLD = 0.85   # Gemini text embeddings tend to cluster
                               # tighter than CLIP image cosines, so a
                               # slightly lower bar avoids false negatives.


def _describe_for_embed(issue, vision_meta: dict) -> str:
    """Build the canonical text the text-embedder sees for an issue.

    Combines the structured Vision output (notes, focus_label) with the
    citizen's free-text description and the classified type. Keeping it
    short helps gemini-embedding-001 focus on the civic-issue semantics
    rather than incidental wording.
    """
    parts = []
    t = getattr(issue.type, "value", str(issue.type)) if issue.type else ""
    if t: parts.append(t)
    if vision_meta:
        if vision_meta.get("focus_label"): parts.append(vision_meta["focus_label"])
        if vision_meta.get("notes"):       parts.append(vision_meta["notes"])
    if issue.description: parts.append(issue.description[:240])
    return " · ".join(parts)


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
        match_signal = None  # which check fired — "clip" | "text" | "geo"
        if emb is not None and candidates:
            # pgvector cosine similarity — pick the closest CLIP candidate.
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
                    match_signal = "clip"

        # Language-semantic signal — Vertex AI gemini-embedding-001 on the
        # post-Vision description. Catches dup reports where two citizens
        # photographed the same problem from different angles (CLIP misses)
        # but described it similarly.
        if chosen is None and candidates:
            from nagarik.embed.gemini_embedder import embed_text, cosine as text_cosine

            this_text = _describe_for_embed(issue, state.get("ai_meta") or {})
            this_emb = embed_text(this_text)
            if this_emb:
                for cand in candidates:
                    cand_text = _describe_for_embed(
                        cand, (cand.ai_classification or {}) if hasattr(cand, "ai_classification") else {}
                    )
                    cand_emb = embed_text(cand_text)
                    if text_cosine(this_emb, cand_emb) >= TEXT_COSINE_THRESHOLD:
                        chosen = cand
                        match_signal = "text"
                        break

        # Fallback: with no embeddings on either side, trust geography alone.
        if chosen is None and candidates and emb is None:
            chosen = candidates[0]
            match_signal = "geo"

        if chosen is not None:
            db.execute(
                update(Issue)
                .where(Issue.id == issue.id)
                .values(duplicate_of_id=chosen.id, status=IssueStatus.DEDUPED)
            )
            db.commit()
            return {**state,
                    "is_duplicate": True,
                    "duplicate_of_id": str(chosen.id),
                    "dedup_signal": match_signal}  # type: ignore[return-value]

        db.execute(update(Issue).where(Issue.id == issue.id).values(status=IssueStatus.DEDUPED))
        db.commit()
        return {**state, "is_duplicate": False, "duplicate_of_id": None}  # type: ignore[return-value]
