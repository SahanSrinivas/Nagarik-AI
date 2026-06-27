# e2e/ci — daily verification probes

Lives at the source-of-truth for the regression scripts that `.github/workflows/daily-e2e.yml`
runs every day at **02:30 UTC (08:00 IST)** against `https://nagarikai.xyz`.

Each script is shell-only (no Python/node deps beyond `python3` for JSON
parsing) and can be run locally without any setup:

```bash
bash e2e/ci/red-team.sh    # 4 non-civic photos must reject
bash e2e/ci/happy-path.sh  # Case A pothole → verdict=verified_resolved
```

| Script | What it asserts | Wall-clock |
|---|---|---|
| `red-team.sh` | 4 deliberately non-civic photos (cat, food, indoor, selfie) all land at `status=rejected, routed=None`. Catches a guardrail regression in the Vision agent prompt or `_reject` path. | ~40 s |
| `happy-path.sh` | Submitting `case_a_reported.jpg` produces `routed=BBMP Roads`, then crew-completing with `case_a_resolved.jpg` produces `verdict=verified_resolved` (CLIP+CNN audit). Catches regressions in Gemini classification, Triage routing, Resolution agent, or seed data. | ~3 min |

The companion Playwright suite (`e2e/tests/*.spec.ts`) covers the public
routes + auth + Mapbox render and runs in the same workflow.

## Override env vars

```bash
API=http://localhost:8000 \
  DEMO_USER=H@cktHon DEMO_PASS=Sw33ney@8688 \
  bash e2e/ci/red-team.sh
```

| Var | Default | What it controls |
|---|---|---|
| `API` | `https://api.nagarikai.xyz` | API base URL |
| `DEMO_USER` / `DEMO_PASS` | `H@cktHon` / `Sw33ney@8688` | citizen demo creds |
| `DEPT_USER` / `DEPT_PASS` | `bbmp_roads_supervisor` / `supervisor2026` | dept demo creds (happy path only) |
| `BEFORE` / `AFTER` | `case_a_*.jpg` URLs | the closure-audit pair (happy path) |

## How failures surface

The workflow has a `notify-on-failure` job that opens a GitHub issue tagged
`regression, automated` when any of the three jobs (Playwright, red-team,
happy path) fails. The issue links straight to the failed run.
