"""Citizen-facing tracking — combines issue state + notifications into a
single timeline rendered on /tracking/[id]."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.shape import to_shape
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.i18n_runtime import SUPPORTED as SUPPORTED_LANGS, translate_many
from nagarik.models import Citizen, Crew, Issue
from nagarik.notifications import Notification

router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.get("/{issue_id}")
def tracking(
    issue_id: uuid.UUID,
    lang: str = Query("en", description="Citizen's preferred locale: en | hi | kn"),
    db: Session = Depends(get_db),
) -> dict:
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(404, "issue not found")

    reporter = db.get(Citizen, issue.reporter_id)
    crew = db.get(Crew, issue.assigned_crew_id) if issue.assigned_crew_id else None
    pt = to_shape(issue.location)

    notifs = db.scalars(
        select(Notification)
        .where(Notification.issue_id == issue.id)
        .order_by(Notification.created_at.asc())
    ).all()

    # Batch-translate every notification's title + body in ONE LLM call.
    # The cache means once the templates ('AI saw your photo', 'Crew assigned',
    # …) are seen for a given lang, every subsequent /tracking hit is free.
    safe_lang = lang if lang in SUPPORTED_LANGS else "en"
    if safe_lang != "en" and notifs:
        flat = [s for n in notifs for s in (n.title, n.body)]
        translated = translate_many(flat, safe_lang)
        # Re-pack pairs back into per-notification dicts.
        translations = [
            {"title": translated[2 * i], "body": translated[2 * i + 1]}
            for i in range(len(notifs))
        ]
    else:
        translations = [{"title": n.title, "body": n.body} for n in notifs]

    ai_meta = issue.ai_classification or {}
    loc_meta = ai_meta.get("location_resolver")

    # Vision agent bbox — [x_min, y_min, x_max, y_max] normalised 0-1.
    # Renders as an SVG overlay on the citizen tracking page so they SEE
    # exactly where the AI focused on their photo. Falls through to a
    # sensible default if Gemini returned malformed coords.
    raw_bbox = ai_meta.get("bbox")
    bbox = None
    if isinstance(raw_bbox, list) and len(raw_bbox) == 4:
        try:
            x0, y0, x1, y1 = [max(0.0, min(1.0, float(v))) for v in raw_bbox]
            if x1 > x0 and y1 > y0:
                bbox = [x0, y0, x1, y1]
        except (TypeError, ValueError):
            bbox = None

    # WhatsApp fanout markers for this issue — let the UI render
    # 'forwarded to WhatsApp at HH:MM' next to each timeline event.
    from nagarik.whatsapp import recent_log_for_issue
    wa_log = recent_log_for_issue(str(issue.id), limit=50)
    wa_by_kind: dict[str, dict] = {}
    for entry in wa_log:
        k = entry.get("kind")
        if k:
            wa_by_kind[k] = {
                "logged_at": entry.get("logged_at"),
                "status": entry.get("status"),
                "to": entry.get("to"),
            }

    return {
        "whatsapp_opt_in": bool(getattr(issue, "whatsapp_number", None)),
        "whatsapp_to": getattr(issue, "whatsapp_number", None),
        "whatsapp_by_kind": wa_by_kind,
        "issue": {
            "id": str(issue.id),
            "type": getattr(issue.type, "value", str(issue.type)),
            "severity": issue.severity,
            "status": getattr(issue.status, "value", str(issue.status)),
            "address": issue.address,
            "ward": issue.ward,
            "lat": pt.y,
            "lng": pt.x,
            "description": issue.description,
            "before_photo_url": issue.before_photo_url,
            "after_photo_url": issue.after_photo_url,
            "before_video_url": getattr(issue, "before_video_url", None),
            "after_video_url": getattr(issue, "after_video_url", None),
            "before_audio_url": getattr(issue, "before_audio_url", None),
            # V2 — Voice-first audio surface (post-guardrail scrub)
            "audio_transcript": ai_meta.get("audio_transcript", "") or "",
            "audio_translation_en": ai_meta.get("audio_translation_en", "") or "",
            "audio_context": ai_meta.get("audio_context", "") or "",
            "audio_language": ai_meta.get("audio_language", "") or "",
            "audio_rejected": bool(ai_meta.get("audio_rejected", False)),
            "estimated_materials": list(getattr(issue, "estimated_materials", []) or []),
            "estimated_cost_inr": getattr(issue, "estimated_cost_inr", None),
            "share_image_url": getattr(issue, "share_image_url", None),
            "diy_unlocked_at": (
                issue.diy_unlocked_at.isoformat()
                if getattr(issue, "diy_unlocked_at", None) else None
            ),
            "routed_department": issue.routed_department,
            "sla_deadline": issue.sla_deadline.isoformat() if issue.sla_deadline else None,
            "scheduled_at": issue.scheduled_at.isoformat() if issue.scheduled_at else None,
            "resolved_at": issue.resolved_at.isoformat() if issue.resolved_at else None,
            "created_at": issue.created_at.isoformat(),
            "ai_confidence": float(issue.ai_confidence or 0),
            "ai_bbox": bbox,
            "ai_focus_label": ai_meta.get("focus_label"),
            "ai_notes": ai_meta.get("notes"),
            "location_resolver": loc_meta,
        },
        "reporter": {
            "id": str(reporter.id) if reporter else None,
            "name": reporter.name if reporter else None,
            "xp": reporter.xp if reporter else 0,
        },
        "crew": {
            "id": str(crew.id),
            "name": crew.name,
            "department": crew.department,
        } if crew else None,
        "timeline": [
            {
                "id": str(n.id),
                "kind": n.kind,
                "title": translations[i]["title"],
                "body": translations[i]["body"],
                "title_en": n.title,             # always include source for debug
                "body_en": n.body,
                "channel": n.channel,
                "created_at": n.created_at.isoformat(),
                "read_at": n.read_at.isoformat() if n.read_at else None,
            }
            for i, n in enumerate(notifs)
        ],
        "lang": safe_lang,
    }


@router.post("/{issue_id}/read")
def mark_read(issue_id: uuid.UUID, db: Session = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    db.execute(
        update(Notification)
        .where(Notification.issue_id == issue_id, Notification.read_at.is_(None))
        .values(read_at=now)
    )
    db.commit()
    return {"marked_read_at": now.isoformat()}
