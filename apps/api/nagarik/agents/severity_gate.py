"""Severity gate — same 'model proposes, gate decides' pattern as routing,
but the gate has THREE votes now:

  1. Vision    — what Gemini saw in the photo (numeric severity + confidence)
  2. LLM       — what Claude inferred from the description (RouteProposal.severity)
  3. Default   — the SOP's per-category baseline (e.g. sewage starts at 4)

Decision rules (tuned for safety, not novelty):

  - Vision is the **authoritative source** when its confidence ≥ 0.70.
    Photos don't lie about how big a pothole is; text often understates.
  - The LLM may only **escalate** Vision's severity (e.g. "near a school"
    in the description bumps a sev-3 to sev-4). It may NOT de-escalate.
    Citizens who under-describe should not lose priority.
  - If Vision has low confidence (< 0.70) or no photo, fall back to the
    higher of (LLM proposal, SOP default).
  - Severe issues (≥ 4) get their SLA halved by the routing gate — so a
    bad severity decision compounds into a wrong SLA. We pick conservatively.

Returns a SeverityVerdict that the TriageAgent persists alongside the
RouteProposal verdict — both feed the audit log on /agents.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

SEVERITY_MIN = 1
SEVERITY_MAX = 5
VISION_TRUST_THRESHOLD = 0.70

# Per-issue-type baseline severity from BBMP's own incident-priority guidance.
SOP_BASELINE_SEVERITY: dict[str, int] = {
    "pothole":      3,
    "garbage":      3,
    "streetlight":  3,
    "water_leak":   4,   # BWSSB treats any active leak as priority
    "sewage":       4,   # overflow is a public-health issue
    "tree_fall":    4,
    "encroachment": 2,
    "other":        3,
}


class SeveritySource(str, Enum):
    VISION = "vision"                   # high-confidence photo win
    LLM_ESCALATION = "llm_escalation"   # LLM bumped vision up
    LLM_SOP_AGREEMENT = "llm_sop"       # no usable vision, LLM matches SOP
    SOP = "sop"                         # nothing else usable
    REJECTED_DEESCALATION = "rejected_deescalation"  # LLM tried to lower vision


@dataclass(slots=True)
class SeverityVerdict:
    final: int
    source: SeveritySource
    vision: int | None
    vision_confidence: float | None
    llm: int | None
    sop_baseline: int
    notes: list[str]


def _clamp(v: int | float | None, default: int = 3) -> int:
    if v is None:
        return default
    try:
        return max(SEVERITY_MIN, min(SEVERITY_MAX, int(round(float(v)))))
    except (TypeError, ValueError):
        return default


def evaluate(
    issue_type: str | None,
    *,
    vision_severity: int | float | None,
    vision_confidence: float | None,
    llm_severity: int | float | None,
) -> SeverityVerdict:
    notes: list[str] = []
    sop = SOP_BASELINE_SEVERITY.get((issue_type or "other"), 3)
    vis = _clamp(vision_severity) if vision_severity is not None else None
    vc = float(vision_confidence) if vision_confidence is not None else None
    llm = _clamp(llm_severity) if llm_severity is not None else None

    # --- Path 1: high-confidence Vision wins, LLM may only escalate ---
    if vis is not None and vc is not None and vc >= VISION_TRUST_THRESHOLD:
        if llm is None:
            return SeverityVerdict(vis, SeveritySource.VISION, vis, vc, llm, sop, notes)

        if llm > vis:
            # Escalation allowed — LLM read context (school zone, elderly nearby).
            notes.append(f"llm_escalated:{vis}→{llm}")
            return SeverityVerdict(llm, SeveritySource.LLM_ESCALATION, vis, vc, llm, sop, notes)

        if llm < vis:
            # De-escalation rejected — keep Vision.
            notes.append(f"llm_deescalation_rejected:{llm}<{vis}")
            return SeverityVerdict(
                vis, SeveritySource.REJECTED_DEESCALATION, vis, vc, llm, sop, notes,
            )

        # Equal — agreement on Vision's number.
        return SeverityVerdict(vis, SeveritySource.VISION, vis, vc, llm, sop, notes)

    # --- Path 2: Vision unavailable or low confidence ---
    candidates = [c for c in (llm, vis) if c is not None]
    if not candidates:
        notes.append("no_signals_using_sop_baseline")
        return SeverityVerdict(sop, SeveritySource.SOP, vis, vc, llm, sop, notes)

    # Pick the higher of (LLM, sop baseline) — never let weak signals lower priority.
    best = max(candidates + [sop])
    if best == llm and llm is not None:
        if llm == sop:
            return SeverityVerdict(llm, SeveritySource.LLM_SOP_AGREEMENT, vis, vc, llm, sop, notes)
        notes.append("low_vision_conf_using_llm")
        return SeverityVerdict(llm, SeveritySource.LLM_ESCALATION, vis, vc, llm, sop, notes)

    notes.append(f"falling_back_to_sop:{sop}")
    return SeverityVerdict(sop, SeveritySource.SOP, vis, vc, llm, sop, notes)
