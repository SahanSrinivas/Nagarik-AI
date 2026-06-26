"""Outbound delivery — pushes a triaged ticket to the destination department.

This is the *spoke* in NagarikAI's hub-and-spoke model. The hub (us) does
classification + dedup + routing + scheduling. The spoke is whatever channel
the receiving department actually watches: a WhatsApp Business number, an
inbox, a webhook into their existing complaint system, or just our own
in-app supervisor queue (for departments without their own software).

For the demo all outbound paths are simulated unless the corresponding env
vars are set — every dispatch writes a line to ``data/delivery_log.jsonl``
which the supervisor dashboard surfaces with a "[simulated]" pill.

The signature is intentionally fire-and-forget: failures are logged and
swallowed so the agent loop is never blocked by a flaky external dependency.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from nagarik.db import SessionLocal
from nagarik.models import Department, Issue

log = logging.getLogger(__name__)

# Where simulated sends go so /supervisor can replay the timeline.
# apps/api/nagarik/delivery.py → repo root is parents[3]
_LOG_PATH = Path(__file__).resolve().parents[3] / "data" / "delivery_log.jsonl"


def _append_log(record: dict[str, Any]) -> None:
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    record.setdefault("logged_at", datetime.now(timezone.utc).isoformat())
    with _LOG_PATH.open("a") as fp:
        fp.write(json.dumps(record) + "\n")


def _build_message(issue: Issue, dept: Department) -> dict[str, Any]:
    """Compact, machine-readable payload the dept's system can ingest."""
    return {
        "ticket_id": str(issue.id),
        "type": getattr(issue.type, "value", str(issue.type)),
        "severity": issue.severity,
        "ward": issue.ward,
        "address": issue.address,
        "description": (issue.description or "")[:300],
        "before_photo_url": issue.before_photo_url,
        "before_video_url": getattr(issue, "before_video_url", None),
        "sla_deadline": issue.sla_deadline.isoformat() if issue.sla_deadline else None,
        "routed_department": issue.routed_department,
        "supervisor_dashboard_url": f"http://localhost:3000/supervisor?focus={issue.id}",
    }


def _dispatch_whatsapp(msg: dict[str, Any], dept: Department) -> dict[str, Any]:
    """Real path uses AiSensy/Gupshup if WHATSAPP_API_KEY is set; else simulate."""
    api_key = os.environ.get("WHATSAPP_API_KEY")
    if not api_key:
        return {"status": "simulated", "channel": "whatsapp",
                "to": dept.whatsapp_number, "preview": _whatsapp_preview(msg)}
    try:
        with httpx.Client(timeout=15) as http:
            r = http.post(
                "https://api.aisensy.com/campaign/t1/api/v2",
                json={"apiKey": api_key, "to": dept.whatsapp_number,
                      "templateParams": [msg["type"], msg["ticket_id"][:8], msg["ward"] or "—"]},
            )
            r.raise_for_status()
        return {"status": "sent", "channel": "whatsapp", "to": dept.whatsapp_number,
                "provider": "aisensy", "remote_id": r.json().get("messageId")}
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        log.warning("whatsapp dispatch failed (%s) — falling back to simulated", exc)
        return {"status": "simulated_after_error", "channel": "whatsapp",
                "to": dept.whatsapp_number, "error": str(exc)[:120],
                "preview": _whatsapp_preview(msg)}


def _whatsapp_preview(msg: dict[str, Any]) -> str:
    return (f"🚨 New {msg['type']} report (sev {msg['severity']}/5) in {msg['ward'] or 'BBMP area'}. "
            f"SLA: {msg['sla_deadline'][:16] if msg['sla_deadline'] else 'TBD'}. "
            f"Ticket {msg['ticket_id'][:8]}. View: {msg['supervisor_dashboard_url']}")


def _dispatch_email(msg: dict[str, Any], dept: Department) -> dict[str, Any]:
    """SMTP send when SMTP_HOST is set; else simulate."""
    host = os.environ.get("SMTP_HOST")
    if not host:
        return {"status": "simulated", "channel": "email", "to": dept.email,
                "subject": f"[NagarikAI] {msg['type']} in {msg['ward'] or 'BBMP'} — ticket {msg['ticket_id'][:8]}"}
    try:
        import smtplib
        from email.message import EmailMessage
        em = EmailMessage()
        em["Subject"] = f"[NagarikAI] {msg['type']} ticket {msg['ticket_id'][:8]} ({msg['ward'] or 'BBMP'})"
        em["From"] = os.environ.get("SMTP_FROM", "noreply@nagarikai.in")
        em["To"] = dept.email
        em.set_content(json.dumps(msg, indent=2))
        with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587"))) as smtp:
            user = os.environ.get("SMTP_USER")
            if user:
                smtp.starttls()
                smtp.login(user, os.environ.get("SMTP_PASSWORD", ""))
            smtp.send_message(em)
        return {"status": "sent", "channel": "email", "to": dept.email}
    except Exception as exc:  # noqa: BLE001
        log.warning("email dispatch failed (%s) — simulated", exc)
        return {"status": "simulated_after_error", "channel": "email",
                "to": dept.email, "error": str(exc)[:120]}


def _dispatch_webhook(msg: dict[str, Any], dept: Department) -> dict[str, Any]:
    if not dept.webhook_url:
        return {"status": "skipped_no_url", "channel": "webhook"}
    try:
        with httpx.Client(timeout=15) as http:
            r = http.post(dept.webhook_url, json=msg,
                          headers={"X-NagarikAI-Source": "delivery.py"})
        return {"status": "sent", "channel": "webhook", "to": dept.webhook_url,
                "remote_status": r.status_code}
    except httpx.HTTPError as exc:
        return {"status": "simulated_after_error", "channel": "webhook",
                "to": dept.webhook_url, "error": str(exc)[:120]}


_CHANNEL_HANDLERS = {
    "whatsapp": _dispatch_whatsapp,
    "email":    _dispatch_email,
    "webhook":  _dispatch_webhook,
}


def dispatch_to_department(issue_id: str, *, escalation: bool = False) -> dict[str, Any] | None:
    """Resolve the issue's destination dept and push via its primary_channel.

    Returns the delivery record (the same dict that gets logged), or None if
    no department row matched. Persists ``delivered_at`` + ``delivered_channel``
    on the Issue so the supervisor dashboard can show "Sent via WhatsApp · 3m ago".

    When ``escalation=True`` the record is tagged so /supervisor can render it
    as an escalation event (the underlying channel is the same).
    """
    with SessionLocal() as db:
        issue = db.get(Issue, issue_id)
        if issue is None or not issue.routed_department:
            return None
        dept = db.scalar(select(Department).where(Department.name == issue.routed_department))
        if dept is None:
            # Common during demos: historical issues seeded from the older BBMP
            # data use department names that don't match SOP_TABLE. Debug-level
            # log only; no log spam.
            log.debug("delivery: no Department row for %r", issue.routed_department)
            return None

        msg = _build_message(issue, dept)
        handler = _CHANNEL_HANDLERS.get(dept.primary_channel)
        if handler is None:
            # inapp_only — the dept watches /supervisor instead. We still mark
            # delivery so the dashboard reflects "in NagarikAI hub" timing.
            result = {"status": "inapp_only", "channel": "inapp_only",
                      "dept": dept.name, "supervisor_dashboard": True}
        else:
            result = handler(msg, dept)

        # Persist delivery markers on the issue (first delivery only, not on escalation).
        if not escalation:
            issue.delivered_at = datetime.now(timezone.utc)
            issue.delivered_channel = result.get("channel", dept.primary_channel)
            db.add(issue)
            db.commit()

        record = {
            "ticket_id": str(issue.id),
            "dept": dept.name,
            "dept_code": dept.code,
            "channel": result.get("channel"),
            "status": result.get("status"),
            "escalation": escalation,
            **{k: v for k, v in result.items() if k not in {"channel", "status"}},
        }
        _append_log(record)
        return record


def recent_log_entries(limit: int = 50) -> list[dict[str, Any]]:
    """Tail of data/delivery_log.jsonl — for the supervisor dashboard."""
    if not _LOG_PATH.exists():
        return []
    lines = _LOG_PATH.read_text().splitlines()
    out = []
    for line in lines[-limit:]:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return list(reversed(out))
