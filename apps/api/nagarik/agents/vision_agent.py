"""Agent 1 — VisionAgent.

Calls Gemini 2.5 Flash on the before-photo to extract:
- type (pothole / garbage / streetlight / water_leak / ...)
- severity (1-5)
- bounding-box metadata (width, depth, hazard score)

Falls back to a deterministic stub when the API key isn't configured so the
graph still runs end-to-end during local dev / CI.
"""

from __future__ import annotations

import json

from sqlalchemy import update

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Issue, IssueStatus
from nagarik.settings import get_settings


PROMPT = """You are a civic-issue triage assistant for an Indian municipality.
Look at the photo and return STRICT JSON with these keys:
  type:        one of [pothole, garbage, streetlight, water_leak, sewage, tree_fall, encroachment, other]
  severity:    integer 1-5 (5 = immediate hazard to life or property)
  confidence:  float 0-1
  notes:       short description for the field crew (max 30 words)
  width_m:     approximate width in metres (or null)
  depth_cm:    approximate depth in cm if applicable (or null)
Return only the JSON, no markdown."""


def _stub(state: AgentState) -> AgentState:
    return {
        **state,
        "classified_type": "pothole",
        "severity": 4,
        "ai_confidence": 0.5,
        "ai_meta": {"notes": "stub — no GOOGLE_API_KEY configured"},
    }  # type: ignore[return-value]


def run_vision(state: AgentState) -> AgentState:
    settings = get_settings()
    if not settings.google_api_key:
        new = _stub(state)
        _persist(new)
        return new

    # Lazy import keeps cold-start fast when Gemini isn't wired up.
    from google import genai

    with SessionLocal() as db:
        issue = db.get(Issue, state["issue_id"])
        if issue is None or not issue.before_photo_url:
            return _stub(state)

        client = genai.Client(api_key=settings.google_api_key)
        # NOTE: the real call should fetch bytes from before_photo_url; for the
        # skeleton we pass the URL only — replace with bytes upload before demo.
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[PROMPT, {"file_data": {"file_uri": issue.before_photo_url}}],
        )

    try:
        parsed = json.loads(resp.text)
    except (json.JSONDecodeError, AttributeError):
        return _stub(state)

    new: AgentState = {
        **state,
        "classified_type": parsed.get("type", "other"),
        "severity": int(parsed.get("severity", 3)),
        "ai_confidence": float(parsed.get("confidence", 0.5)),
        "ai_meta": parsed,
    }  # type: ignore[assignment]
    _persist(new)
    return new


def _persist(state: AgentState) -> None:
    with SessionLocal() as db:
        db.execute(
            update(Issue)
            .where(Issue.id == state["issue_id"])
            .values(
                type=state.get("classified_type", "other"),
                severity=state.get("severity", 3),
                ai_confidence=state.get("ai_confidence", 0.0),
                ai_classification=state.get("ai_meta", {}),
                status=IssueStatus.CLASSIFIED,
            )
        )
        db.commit()
