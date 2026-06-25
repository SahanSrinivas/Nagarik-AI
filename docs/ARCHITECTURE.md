# NagarikAI — Architecture Notes

## High-level

```
                  ┌──────────────────────────────────────────────┐
                  │            Citizen Touchpoints                │
                  │                                                │
   PWA  ──────────┤  Next.js 14 / Tailwind / Mapbox GL            │
   (Web Push)     │  src/app/{report,map,agents,milp,dashboard}    │
                  └────────────────────┬─────────────────────────┘
                                       │  HTTPS
                                       ▼
                  ┌──────────────────────────────────────────────┐
                  │            FastAPI (apps/api)                 │
                  │  /issues  /verify  /schedule  /insights       │
                  └──────────┬─────────┬──────────┬───────────────┘
                             │         │          │
              ┌──────────────┘         │          └───────────────┐
              ▼                        ▼                          ▼
   ┌────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐
   │  LangGraph         │  │  OR-Tools           │  │  Postgres + PostGIS  │
   │  7-agent loop      │  │  CVRPTW solver      │  │  pgvector            │
   │  (background task) │  │  (sync, in-process) │  │  (issues, events)    │
   └────────────────────┘  └─────────────────────┘  └──────────────────────┘
              │                                                   ▲
              └──── writes AgentEvent rows ───────────────────────┘
```

## Key design choices

### Why FastAPI + Postgres, not Django + Mongo?
This is a hackathon. FastAPI gives us auto-OpenAPI docs, native async, and a
faster boot than Django for a 4-week build. Postgres + PostGIS + pgvector is
one container with all the geospatial + embedding power we need.

### Why a background task, not Celery?
Cold start matters in a demo. FastAPI's `BackgroundTasks` is good enough for
a 7-agent loop that completes in ~10 seconds. Production would move this to
Cloud Tasks.

### Why OR-Tools instead of writing the MILP in PuLP/Gurobi?
- Free, no licence dance
- Python-native, no model→solver translation
- Built-in CVRPTW primitives (capacity dimension, time-window dimension, disjunctions for unserved)
- Demo-friendly: solves 200×10 in seconds

### Why LangGraph?
- Per-node state passing is structured (TypedDict)
- Failure isolation per node
- Visualizable graph (`graph.get_graph().draw_mermaid()` returns SVG)
- We replace later with a custom orchestrator if needed; LangGraph is the
  shortest path to "judges can see the agents firing"

## Data flow for a single report

1. Citizen POSTs `/issues` from PWA with `{lat, lng, photo_url, description}`
2. FastAPI inserts an `Issue` row and schedules `run_agent_loop(issue_id)`
3. LangGraph fires nodes in sequence. Each:
   - emits an `AgentEvent(status=started)`
   - runs its function (vision/dedup/triage/...)
   - mutates `AgentState`
   - persists relevant fields back to the `Issue` row
   - emits an `AgentEvent(status=completed, duration_ms=...)`
4. The `/agents?issue=...` page polls `/issues/{id}/events` every 1.5s and
   renders the pipeline lit up in real time

## Database extensions

```sql
CREATE EXTENSION postgis;        -- ST_DWithin, GEOGRAPHY
CREATE EXTENSION vector;         -- pgvector for CLIP embedding similarity
CREATE EXTENSION pg_trgm;        -- fuzzy text search on ward names
```

## MILP formulation (full)

See `apps/api/nagarik/milp/cvrptw.py` docstring. Variables, objective, and
constraints are documented inline.

Key non-obvious bits:
- We use *disjunctions* with `GAMMA_UNSERVED * severity` cost to let the
  solver drop hopeless issues rather than infeasibilise the model
- Time windows are *soft* via `SetCumulVarSoftUpperBound` so SLA breaches
  are penalised but allowed — matches reality
- Skill mismatch is encoded by removing the vehicle from `VehicleVar` for
  that node — cheaper than a constraint

## What's stubbed vs real

| Component | Stubbed | Real |
|---|---|---|
| VisionAgent | Returns "pothole" if no Google key | Calls Gemini Vision 2.5 Flash |
| DedupAgent | PostGIS nearest-only | + CLIP cosine in pgvector |
| ResolutionAgent | Always returns 0.92 | CLIP similarity before/after |
| InsightsAgent | No-op | Writes training row, refreshes LightGBM tile cache |
| OSRM travel matrix | Haversine fallback | OSRM HTTP API |
| Auth | demo citizen | Clerk phone OTP |
| Push notifications | AgentEvent only | Web Push + FCM |

Roadmap to fill these is in `README.md`.
