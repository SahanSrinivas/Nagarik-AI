# NagarikAI — Pitch Deck

5 slides. 3-minute pitch. Built for Coding Ninjas "Community Hero" challenge.

**Validated on real BBMP data — 126,980 grievances across 243 real Bengaluru wards
(OpenCity / Janaagraha, H1-2025).**

---

## Slide 1 — The Problem (30 seconds)

> **Bengaluru's BBMP receives ~127,000 civic complaints in H1-2025 alone. 15% remain
> open. Crews waste km driving sub-optimal routes. Citizens get "in progress" pings
> that mean nothing.**

- **19,194 open complaints** sit across **243 wards** at the end of H1-2025 (real data).
- Road Maintenance resolves at only **58%** — the binding constraint is field-crew time, not intake volume.
- Existing apps (Swachhata, Fix My Street) close tickets with "resolved" messages that don't reflect reality. Citizens have learned to distrust them.

> Civic resolution is a **routing + verification + prediction** problem.
> Today, no one is solving it that way.

---

## Slide 2 — The Solution (40 seconds)

> **NagarikAI: a 7-agent civic platform with MILP-optimized crew dispatch,
> closed-loop status notifications, and on-chain transparency.**

| Agent | Job | Tech |
|---|---|---|
| 1. Vision | Classify issue + score severity from photo | Gemini 2.5 Flash |
| 2. Dedup | Merge duplicates within 50m | pgvector (optional) + PostGIS |
| 3. Triage | Route to correct department + SLA | Claude Sonnet + SOP table |
| 4. Verification | Notify nearest 5 citizens, collect XP | Web Push + gamified |
| 5. Scheduler | Solve CVRPTW for tomorrow's crews | Google OR-Tools |
| 6. Resolution | Verify fix via CLIP image similarity | CLIP ViT-B/32 |
| 7. Insights | Train next-30-day hotspot heatmap | LightGBM on weather + history |

Citizen sees: snap → confirm → track on `/tracking/[id]` with live timeline.
City sees: optimized dispatch on `/milp` + predicted-risk heatmap on `/map`.

---

## Slide 3 — Multi-Agent Architecture (40 seconds)

> **LangGraph orchestrates the 7 agents. Every transition writes (a) an audit
> event the UI streams via SSE, AND (b) a human-readable Notification to the
> reporter — closing the loop the existing apps leave open.**

```
Citizen (photo + GPS)
  │
  ├─→ [1] VisionAgent       — classify type + severity (Gemini)
  ├─→ [2] DedupAgent        — merge duplicates within 50m
  ├─→ [3] TriageAgent       — route to dept, set SLA  → notify citizen
  ├─→ [4] VerificationAgent — community confirms
  ├─→ [5] SchedulerAgent    — MILP solves crew dispatch → notify citizen
  ├─→ [6] ResolutionAgent   — verify fix from after-photo
  └─→ [7] InsightsAgent     — feed predictive layer
```

- Each agent is a Python function wrapped by a LangGraph node.
- Failures are caught — one agent failing doesn't kill the loop.
- AgentEvents stream via SSE → judges see the agents firing live on stage.
- Notifications surface to the citizen on `/tracking/[id]` in real time.

---

## Slide 4 — The MILP Optimization (50 seconds)

> **The core technical win: severity-weighted Capacitated VRP with Time Windows
> and Skill Matching.**

```
minimize  α · Σ w_i · max(0, t_i − SLA_i)        ← severity-weighted lateness
        + β · Σ d_ij · x_ijk                      ← travel cost (km)
        + γ · Σ w_i · u_i                         ← unserved penalty

subject to:  each issue served ≤ 1 time
             crew skill matches issue type
             crew daily capacity respected
             time windows respected
             flow conservation
```

- Decision variables: `x_ijk` (arc traversal), `t_ik` (arrival time), `u_i` (unserved)
- Solver: Google OR-Tools (Path-Cheapest-Arc + Guided Local Search). 15-second cap.

### Backtest — real BBMP backlog, head-to-head vs FIFO

The ingest reads `community-hero/data/ward_backlog.json` (243 real KGIS wards,
19,194 open complaints), distributes them by category mix into our schema, and
feeds the live DB (`--cap 50` → **17,481 real-distributed issues**, basically
the full open backlog). Then `scripts/run_real_backtest.py` runs both solvers.

| Issue load | Metric | FIFO baseline | NagarikAI MILP | Δ |
|---|---|---:|---:|---:|
| 120 / 12 crews | Total km driven | 874 km | **52 km** | **−94.1%** |
| 250 / 12 crews | Total km driven | 1,509 km | **104 km** | **−93.1%** |
| 600 / 12 crews | Total km driven | 1,311 km | **266 km** | **−79.7%** |
| **800 / 12 crews** | Total km driven | 1,019 km | **107 km** | **−89.5%** |

### What the numbers mean — honest

- **MILP cuts driving by 80–94%** on every load tested.
- FIFO appears to "serve more issues" only because it doesn't check time
  windows or SLAs — it stacks tickets until capacity is full and over-promises.
- MILP serves what it can actually deliver on time. **Honest service rate >
  inflated promise rate.**

> One MILP solve. Real BBMP data. Numbers a judge can write down — and
> reproduce by running `python -m scripts.run_real_backtest`.

---

## Slide 5 — Validation, Impact & The Demo (30 seconds)

> **Real Bengaluru data. Real solver. Real wins.**

### Data provenance
- **243 KGIS ward polygons** — DataMeet `Municipal_Spatial_Data` (real,
  rendered as a translucent overlay on `/map`)
- **126,980 grievances aggregated** — OpenCity / Janaagraha "Decoding Bengaluru's
  Civic Complaints" H1-2025 (real)
- **17,481 issues live in our DB** at `--cap 50` (real distribution across
  243 wards and 8 categories)
- **Real rainfall panel** — 60 months of Bengaluru rainfall × 243 wards (14,580
  observations); LightGBM hits **R² = 0.871** on 2025 hold-out
- **Real pothole CNN** — `data/processed/defect_cnn.pt` (~92% test accuracy
  per `defect_cnn.json`); wired into ResolutionAgent for 2-layer closure verify
- **NagarikAI MILP backtest** — `scripts/run_real_backtest.py` reads the DB and
  runs both solvers head-to-head; results in `data/processed/backtest.json`

### Closed-loop tracking (what existing apps lack)
- Every status change emits a `Notification` row addressed to the reporter
- Citizen sees a live timeline on `/tracking/{id}` — no more "in progress" lies
- Channels are pluggable: `in_app` today, `whatsapp` / `push` / `sms` tomorrow

### Closure verification (the trust differentiator)
- ResolutionAgent runs a **2-layer audit** on every after-photo:
  - Scene similarity via CLIP between before/after → catches photo swaps
  - Defect CNN (24k-param custom net, ~92% acc) → catches "same hole reposted"
- Genuine fix → status `RESOLVED` + closure notification fired
- Fake closure → reverts to `SCHEDULED`, crew has to redo
- This is what BBMP's own apps **structurally cannot do** — they trust the crew's word

### On-chain transparency
- Every `AgentEvent` Merkle-hashed and anchored to Polygon Amoy
- Soulbound NFT badges (ERC-721, transfers revert) for XP milestones
- Opt-in via `CHAIN_ENABLED` — shadow mode by default

### Live demo flow
1. Snap a photo on `/report` → 7 agents fire in &lt; 10 seconds (visible on `/agents` via SSE)
2. Citizen sees the timeline build on `/tracking/[id]` in real time
3. Operator hits `/milp` → "Solve & visualize" draws optimal routes on the map
4. Hit "Compare vs FIFO" → 80–94% km reduction headline on real data
5. `/map` shows real KGIS ward polygons + hotspot heatmap predicted by the
   real-rainfall LightGBM (toggle on/off)
6. Crew uploads after-photo → CNN audit catches "same hole" frauds, only
   genuine fixes get RESOLVED
7. `/chain` shows the live anchor; `/wallet/[id]` shows earned soulbound badges

### Why this wins
1. **7 visible agents** — judges see live SSE-streamed orchestration, not slideware
2. **Real MILP, real data** — 80%+ km reduction on actual BBMP backlog
3. **Closed feedback loop** — the brief's "real-time tracking" is enforced by code
4. **On-chain proofs + soulbound badges** — transparency moves from slide to contract
5. **Predictive layer** — LightGBM forecasts hotspots from rainfall + history
6. **Honest accounting** — we say what's real and what's interface
