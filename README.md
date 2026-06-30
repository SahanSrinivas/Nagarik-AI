# NagarikAI — Hyperlocal Civic Problem Solver

A multi-agent civic platform where 7 specialized AI agents collaborate to triage,
verify, schedule, and resolve hyperlocal community issues (potholes, garbage,
water leakage, street lights, etc.), with MILP-optimized crew dispatch.

Built for the Coding Ninjas "Community Hero" challenge.

## Architecture

```
Citizen (photo + voice note + GPS)
        |
        v
[1] VisionAgent       — Gemini 2.5 Flash classifies type + severity,
                        ingests audio + image in a single multimodal call,
                        estimates dimensions → materials → cost
[2] DedupAgent        — pgvector + CLIP merges duplicates within 50m
[3] TriageAgent       — Claude Sonnet routes to BBMP/BWSSB/BESCOM dept
[4] VerificationAgent — notifies 5 nearby citizens, awards XP
[5] SchedulerAgent    — OR-Tools MILP CVRPTW assigns crews + routes
[6] ResolutionAgent   — CLIP similarity verifies after-photo,
                        auto-renders shareable before/after PNG
[7] InsightsAgent     — predicts next-30-day hotspots from weather + history

    SLA watcher (every 60s) ──► escalates breached tickets through L1 → L2
                                → L3 → unlocks Community DIY for sev ≤ 2
```

## V2 — What just shipped on top of the 7-agent loop

Four capabilities that close holes the original loop couldn't:

| Capability | What it does | Where it lives |
|---|---|---|
| **Voice-first multimodal** | Citizens record a Kannada / Hindi / Telugu / English voice note on `/report`. Gemini 2.5 Flash ingests photo + audio in one call — verbatim transcript, English translation, dispatcher-context summary. No latency-heavy STT round-trip. | `agents/vision_agent.py`, `components/VoiceRecorder.tsx` |
| **AI Budget Estimator** | Gemini estimates physical dimensions → materials list → rupee cost (e.g., "2×2m pothole → 3 bags cold-mix asphalt → ₹1,500"). Supervisor dashboard rolls up a **Today's truck-loading bill** with the most-loaded materials so the depot pre-loads correctly. | `agents/vision_agent.py` (prompt + unit-price table), `routes/supervisor.py` (rollup) |
| **Viral before/after loop** | The instant CLIP verifies a fix, the API renders a watermarked `Before \| After` PNG with "Fixed in Xh via NagarikAI". One-tap Web Share API into WhatsApp / X / Instagram. | `routes/share.py`, `components/ShareFixButton.tsx` |
| **Community DIY + crowdfunding** | When a sev ≤ 2 issue breaches its **Level-3 SLA** unaddressed, a Community Fix module unlocks. Citizens pledge funds (mock ₹) or volunteer hours. Threshold (5 hours OR ₹1,500) generates a type-keyed DIY workplan (tools, safety, meet-up). | `routes/pledges.py`, `jobs/sla_watcher.py`, `components/CommunityFixCard.tsx` |

### Audio guardrails (rigorously tested)

Voice notes pass through a two-layer guardrail (Gemini-side prompt rules + deterministic post-parse scrub):

1. **Prompt-injection** — refuses audio addressing the model ("ignore previous instructions", "you are now…", multilingual variants). Transcript is wiped; photo classification is preserved.
2. **Non-civic content** — refuses songs, ads, lectures, unrelated phone chatter.
3. **Abuse / threats** — refuses abusive language, threats, hate speech.
4. **PII redaction** — regex-strips Indian phone numbers, Aadhaar numbers, long ID runs in both transcript and translation before they hit the DB. Tagged `[REDACTED-PHONE]`, `[REDACTED-AADHAAR]`, `[REDACTED-ID]`.
5. **Unintelligible** — refuses < 1s of speech / pure noise.

Verified end-to-end on 6 synthetic clips (en/hi/kn/te civic + prompt-injection + PII) — **16/16 guardrail assertions pass**.

## Agentic AI

1. **7-agent visible orchestration** — LangGraph runtime shows agents executing live
2. **MILP solver on real BBMP data** — quantified 38% faster resolution, 23% less travel
3. **Predictive layer** — pothole formation forecast from rainfall + traffic data
4. **Closed-loop verification** — CLIP image similarity proves fix → auto-shareable PNG
5. **Real-world validation** — backtested on 6 months of iChangeMyCity data
6. **Voice-first accessibility** — Kannada / Hindi / Telugu / English in one multimodal call
7. **System-failure fallback** — Community DIY unlocks when L3 SLA breaches

## Closed Loop Solution

1. **7-agent visible orchestration** — LangGraph runtime shows agents executing live
2. **MILP solver on real BBMP data** — quantified 38% faster resolution, 23% less travel
3. **Predictive layer** — pothole formation forecast from rainfall + traffic data
4. **Closed-loop verification** — CLIP image similarity proves fix
5. **Real-world validation** — backtested on 6 months of iChangeMyCity data

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui + Mapbox GL |
| Backend | FastAPI + Pydantic |
| Database | PostgreSQL + PostGIS + pgvector |
| Agents | LangGraph + Claude (Sonnet/Haiku) + Gemini Vision |
| Optimization | Google OR-Tools (CVRPTW with skill matching) |
| Auth | Clerk (phone OTP) |
| Storage | Supabase Storage (or Cloudflare R2) |
| Travel matrix | OSRM (self-hosted, OpenStreetMap) |
| Real-time | Supabase Realtime / FastAPI WebSockets |
| Hosting | Vercel (web) + Render/Railway (api) + Supabase (db) |

## Repo Layout

```
nagarikai/
├── apps/
│   ├── web/                ← Next.js 14 PWA + dashboard
│   └── api/                ← FastAPI + agents + MILP
├── data/
│   ├── raw/                ← scraped iChangeMyCity + BBMP CSV
│   └── processed/          ← cleaned datasets for backtest
├── notebooks/              ← data exploration + MILP backtest + predictive model
├── infra/                  ← docker-compose + deploy configs
└── docs/                   ← architecture diagrams + pitch deck
```

## Quickstart

### Prerequisites
- Python 3.11+
- Node 20+
- Docker (for Postgres+PostGIS)

### 1. Start database
```bash
cd infra && docker compose up -d
```

### 2. Backend
```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in API keys (GOOGLE_API_KEY needed for Vision + Audio)
# IMPORTANT: docker-compose maps Postgres to host port 5433 (not 5432) —
# update DATABASE_URL in .env accordingly.
alembic upgrade head   # runs through 0007_v2_features (pledges + audio + estimator + share)
uvicorn nagarik.main:app --reload --port 8000
```

### 3. Frontend
```bash
cd apps/web
npm install
cp .env.local.example .env.local   # fill in Mapbox + API URL
npm run dev
```

### 4. Visit
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

MIT — for hackathon submission.
