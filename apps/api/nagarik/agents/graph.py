"""LangGraph orchestration of the 7-agent civic loop.

The graph is intentionally linear for v1; we add branching once the agents
make decisions worth branching on (e.g. low-confidence vision → route to
human review instead of dedup).

Each node wraps a bare agent function and writes an AgentEvent row so the
frontend's /events stream can light up the graph visualization live.
"""

from __future__ import annotations

import time
from typing import Callable

from langgraph.graph import END, START, StateGraph

from nagarik.agents.dedup_agent import run_dedup
from nagarik.agents.insights_agent import run_insights
from nagarik.agents.resolution_agent import run_resolution
from nagarik.agents.scheduler_agent import run_scheduler
from nagarik.agents.state import AgentState
from nagarik.agents.triage_agent import run_triage
from nagarik.agents.verification_agent import run_verification
from nagarik.agents.vision_agent import run_vision
from nagarik.db import SessionLocal
from nagarik.models import AgentEvent

AGENT_RUNNERS: dict[str, Callable[[AgentState], AgentState]] = {
    "vision": run_vision,
    "dedup": run_dedup,
    "triage": run_triage,
    "verification": run_verification,
    "scheduler": run_scheduler,
    "resolution": run_resolution,
    "insights": run_insights,
}


def _emit(issue_id: str, agent: str, status: str, payload: dict, duration_ms: int | None) -> None:
    with SessionLocal() as db:
        db.add(
            AgentEvent(
                issue_id=issue_id,
                agent=agent,
                status=status,
                payload=payload,
                duration_ms=duration_ms,
            )
        )
        db.commit()


def _wrap(agent_name: str) -> Callable[[AgentState], AgentState]:
    runner = AGENT_RUNNERS[agent_name]

    def node(state: AgentState) -> AgentState:
        t0 = time.perf_counter()
        _emit(state["issue_id"], agent_name, "started", {}, None)
        try:
            new_state = runner(state)
            elapsed = int((time.perf_counter() - t0) * 1000)
            _emit(
                state["issue_id"],
                agent_name,
                "completed",
                {k: v for k, v in new_state.items() if k != "issue_id"},
                elapsed,
            )
            return new_state
        except Exception as exc:  # noqa: BLE001 — log everything; one agent failing shouldn't kill the loop
            elapsed = int((time.perf_counter() - t0) * 1000)
            _emit(state["issue_id"], agent_name, "failed", {"error": str(exc)}, elapsed)
            errors = list(state.get("errors", []))
            errors.append(f"{agent_name}: {exc}")
            return {**state, "errors": errors}  # type: ignore[return-value]

    return node


def _after_vision(state: AgentState) -> str:
    """Short-circuit the graph when Vision has rejected the submission
    (cat / selfie / indoor / low-confidence / image-fetch failure). Without
    this, Dedup → Triage → Scheduler all run on junk input and end up
    routing phantom complaints to BBMP Helpdesk."""
    return "__end__" if state.get("rejected") else "dedup"


def build_graph():
    g = StateGraph(AgentState)
    for name in AGENT_RUNNERS:
        g.add_node(name, _wrap(name))

    g.add_edge(START, "vision")
    g.add_conditional_edges("vision", _after_vision, {"dedup": "dedup", "__end__": END})
    g.add_edge("dedup", "triage")
    g.add_edge("triage", "verification")
    g.add_edge("verification", "scheduler")
    g.add_edge("scheduler", "resolution")
    g.add_edge("resolution", "insights")
    g.add_edge("insights", END)
    return g.compile()


GRAPH = build_graph()


def run_agent_loop(issue_id: str) -> None:
    """Entry point fired from FastAPI BackgroundTasks after a new issue lands.

    After the 7-agent graph finishes (status ends at SCHEDULED), kick off
    the demo auto-progress simulator — this is what walks the ticket all
    the way to RESOLVED in ~16s so the citizen's /tracking page doesn't
    stall at 'Awaiting next update' during demos. No-op in production when
    DEMO_AUTO_PROGRESS=0.
    """
    GRAPH.invoke({"issue_id": issue_id})
    try:
        from nagarik.jobs.demo_progress import maybe_simulate
        maybe_simulate(issue_id)
    except Exception as exc:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).warning("demo simulate kick-off failed: %s", exc)
