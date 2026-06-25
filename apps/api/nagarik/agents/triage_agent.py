"""Agent 3 — TriageAgent.

Two-stage routing: the LLM proposes, the deterministic gate decides.

  1. `llm_router.propose()` — Claude looks at the report + vision output and
     produces a structured RouteProposal (constrained via tool-use schema).
  2. `guardrails.evaluate()` — validates the proposal against the canonical
     SOP table, allowlists, SLA bounds, severity bounds, PII, and prompt
     injection. ANY failure → fall back to SOP.

Why? The LLM gives us nuance for edge cases (a complaint that says
"streetlight pole leaning over road" is *technically* tree_fall + electrical
— the LLM can spot the dual-mandate). The gate keeps the model honest:
hallucinated departments, wrong SLAs, prompt-injection in the description,
PII in the reasoning — all caught deterministically.

When ANTHROPIC_API_KEY is missing the agent just runs the SOP path with no
behaviour change — the LLM layer is purely additive.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from nagarik.agents.guardrails import GateResult, GateVerdict, evaluate
from nagarik.agents.llm_router import propose
from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Issue, IssueStatus


def run_triage(state: AgentState) -> AgentState:
    if state.get("is_duplicate"):
        return state

    vision_type = state.get("classified_type")
    vision_severity = state.get("severity")

    # Read the description so we can hand it to the LLM. Pulling from the DB
    # here keeps the agent self-contained.
    description = ""
    with SessionLocal() as db:
        issue = db.get(Issue, state["issue_id"])
        if issue is not None:
            description = issue.description or ""

    # Stage 1 — LLM proposes (returns None if API key missing or call failed).
    proposal = propose(description, vision_type=vision_type, vision_severity=vision_severity)

    # Stage 2 — gate decides. Always produces a usable GateResult.
    gate: GateResult = evaluate(proposal, vision_type=vision_type, vision_severity=vision_severity)

    deadline = datetime.now(timezone.utc) + timedelta(hours=gate.sla_hours)

    with SessionLocal() as db:
        db.execute(
            update(Issue)
            .where(Issue.id == state["issue_id"])
            .values(
                routed_department=gate.department,
                sla_deadline=deadline,
                severity=gate.severity,
                status=IssueStatus.TRIAGED,
            )
        )
        db.commit()

    # Close the loop for the citizen.
    from nagarik.notifications import emit
    emit(state["issue_id"], "classified")
    emit(state["issue_id"], "triaged")

    # Bubble up routing telemetry — the /agents view shows this per-issue.
    routing_meta = {
        "gate_verdict": gate.verdict.value,
        "used_sop_fallback": gate.used_sop,
        "disagreements": gate.disagreements,
        "llm_proposed": (
            {
                "type": gate.proposal.type,
                "department": gate.proposal.department,
                "sla_hours": gate.proposal.sla_hours,
                "severity": gate.proposal.severity,
            }
            if gate.proposal
            else None
        ),
        "final": {
            "department": gate.department,
            "sla_hours": gate.sla_hours,
            "severity": gate.severity,
        },
        "reasoning": gate.reasoning,
    }

    return {
        **state,
        "routed_department": gate.department,
        "sla_hours": gate.sla_hours,
        "severity": gate.severity,
        "ai_meta": {**(state.get("ai_meta") or {}), "routing": routing_meta},
    }  # type: ignore[return-value]
