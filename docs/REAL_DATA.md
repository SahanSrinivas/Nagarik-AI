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
