"""Deterministic guardrails for the LLM-proposed routing layer.

Design — "model proposes, gate decides":
  1. The LLM looks at the issue + vision metadata and emits a RouteProposal.
  2. This module validates that proposal against canonical allowlists
     (issue types, departments, SLA bounds, severity bounds).
  3. If ANY check fails, the gate REJECTS the proposal and the caller falls
     back to the deterministic SOP. The disagreement is recorded so we can
     audit how often the LLM was wrong.
  4. The proposal's free-text `reasoning` is PII-scrubbed before logging.

The gate is intentionally paranoid. A wrong route on a sewage emergency
isn't worth saving 50ms by trusting an unconfirmed LLM hint.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

# --- Canonical allowlists -------------------------------------------------

ALLOWED_TYPES: set[str] = {
    "pothole", "garbage", "streetlight", "water_leak",
    "sewage", "tree_fall", "encroachment", "other",
}

ALLOWED_DEPARTMENTS: set[str] = {
    "BBMP Roads",
    "BBMP SWM",
    "BESCOM Streetlight",
    "BWSSB",
    "BBMP Horticulture",
    "BBMP Town Planning",
    "BBMP Helpdesk",
}

# SOP — same single source of truth as triage_agent.py. Keep these aligned.
SOP_TABLE: dict[str, tuple[str, int]] = {
    "pothole":      ("BBMP Roads",         72),
    "garbage":      ("BBMP SWM",           24),
    "streetlight":  ("BESCOM Streetlight", 48),
    "water_leak":   ("BWSSB",              12),
    "sewage":       ("BWSSB",              24),
    "tree_fall":    ("BBMP Horticulture",   6),
    "encroachment": ("BBMP Town Planning", 168),
    "other":        ("BBMP Helpdesk",      72),
}

SLA_MIN_HOURS = 1
SLA_MAX_HOURS = 720          # 30 days — anything longer is a planning matter
SEVERITY_MIN = 1
SEVERITY_MAX = 5
MAX_REASONING_CHARS = 240    # keep audit logs short
PROMPT_INJECTION_MARKERS = (
    "ignore previous", "ignore the above", "disregard", "system prompt",
    "you are now", "act as", "new instructions",
)


# --- Schemas --------------------------------------------------------------

class GateVerdict(str, Enum):
    ACCEPTED = "accepted"        # all checks passed
    CORRECTED = "corrected"      # accepted with SLA clamped/severity adjusted
    REJECTED = "rejected"        # used SOP instead
    REJECTED_INJECTION = "rejected_prompt_injection"
    REJECTED_PII = "rejected_pii"
    REJECTED_HALLUCINATION = "rejected_unknown_value"


@dataclass(slots=True)
class RouteProposal:
    """Raw LLM output — untrusted until guardrails clear it."""
    type: str
    department: str
    sla_hours: int
    severity: int
    reasoning: str = ""

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "RouteProposal | None":
        if not isinstance(d, dict):
            return None
        try:
            return cls(
                type=str(d.get("type", "")).lower().strip(),
                department=str(d.get("department", "")).strip(),
                sla_hours=int(d.get("sla_hours", 0)),
                severity=int(d.get("severity", 3)),
                reasoning=str(d.get("reasoning", "")).strip(),
            )
        except (TypeError, ValueError):
            return None


@dataclass(slots=True)
class GateResult:
    """What the caller acts on."""
    verdict: GateVerdict
    department: str
    sla_hours: int
    severity: int
    used_sop: bool
    proposal: RouteProposal | None
    reasoning: str = ""
    disagreements: list[str] = field(default_factory=list)


# --- PII / injection scrubbers --------------------------------------------

_PII_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("phone",   re.compile(r"(?:\+?\d{1,3}[-\s]?)?(?:\d{4}[-\s]?\d{6}|\d{10})")),
    ("email",   re.compile(r"[\w.+-]+@[\w-]+\.[a-zA-Z.]{2,}")),
    ("aadhaar", re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")),
    ("pan",     re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")),
]


def scrub_pii(text: str) -> tuple[str, list[str]]:
    flagged: list[str] = []
    cleaned = text
    for name, pat in _PII_PATTERNS:
        if pat.search(cleaned):
            flagged.append(name)
            cleaned = pat.sub("[REDACTED]", cleaned)
    return cleaned, flagged


def looks_like_injection(text: str) -> bool:
    low = text.lower()
    return any(marker in low for marker in PROMPT_INJECTION_MARKERS)


# --- Main gate function ---------------------------------------------------

def evaluate(
    proposal: RouteProposal | None,
    *,
    vision_type: str | None = None,
    vision_severity: int | None = None,
) -> GateResult:
    """Validate an LLM proposal against the SOP. Fall back to SOP on any failure.

    Args:
        proposal: parsed LLM output; None if the call failed or returned junk.
        vision_type: what the VisionAgent classified the photo as (trusted).
        vision_severity: same.

    Returns: a GateResult ready to persist; never raises.
    """
    disagreements: list[str] = []

    # 1) No proposal at all → straight SOP fallback.
    if proposal is None:
        return _sop_fallback(vision_type, vision_severity, "no_proposal")

    # 2) Prompt-injection scan on the LLM's own reasoning string.
    if looks_like_injection(proposal.reasoning):
        return GateResult(
            verdict=GateVerdict.REJECTED_INJECTION,
            **_sop_fields(vision_type, vision_severity),
            used_sop=True,
            proposal=proposal,
            reasoning="rejected: prompt-injection markers in reasoning",
            disagreements=["prompt_injection_in_reasoning"],
        )

    # 3) PII scrub on reasoning — keep but redact.
    cleaned_reasoning, pii_flags = scrub_pii(proposal.reasoning[:MAX_REASONING_CHARS])
    if pii_flags:
        disagreements.append("pii_in_reasoning:" + ",".join(pii_flags))

    # 4) Issue type must be in allowlist.
    if proposal.type not in ALLOWED_TYPES:
        return GateResult(
            verdict=GateVerdict.REJECTED_HALLUCINATION,
            **_sop_fields(vision_type, vision_severity),
            used_sop=True,
            proposal=proposal,
            reasoning=f"rejected: type={proposal.type!r} not in allowlist",
            disagreements=disagreements + [f"unknown_type:{proposal.type}"],
        )

    # 5) Issue type must agree with VisionAgent (vision is the source of truth on type).
    if vision_type and proposal.type != vision_type:
        disagreements.append(f"type_mismatch:llm={proposal.type},vision={vision_type}")

    # 6) Department must be in allowlist.
    if proposal.department not in ALLOWED_DEPARTMENTS:
        return GateResult(
            verdict=GateVerdict.REJECTED_HALLUCINATION,
            **_sop_fields(vision_type, vision_severity),
            used_sop=True,
            proposal=proposal,
            reasoning=f"rejected: department={proposal.department!r} not in allowlist",
            disagreements=disagreements + [f"unknown_department:{proposal.department}"],
        )

    # 7) Type↔Department mapping must match the SOP (the load-bearing check).
    final_type = vision_type or proposal.type
    sop_dept, sop_sla = SOP_TABLE[final_type]
    if proposal.department != sop_dept:
        # The LLM picked a real dept, just the wrong one. Override.
        disagreements.append(f"department_mismatch:llm={proposal.department},sop={sop_dept}")
        return GateResult(
            verdict=GateVerdict.REJECTED,
            department=sop_dept,
            sla_hours=_apply_severity(sop_sla, vision_severity or proposal.severity),
            severity=_clamp_severity(vision_severity or proposal.severity),
            used_sop=True,
            proposal=proposal,
            reasoning=f"sop overrode: {proposal.department} → {sop_dept}",
            disagreements=disagreements,
        )

    # 8) SLA bounds + severity bounds — clamp if out of range, don't reject.
    sla = max(SLA_MIN_HOURS, min(SLA_MAX_HOURS, proposal.sla_hours))
    if sla != proposal.sla_hours:
        disagreements.append(f"sla_clamped:{proposal.sla_hours}→{sla}")
    severity = _clamp_severity(vision_severity or proposal.severity)
    sla = _apply_severity(sla, severity)

    # 9) If everything cleared, accept. Mark CORRECTED if we had to clamp.
    final_verdict = GateVerdict.ACCEPTED if not disagreements else GateVerdict.CORRECTED
    return GateResult(
        verdict=final_verdict,
        department=proposal.department,
        sla_hours=sla,
        severity=severity,
        used_sop=False,
        proposal=proposal,
        reasoning=cleaned_reasoning,
        disagreements=disagreements,
    )


# --- Internals ------------------------------------------------------------

def _sop_fields(vision_type: str | None, vision_severity: int | None) -> dict[str, Any]:
    t = vision_type if (vision_type in ALLOWED_TYPES) else "other"
    dept, sla = SOP_TABLE[t]
    sev = _clamp_severity(vision_severity if vision_severity is not None else 3)
    return {"department": dept, "sla_hours": _apply_severity(sla, sev), "severity": sev}


def _sop_fallback(vision_type: str | None, vision_severity: int | None, reason: str) -> GateResult:
    fields = _sop_fields(vision_type, vision_severity)
    return GateResult(
        verdict=GateVerdict.REJECTED,
        **fields,
        used_sop=True,
        proposal=None,
        reasoning=f"sop fallback: {reason}",
        disagreements=[reason],
    )


def _apply_severity(sla_hours: int, severity: int) -> int:
    """Halve the SLA for severe issues — same rule as the legacy SOP path."""
    return max(SLA_MIN_HOURS, sla_hours // 2 if severity >= 4 else sla_hours)


def _clamp_severity(v: int | None) -> int:
    if v is None:
        return 3
    try:
        return max(SEVERITY_MIN, min(SEVERITY_MAX, int(v)))
    except (TypeError, ValueError):
        return 3
