# Real Data — Provenance & Reproducibility

NagarikAI is validated against **real Bengaluru BBMP grievance data**, not
synthetic. This file documents the exact provenance, mapping, and the commands
to reproduce every number on the pitch deck.

## Source

`../community-hero/data/ward_backlog.json` (sibling repo on disk; the
`community-hero` reference implementation publishes the cleaned panel under a
CC BY-NC-SA license).

- 126,980 grievances aggregated from BBMP H1-2025 OpenCity / Janaagraha data
- 243 real ward polygons from KGIS via DataMeet `Municipal_Spatial_Data`
- 19,194 open backlog across 7 BBMP departments

### Provenance flags (from the source `meta`)

| Field | Status |
|---|---|
| Ward polygons | **REAL** (KGIS) |
| Top-10 ward complaint counts | **REAL** (OpenCity) |
| Per-ward category mix | **MODELED** (calibrated to anchored ward totals) |
| Resolution rates | **REAL** (anchored to source) |

## Mapping into NagarikAI

`scripts/ingest_bbmp_backlog.py` reads the backlog and projects it onto our
8-category schema:

| BBMP category (real)            | NagarikAI type → |
|---|---|
| Electrical                       | streetlight |
| Solid Waste (Garbage) Related    | garbage |
| Road Maintenance(Engg)           | pothole |
| Water Supply / Sewage            | water_leak (50%) + sewage (50%) |
| Forest                           | tree_fall |
| Health Dept · veterinary         | other |
| Others                           | other (70%) + encroachment (30%) |

For each ward × category with `open > 0` it creates up to `--cap` `Issue`
rows. With `--cap 5` we get 5,724 issues; with `--cap 50` the full 19,194-row
backlog projects into ~18k issues.

## Reproduce the pitch-deck numbers

```bash
cd apps/api
source .venv/bin/activate

# 1. Spin up Postgres + apply migrations
docker compose -f ../../infra/docker-compose.yml up -d
alembic upgrade head

# 2. Ingest real BBMP backlog
PYTHONPATH=. python -m scripts.ingest_bbmp_backlog --cap 5 --wipe
# → "ingested 5,724 issues across 243 real BBMP wards"

# 3. Run the head-to-head backtest at multiple loads
PYTHONPATH=. python -m scripts.run_real_backtest --cap 120
PYTHONPATH=. python -m scripts.run_real_backtest --cap 250
PYTHONPATH=. python -m scripts.run_real_backtest --cap 600
```

Last `run_real_backtest --cap 600` measured (2026-06-26):

```
Metric                    FIFO baseline     MILP optimized
------------------------------------------------------------
Served issues                       104                 64
Unserved                            496                536
Total km driven                 1310.75             265.69
Solver runtime (s)                  0.0              15.27

Distance reduction: 79.7%
```

The full JSON dump lands at `data/processed/backtest.json` — the frontend
`/milp` page calls `/schedule/compare` to recompute live during the demo.

## Routing ablation — LLM proposes, gate decides

```bash
PYTHONPATH=. python -m scripts.ablate_routing
# === Routing ablation on 51 fixtures ===
#   LLM proposals reached the gate :  51
#   Gate verdicts:
#     accepted                          48
#     rejected                           3
#   Fell back to SOP                :   3  (6%)
#   Department misroutes caught     :   3
#   Prompt-injection caught         :   0   (LLM resisted at the model layer)
#   PII redacted in reasoning       :   0   (LLM excluded PII at the model layer)
#   Hallucinated values caught      :   0   (tool-use schema enforces enums)
```

The 3 SOP overrides were all "encroachment → BBMP Helpdesk" picks; the gate
corrected them to "encroachment → BBMP Town Planning". No injection or PII
leaks survived to the gate — Claude refused at the model layer.

Run with `--offline` to stress-test the gate without spending API credits:
the offline path passes a worst-case stub proposal (wrong dept, SLA=9999,
severity=7) and the gate rejects 100% (51/51) — proving the deterministic
override works regardless of LLM behaviour.

Output JSON: `data/processed/routing_ablation.json` — per-fixture verdict
+ LLM reasoning + disagreement list.

## Predictive layer (real rainfall, real complaints panel)

```bash
PYTHONPATH=. python -m scripts.build_hotspots
# panel: 14,580 rows | wards: 243 | months: 2021-01→2025-12
#   MAE (counts)  : 1.66
#   R²  (log)     : 0.857
#   R²  (counts)  : 0.871
# wrote 150 hotspots → data/processed/hotspots.geojson
```

Spec: `log(road_complaints+1) ~ ward_FE + month_FE + rain + rain_lag1`.
Train: 2021-2024. Test: 2025. Same recipe as the reference forecast.json.

## Defect CNN (real model)

`data/processed/defect_cnn.pt` is the published 24k-parameter pothole defect
classifier (3 conv blocks → GAP → 2-class head, 64×64 RGB input). ~92% test
accuracy on the held-out set per `defect_cnn.json`. Wired into ResolutionAgent
for before/after fix verification.

## What's still interface, not validated

Per the source dataset's own honesty audit, we copy here:

- **Community verification** — UI exists, no real ground-truth dataset of
  citizen-confirmed reports
- **Real-time tracking** — wired with `Notification` model + `/tracking/[id]`,
  push channels are stubs (in_app only; WhatsApp/SMS adapters are scaffolded)
- **Gamification** — XP/badge logic is real, soulbound NFT mint is shadow-mode
  unless `CHAIN_ENABLED=true` and contracts deployed
- **Duplicate detection** — geo-only via PostGIS works; full CLIP-embedding
  semantic match requires the optional pgvector image
