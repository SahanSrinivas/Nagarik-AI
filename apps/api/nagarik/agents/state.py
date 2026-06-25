"""Shared state object passed between agents in the LangGraph."""

from __future__ import annotations

from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    issue_id: str

    # VisionAgent output
    classified_type: str
    severity: int
    ai_confidence: float
    ai_meta: dict[str, Any]
    image_embedding: list[float]

    # DedupAgent output
    is_duplicate: bool
    duplicate_of_id: str | None

    # TriageAgent output
    routed_department: str
    ward: str
    sla_hours: int

    # VerificationAgent output
    notified_citizens: int

    # SchedulerAgent output
    scheduled_for: str | None

    # ResolutionAgent output
    resolution_similarity: float

    # InsightsAgent output
    contributes_to_prediction: bool

    # Diagnostics
    errors: list[str]
