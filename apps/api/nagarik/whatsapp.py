"""Citizen WhatsApp updates — first this happened, next that happened.

Every notification the system emits to a citizen (classified, triaged,
verified, scheduled, in_progress, resolved, escalated_*) also fires a
WhatsApp template to whatever number they opted into on /report.

Three send paths supported:

    WHATSAPP_PROVIDER = meta      → Meta WhatsApp Cloud API (free, official)
                                    Needs:  WHATSAPP_API_KEY            (Bearer access token from your Meta App)
                                            WHATSAPP_PHONE_NUMBER_ID    (from WhatsApp Business setup)
                                    Caveat: sandbox mode only sends to test recipients
                                            listed in the Meta App dashboard; production
                                            needs a pre-approved template.

    WHATSAPP_PROVIDER = aisensy   → AiSensy Business API wrapper
                                    Needs:  WHATSAPP_API_KEY

    WHATSAPP_PROVIDER = gupshup   → Gupshup Business API
                                    Needs:  WHATSAPP_API_KEY
                                            WHATSAPP_BUSINESS_NUMBER

If no provider is configured we simulate: every send is appended to
``data/whatsapp_log.jsonl`` and the citizen tracking page surfaces a
'sent to WhatsApp' marker so the demo still feels closed-loop.

Failures NEVER raise out of this module — agents/notifications must stay
resilient.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from nagarik.db import SessionLocal
from nagarik.models import Issue

log = logging.getLogger(__name__)

# Tail consumed by /tracking and /agents to show 'forwarded to WhatsApp at HH:MM'.
_LOG_PATH = Path(__file__).resolve().parents[3] / "data" / "whatsapp_log.jsonl"


# Human-friendly templates per notification kind. The {dept}/{type}/{sla}/...
# placeholders match the Notification.payload context dict from notifications.py
# so we can format both messages from the same data.
TEMPLATES: dict[str, str] = {
    "classified":       "🤖 *Step 1.* NagarikAI received your report (#{short_id}).\nClassified as *{type}* · severity *{severity}/5*.",
    "triaged":          "📤 *Step 2.* Forwarded to *{dept}* via their WhatsApp channel.\nSLA: by *{sla}*.",
    "deduped":          "🔁 We merged your report with an existing one nearby — you'll get its updates too.",
    "verified":         "👥 *Step 3.* {count} nearby citizens confirmed the issue. Dispatcher is picking it up.",
    "scheduled":        "🛠 *Step 4.* Crew *{crew}* assigned for *{when}*. Route optimised via our MILP solver.",
    "in_progress":      "🚧 *Step 5.* The crew is on-site now.",
    "resolved":         "✅ *Step 6.* {dept} reported the fix. After-photo cleared CLIP+CNN audit. +{xp} XP earned — you're at *{new_xp} XP*.",
    "rejected":         "⚠️ We had to reject this report — usually a duplicate or out of scope.",
    "acked_by_dept":    "👋 A supervisor at *{dept}* just acknowledged your ticket. SLA clock still running.",
    "escalated_lvl1":   "🚨 *SLA breach.* {dept} didn't act in time — we re-pinged the dept supervisor directly.",
    "escalated_lvl2":   "📣 24h with no movement. Looped in the ward councillor.",
    "escalated_lvl3":   "📜 72h silent — we've drafted an RTI you can file from your dashboard in one tap.",
}


def _append_log(record: dict[str, Any]) -> None:
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    record.setdefault("logged_at", datetime.now(timezone.utc).isoformat())
    with _LOG_PATH.open("a") as fp:
        fp.write(json.dumps(record) + "\n")


def _format(kind: str, ctx: dict[str, Any], issue: Issue) -> str:
    tpl = TEMPLATES.get(kind, "Update on ticket #{short_id}.")
    full_ctx = {
        **ctx,
        "short_id": str(issue.id)[:8],
        "type": ctx.get("type") or getattr(issue.type, "value", str(issue.type)),
        "severity": ctx.get("severity") or issue.severity,
        "dept": ctx.get("dept") or (issue.routed_department or "the department"),
    }
    # Safe formatting — missing keys render literally rather than crashing.
    class _Missing(dict):
        def __missing__(self, key: str) -> str:
            return "—"
    return tpl.format_map(_Missing(full_ctx))


def _send_meta(to: str, body: str, access_token: str, phone_number_id: str) -> dict[str, Any]:
    """Meta WhatsApp Cloud API — official, no third-party reseller needed.

    Endpoint: POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
    Auth:     Authorization: Bearer <access_token>

    Sandbox/dev caveat: until you complete business verification, Meta only
    delivers to recipients you've explicitly added in the App dashboard's
    'WhatsApp test recipients' list. Add your number there before testing.

    For an unrequested message (citizen never DM'd you first), production
    requires a pre-approved template. For demo the simulated path is fine.
    """
    digits = "".join(ch for ch in to if ch.isdigit())
    try:
        with httpx.Client(timeout=15) as http:
            r = http.post(
                f"https://graph.facebook.com/v18.0/{phone_number_id}/messages",
                headers={"Authorization": f"Bearer {access_token}",
                         "Content-Type": "application/json"},
                json={"messaging_product": "whatsapp",
                      "to": digits,
                      "type": "text",
                      "text": {"body": body[:4096]}},
            )
            payload = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            if r.status_code >= 400:
                err = (payload.get("error") or {}).get("message") if isinstance(payload, dict) else r.text[:120]
                return {"status": "send_failed", "provider": "meta",
                        "http": r.status_code, "error": str(err)[:200]}
        msg_id = None
        if isinstance(payload, dict):
            msgs = payload.get("messages") or []
            if msgs and isinstance(msgs[0], dict):
                msg_id = msgs[0].get("id")
        return {"status": "sent", "provider": "meta", "remote_id": msg_id}
    except httpx.HTTPError as exc:
        return {"status": "send_failed", "provider": "meta", "error": str(exc)[:120]}


def _send_aisensy(to: str, body: str, api_key: str) -> dict[str, Any]:
    try:
        with httpx.Client(timeout=15) as http:
            r = http.post(
                "https://api.aisensy.com/campaign/t1/api/v2",
                json={"apiKey": api_key, "to": to, "templateParams": [body[:1000]]},
            )
            r.raise_for_status()
        body_json = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        return {"status": "sent", "provider": "aisensy",
                "remote_id": body_json.get("messageId") if isinstance(body_json, dict) else None}
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        return {"status": "send_failed", "provider": "aisensy", "error": str(exc)[:120]}


def _send_gupshup(to: str, body: str, api_key: str, from_num: str) -> dict[str, Any]:
    try:
        with httpx.Client(timeout=15) as http:
            r = http.post(
                "https://api.gupshup.io/wa/api/v1/msg",
                headers={"apikey": api_key, "Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "channel": "whatsapp",
                    "source": from_num,
                    "destination": to,
                    "src.name": "NagarikAI",
                    "message": json.dumps({"type": "text", "text": body[:4096]}),
                },
            )
            r.raise_for_status()
        return {"status": "sent", "provider": "gupshup"}
    except httpx.HTTPError as exc:
        return {"status": "send_failed", "provider": "gupshup", "error": str(exc)[:120]}


def send_citizen_update(
    issue_id: str,
    kind: str,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Dispatch a WhatsApp message for this notification kind. Returns the
    log record (also persisted to data/whatsapp_log.jsonl) or None if the
    issue has no opt-in number / template missing."""
    if kind not in TEMPLATES:
        return None

    with SessionLocal() as db:
        try:
            issue = db.get(Issue, uuid.UUID(issue_id))
        except (ValueError, TypeError):
            return None
        if issue is None or not getattr(issue, "whatsapp_number", None):
            return None

        body = _format(kind, extras or {}, issue)
        to = issue.whatsapp_number

    provider = (os.environ.get("WHATSAPP_PROVIDER") or "").lower()
    api_key  = os.environ.get("WHATSAPP_API_KEY") or ""
    from_num = os.environ.get("WHATSAPP_BUSINESS_NUMBER") or ""
    meta_pid = os.environ.get("WHATSAPP_PHONE_NUMBER_ID") or ""

    if provider == "meta" and api_key and meta_pid:
        result = _send_meta(to, body, api_key, meta_pid)
    elif provider == "aisensy" and api_key:
        result = _send_aisensy(to, body, api_key)
    elif provider == "gupshup" and api_key and from_num:
        result = _send_gupshup(to, body, api_key, from_num)
    else:
        result = {"status": "simulated", "provider": provider or "none",
                  "reason": "no provider configured" if not provider else "missing creds"}

    record = {
        "ticket_id": str(issue_id),
        "kind": kind,
        "to": to,
        "body": body,
        **result,
    }
    _append_log(record)
    return record


def recent_log_for_issue(issue_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Tail of WhatsApp sends for ONE issue — used by /tracking to render
    'sent to WhatsApp at HH:MM' markers next to the timeline."""
    if not _LOG_PATH.exists():
        return []
    out: list[dict[str, Any]] = []
    for line in _LOG_PATH.read_text().splitlines()[-500:]:
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if r.get("ticket_id") == issue_id:
            out.append(r)
    return out[-limit:]
