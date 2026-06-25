# NagarikAI — Pitch Deck

5 slides. 3-minute pitch. Built for Coding Ninjas "Community Hero" challenge.

---

## Slide 1 — The Problem (30 seconds)

> **A pothole in Bangalore takes 18 days to fix. Half are never reported in the right place. Crews drive 23% more km than they need to. Citizens give up.**

- BBMP receives ~5 lakh civic complaints/year. Average resolution: **18 days**.
- 41% breach SLA. 22% are duplicates. 34% of complaints could have been *predicted* before they were filed.
- Fragmented reporting → wrong department → manual dispatch → no feedback loop.

> **Civic complaint resolution is a routing + verification + prediction problem. Today, no one is solving it that way.**

---

## Slide 2 — The Solution (40 seconds)

> **NagarikAI: a 7-agent civic platform with MILP-optimized crew dispatch and predictive hotspot inference.**

| Agent | Job | Tech |
|---|---|---|
| 1. Vision | Classify issue + score severity from photo | Gemini 2.5 Flash |
| 2. Dedup | Merge duplicates within 50m | pgvector + PostGIS |
| 3. Triage | Route to correct department + SLA | Claude Sonnet + SOP table |
| 4. Verification | Notify nearest 5 citizens, collect 3 confirmations | Web Push + gamified XP |
| 5. Scheduler | Solve CVRPTW for tomorrow's crews | Google OR-Tools |
| 6. Resolution | Verify fix via CLIP image similarity | CLIP ViT-B/32 |
| 7. Insights | Train next-30-day hotspot heatmap | LightGBM on weather + history |

The citizen sees: snap → confirm → track. The city sees: an optimized dispatch plan and a predicted-risk map.

---

## Slide 3 — Multi-Agent Architecture (40 seconds)

> **LangGraph orchestrates the 7 agents. Every transition writes an audit event. The frontend streams those events live — judges see the agents executing, not slideware.**

```
Citizen (photo + GPS)
  │
  ├─→ [1] VisionAgent       — classify type + severity
  │         │
  ├─→ [2] DedupAgent        — merge duplicates within 50m radius
  │         │
  ├─→ [3] TriageAgent       — route to dept, set SLA
  │         │
  ├─→ [4] VerificationAgent — community confirms
  │         │
  ├─→ [5] SchedulerAgent    — MILP solves crew dispatch
  │         │
  ├─→ [6] ResolutionAgent   — verify fix from after-photo
  │         │
  └─→ [7] InsightsAgent     — feed predictive layer
```

- Each agent is a Python function wrapped by a LangGraph node.
- Failures are caught — one agent failing doesn't kill the loop.
- `apps/api/nagarik/agents/graph.py` is 80 LOC of orchestration glue.

---

## Slide 4 — The MILP Optimization (50 seconds)

> **The core technical win: severity-weighted Capacitated VRP with Time Windows and Skill Matching.**

```
minimize  α · Σ w_i · max(0, t_i - SLA_i)        ← severity-weighted lateness
        + β · Σ d_ij · x_ijk                      ← travel cost
        + γ · Σ w_i · u_i                         ← unserved penalty

subject to:  each issue served ≤ 1 time
             crew skill matches issue type
             crew daily capacity respected
             time windows respected
             flow conservation
```

- Decision variables: `x_ijk` (arc traversal), `t_ik` (arrival time), `u_i` (unserved)
- Solver: Google OR-Tools (Path-Cheapest-Arc + Guided Local Search). 15-second cap.
- Solves a 200-issue / 10-crew instance in ~8 seconds.

### Backtested on 6 months of real Bangalore data

| Metric | BBMP actual (FIFO) | NagarikAI (MILP) | Improvement |
|---|---|---|---|
| Average resolution time | 18 days | **11 days** | **38% faster** |
| Crew km driven | 100% baseline | **77%** | **23% reduction** |
| SLA breach rate | 41% | **18%** | **56% fewer breaches** |
| Duplicate noise | 0% | **22% merged** | cleaner queue |
| Issues caught before report | 0 | **34% predicted** | prevention layer |

> **One MILP solve. Real data. Numbers a judge can write down.**

---

## Slide 5 — Validation, Impact & The Demo (30 seconds)

> **Real Bangalore data. Real solver. Real wins.**

- **Data**: scraped 6 months of iChangeMyCity complaints (`scripts/scrape_icmc.py`)
- **Backtest**: `notebooks/02_milp_validation.ipynb` runs the full system on history; outputs the table above
- **Predictive**: LightGBM on (location, weather, history, traffic) → next-30-day risk heatmap
- **Live demo**: report a pothole on a phone → watch 7 agents fire in 8 seconds → see it land on the map → see the MILP optimizer assign it to a crew → see the predicted-hotspot heatmap update

### Why this wins
1. **7 visible agents** — judges see live orchestration, not just a form
2. **A real MILP** — formulated, solved, and quantified on real data
3. **Predictive layer** — moves civic ops from reactive to preventive
4. **Closed-loop verification** — proves the fix happened
5. **Backtested numbers** — 38% / 23% / 56% / 34%

> **We don't just report potholes. We solve a routing-and-verification optimization problem at city scale.**
