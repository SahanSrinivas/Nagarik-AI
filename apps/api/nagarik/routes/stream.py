"""Server-Sent Events stream for live agent timeline.

Replaces frontend polling on /agents. Long-lived HTTP response that pushes
each new AgentEvent as it lands. Falls back gracefully — clients can still
poll /issues/{id}/events if SSE is blocked by a proxy.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from nagarik.db import SessionLocal, get_db
from nagarik.models import AgentEvent, Issue

router = APIRouter(prefix="/issues", tags=["stream"])

POLL_INTERVAL_S = 1.0
HEARTBEAT_EVERY = 15  # send a comment every 15s so proxies don't drop the connection


def _serialise(ev: AgentEvent) -> str:
    payload = {
        "id": str(ev.id),
        "agent": ev.agent,
        "status": ev.status,
        "payload": ev.payload,
        "duration_ms": ev.duration_ms,
        "created_at": ev.created_at.isoformat(),
    }
    return f"data: {json.dumps(payload)}\n\n"


@router.get("/{issue_id}/events/stream")
async def stream_events(issue_id: uuid.UUID) -> StreamingResponse:
    async def gen():
        last_id: str | None = None
        last_heartbeat = datetime.now(timezone.utc)

        # Send any prior events first so the UI hydrates without an initial poll.
        with SessionLocal() as db:
            rows = db.scalars(
                select(AgentEvent)
                .where(AgentEvent.issue_id == issue_id)
                .order_by(AgentEvent.created_at.asc())
            ).all()
            for ev in rows:
                yield _serialise(ev)
                last_id = str(ev.id)

        # Then live-tail.
        while True:
            await asyncio.sleep(POLL_INTERVAL_S)
            with SessionLocal() as db:
                q = (
                    select(AgentEvent)
                    .where(AgentEvent.issue_id == issue_id)
                    .order_by(AgentEvent.created_at.asc())
                )
                if last_id is not None:
                    pivot = db.get(AgentEvent, last_id)
                    if pivot is not None:
                        q = q.where(AgentEvent.created_at > pivot.created_at)
                rows = db.scalars(q).all()
                for ev in rows:
                    yield _serialise(ev)
                    last_id = str(ev.id)

            # Heartbeat — proxies (Cloud Run, Nginx) often kill idle connections at 60s.
            now = datetime.now(timezone.utc)
            if (now - last_heartbeat).total_seconds() > HEARTBEAT_EVERY:
                last_heartbeat = now
                yield ": heartbeat\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
