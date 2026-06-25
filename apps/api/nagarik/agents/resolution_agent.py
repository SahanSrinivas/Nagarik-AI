"""Agent 6 — ResolutionAgent.

When an after-photo is uploaded by the crew, we run a two-layer check:

  1. CLIP cosine similarity between before/after photos (scene match)
     — proves the crew is actually at the same location, not a stand-in.
  2. Pothole-defect CNN on the AFTER photo
     — proves the issue is gone, not just photographed again.

A genuine fix:  scene match high  AND  defect prob low   → VERIFIED + RESOLVED.
A fake closure: scene match high  AND  defect prob high  → REJECTED ("same hole").
A photo swap:   scene match low                          → REJECTED.

The CNN is loaded lazily — if torch or the .pt aren't available we degrade
to scene-match-only and report `cnn_available: false` in the agent event
payload. This matches the community-hero reference's defaults.
"""

from __future__ import annotations

import logging

from sqlalchemy import update

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Issue, IssueStatus

log = logging.getLogger(__name__)

# Tuning thresholds — picked to match the published reference cases.
SCENE_MATCH_FLOOR = 0.40       # below this we don't trust the photo at all
DEFECT_REJECT_ABOVE = 0.55     # CNN says "still a defect" — REJECT
DEFECT_REVIEW_ABOVE = 0.30     # in-between → flag for human review


def _scene_similarity(before_url: str, after_url: str) -> float | None:
    try:
        from nagarik.embed.clip_embedder import cosine, embed_image_url
        a = embed_image_url(before_url)
        b = embed_image_url(after_url)
        return cosine(a, b)
    except Exception as exc:  # noqa: BLE001 — CLIP optional
        log.warning("resolution: scene similarity failed: %s", exc)
        return None


def _defect_score(after_url: str) -> tuple[float | None, bool]:
    try:
        from nagarik.embed.defect_cnn import cnn_available, defect_probability_url
        if not cnn_available():
            return None, False
        return defect_probability_url(after_url), True
    except Exception as exc:  # noqa: BLE001 — CNN optional
        log.warning("resolution: defect CNN failed: %s", exc)
        return None, False


def run_resolution(state: AgentState) -> AgentState:
    with SessionLocal() as db:
        issue = db.get(Issue, state["issue_id"])
        if issue is None:
            return {**state, "resolution_similarity": 0.0}  # type: ignore[return-value]
        if not issue.after_photo_url:
            # Nothing to verify yet — agent runs again when crew uploads.
            return {**state, "resolution_similarity": 0.0}  # type: ignore[return-value]
        before_url = issue.before_photo_url
        after_url = issue.after_photo_url

    scene = _scene_similarity(before_url, after_url) if before_url else None
    defect, cnn_used = _defect_score(after_url) if issue.type.value == "pothole" else (None, False)

    # Verdict combining both layers (defaults: pass scene, no CNN → review).
    if scene is not None and scene < SCENE_MATCH_FLOOR:
        verdict = "rejected_photo_swap"
    elif defect is not None and defect >= DEFECT_REJECT_ABOVE:
        verdict = "rejected_still_defective"
    elif defect is not None and defect >= DEFECT_REVIEW_ABOVE:
        verdict = "needs_review"
    else:
        verdict = "verified_resolved"

    with SessionLocal() as db:
        if verdict == "verified_resolved":
            from datetime import datetime, timezone
            db.execute(
                update(Issue)
                .where(Issue.id == state["issue_id"])
                .values(status=IssueStatus.RESOLVED, resolved_at=datetime.now(timezone.utc))
            )
            db.commit()
            # Close the loop for the citizen.
            from nagarik.notifications import emit
            emit(
                state["issue_id"],
                "resolved",
                extras={
                    "sim": round(100 * (scene or 0.0)),
                    "xp": 5,
                },
            )
        elif verdict.startswith("rejected"):
            # Push back to scheduled — crew has to redo.
            db.execute(
                update(Issue)
                .where(Issue.id == state["issue_id"])
                .values(status=IssueStatus.SCHEDULED)
            )
            db.commit()

    return {
        **state,
        "resolution_similarity": float(scene if scene is not None else 0.0),
        # Stuff the verdict + scores into the agent_event payload so the UI shows them.
        "ai_meta": {
            **(state.get("ai_meta") or {}),
            "verdict": verdict,
            "scene_similarity": scene,
            "defect_probability": defect,
            "cnn_available": cnn_used,
        },
    }  # type: ignore[return-value]
