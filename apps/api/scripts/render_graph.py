"""Emit a Mermaid diagram of the LangGraph 7-agent pipeline.

Two outputs:
  docs/agent_graph.mmd   ← editable Mermaid source
  docs/agent_graph.md    ← markdown wrapper that GitHub auto-renders

For a real SVG, paste the .mmd into https://mermaid.live and Export → SVG,
or run `mmdc -i docs/agent_graph.mmd -o docs/agent_graph.svg` if you have
the Mermaid CLI installed.

Usage:
    python -m scripts.render_graph
"""

from __future__ import annotations

from pathlib import Path

MERMAID = """flowchart TD
    citizen([🧍 Citizen photo + GPS])
    citizen --> A1

    subgraph LangGraph[" 7-agent LangGraph loop "]
        direction TB
        A1["1 · VisionAgent\\n(Gemini 2.5 Flash)\\nclassify · severity"]
        A2["2 · DedupAgent\\n(PostGIS + pgvector)\\nmerge within 50m"]
        A3["3 · TriageAgent\\n(SOP table)\\nroute dept + SLA"]
        A4["4 · VerificationAgent\\nnotify 5 nearest · gamified XP"]
        A5["5 · SchedulerAgent\\n(OR-Tools MILP CVRPTW)\\nseverity-weighted dispatch"]
        A6["6 · ResolutionAgent\\n(CLIP similarity)\\nverify after-photo"]
        A7["7 · InsightsAgent\\nfeed LightGBM predictor"]
        A1 --> A2 --> A3 --> A4 --> A5 --> A6 --> A7
    end

    A2 -. duplicate? .-> drop[(skip remaining)]
    A7 --> heatmap[/🗺️ next-30-day risk heatmap/]
    A5 --> dispatch[/🛻 tomorrow's optimal crew routes/]
    A6 --> resolved[/✅ closed with proof/]

    A1 -.->|emits AgentEvent| chain
    A5 -.->|emits AgentEvent| chain
    A6 -.->|emits AgentEvent| chain
    chain[[⛓ AuditAnchor.sol\\nMerkle root → Polygon]]

    A4 -.->|hit XP milestone| badge[[🏅 CivicBadge.sol\\nsoulbound NFT]]

    classDef agent fill:#0f766e,stroke:#0f766e,color:#fff
    classDef out   fill:#ecfdf5,stroke:#10b981,color:#064e3b
    classDef chain fill:#fef3c7,stroke:#b45309,color:#7c2d12
    class A1,A2,A3,A4,A5,A6,A7 agent
    class heatmap,dispatch,resolved out
    class chain,badge chain
"""


def main() -> None:
    docs = Path(__file__).resolve().parents[3] / "docs"
    docs.mkdir(parents=True, exist_ok=True)

    mmd_path = docs / "agent_graph.mmd"
    md_path = docs / "agent_graph.md"

    mmd_path.write_text(MERMAID)
    md_path.write_text(
        "# NagarikAI — Agent Graph\n\n"
        "```mermaid\n" + MERMAID + "```\n\n"
        "Edit source: [`agent_graph.mmd`](agent_graph.mmd). "
        "Render to SVG with `mmdc -i agent_graph.mmd -o agent_graph.svg`.\n"
    )
    print(f"wrote {mmd_path}")
    print(f"wrote {md_path}")


if __name__ == "__main__":
    main()
