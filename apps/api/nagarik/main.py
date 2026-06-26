"""FastAPI app entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from nagarik.routes import chain, coverage, crew, insights, issues, ops, schedule, stream, tracking, uploads, verify
from nagarik.settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Place for warmup (e.g. preload LightGBM model, prime OR-Tools).
    yield


app = FastAPI(title="NagarikAI", version="0.1.0", lifespan=lifespan)

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
app.include_router(coverage.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "env": _settings.env}
