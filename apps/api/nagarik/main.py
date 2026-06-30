"""FastAPI app entrypoint."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from nagarik import auth as auth_mod
from nagarik.db import SessionLocal
from nagarik.jobs.sla_watcher import start_sla_watcher
from nagarik.ratelimit import limiter
from nagarik.routes import (
    chain, coverage, crew, insights, issues, ops, pledges, schedule, share,
    stream, supervisor, tracking, uploads, verify, whatsapp_admin,
)
from nagarik.settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed the demo user so /auth/login works on first boot.
    try:
        with SessionLocal() as db:
            auth_mod.ensure_demo_user_exists(db)
    except Exception as exc:  # noqa: BLE001 — never block startup on seed
        logging.getLogger(__name__).warning("demo user seed failed: %s", exc)
    # Kick off the SLA escalation watcher (runs every 60s).
    start_sla_watcher()
    yield


app = FastAPI(title="NagarikAI", version="0.1.0", lifespan=lifespan)

# Rate limiting — installed before any route mounting.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(issues.router)
app.include_router(verify.router)
app.include_router(schedule.router)
app.include_router(insights.router)
app.include_router(uploads.router)
app.include_router(tracking.router)
app.include_router(stream.router)
app.include_router(chain.router)
app.include_router(ops.router)
app.include_router(crew.router)
app.include_router(supervisor.router)
app.include_router(coverage.router)
app.include_router(auth_mod.router)
app.include_router(whatsapp_admin.router)
app.include_router(pledges.router)
app.include_router(share.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "env": _settings.env}
