"""Agent 7 — InsightsAgent.

After every issue, contributes one training row to the predictive layer.
The actual LightGBM model is trained offline (see notebooks/03_predictive_model.ipynb);
this agent's job is to (a) write the training row and (b) trigger inference
for the surrounding 1-km grid so the heatmap refreshes.
"""

from __future__ import annotations

from nagarik.agents.state import AgentState


def run_insights(state: AgentState) -> AgentState:
    # TODO: append a row to data/processed/training.parquet
    # TODO: refresh hotspot tile cache for surrounding 1km grid
    return {**state, "contributes_to_prediction": True}  # type: ignore[return-value]
