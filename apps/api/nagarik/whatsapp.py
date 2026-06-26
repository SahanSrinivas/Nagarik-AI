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

# Tracker for the /admin/whatsapp page — one row per unique recipient number,
# updated every time we attempt a send. Meta doesn't expose a list-test-
# recipients endpoint, so this is our local source of truth for 'is this
# number actually registered in the Meta sandbox?'.
_TRACKER_PATH = Path(__file__).resolve().parents[3] / "data" / "whatsapp_recipients.json"
META_SANDBOX_SLOTS = 5  # Meta caps unverified WhatsApp apps at 5 test recipients


def _load_tracker() -> dict[str, dict[str, Any]]:
    if not _TRACKER_PATH.exists():
        return {}
    try:
        return json.loads(_TRACKER_PATH.read_text())
    except json.JSONDecodeError:
        return {}


def _save_tracker(t: dict[str, dict[str, Any]]) -> None:
    _TRACKER_PATH.parent.mkdir(parents=True, exist_ok=True)
    _TRACKER_PATH.write_text(json.dumps(t, indent=2, sort_keys=True))


def _track_send(phone: str, status: str, code: int | None = None) -> None:
    """Update the local recipients tracker after every send attempt.

    Status interpretation:
      sent                → meta accepted. Mark as 'registered'.
      send_failed + 131030 → recipient not in test list. Mark as 'unregistered'.
      send_failed + other  → leave previous status; bump last_error.
      simulated           → no provider configured; mark as 'unknown'.
    """
    if not phone:
        return
    t = _load_tracker()
    now = datetime.now(timezone.utc).isoformat()
    row = t.get(phone) or {"phone": phone, "first_seen": now, "send_count": 0}
    row["last_attempt"] = now
    row["send_count"] = int(row.get("send_count", 0)) + 1
    if status == "sent":
        row["meta_status"] = "registered"
        row.pop("last_error", None)
    elif status == "send_failed" and code == 131030:
        row["meta_status"] = "unregistered"
        row["last_error"] = "Recipient not in Meta test list"
    elif status == "simulated":
        row.setdefault("meta_status", "unknown")
    elif status == "send_failed":
        row.setdefault("meta_status", "error")
        row["last_error"] = f"Meta error {code or '?'}"
    t[phone] = row
    _save_tracker(t)


def recipients_summary() -> dict[str, Any]:
    """For /admin/whatsapp and /report — current state of the sandbox roster."""
    t = _load_tracker()
    rows = sorted(t.values(), key=lambda r: r.get("first_seen", ""), reverse=True)
    registered = [r for r in rows if r.get("meta_status") == "registered"]
    unregistered = [r for r in rows if r.get("meta_status") == "unregistered"]
    return {
        "slots_total":    META_SANDBOX_SLOTS,
        "slots_used":     len(registered),
        "slots_free":     max(0, META_SANDBOX_SLOTS - len(registered)),
        "pending_adds":   len(unregistered),
        "all_recipients": rows[:50],
        "meta_dashboard_url": (
            "https://developers.facebook.com/apps/"
            f"{os.environ.get('META_APP_ID', '')}/whatsapp-business/wa-dev-console/"
            if os.environ.get("META_APP_ID")
            else "https://developers.facebook.com/apps/"
        ),
    }


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


def _meta_post(payload: dict[str, Any], access_token: str, phone_number_id: str) -> dict[str, Any]:
    """Single Graph API POST + uniform error packaging."""
    try:
        with httpx.Client(timeout=15) as http:
            r = http.post(
                f"https://graph.facebook.com/v18.0/{phone_number_id}/messages",
                headers={"Authorization": f"Bearer {access_token}",
                         "Content-Type": "application/json"},
                json=payload,
            )
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            if r.status_code >= 400:
                err_obj = (body.get("error") or {}) if isinstance(body, dict) else {}
                err_msg = err_obj.get("message") or r.text[:120]
                err_code = err_obj.get("code")
                # Common case: recipient not in test list → code 131030
                hint = ""
                if err_code == 131030:
                    hint = " (recipient not in your test recipients list — add it at developers.facebook.com → your app → WhatsApp → API Setup → To)"
                elif err_code == 131047:
                    hint = " (24h customer window closed — use a template message)"
                return {"status": "send_failed", "provider": "meta",
                        "http": r.status_code, "code": err_code,
                        "error": (str(err_msg) + hint)[:300]}
        msg_id = None
        if isinstance(body, dict):
            msgs = body.get("messages") or []
            if msgs and isinstance(msgs[0], dict):
                msg_id = msgs[0].get("id")
        return {"status": "sent", "provider": "meta", "remote_id": msg_id}
    except httpx.HTTPError as exc:
        return {"status": "send_failed", "provider": "meta", "error": str(exc)[:120]}


def _send_meta(to: str, body: str, access_token: str, phone_number_id: str) -> dict[str, Any]:
    """Meta WhatsApp Cloud API — text message (24h customer window required).

    Tries free-text first. If Meta replies with code 131047 (window closed) or
    131026 (unable to deliver to unregistered recipient), automatically falls
    back to the auto-approved ``hello_world`` template so the demo still lands
    something on the recipient's phone.
    """
    digits = "".join(ch for ch in to if ch.isdigit())
    payload = {"messaging_product": "whatsapp", "to": digits,
               "type": "text", "text": {"body": body[:4096]}}
    res = _meta_post(payload, access_token, phone_number_id)
    if res.get("status") == "send_failed" and res.get("code") in (131047, 131026, 131051):
        # Fall back to the auto-approved hello_world template.
        tmpl_res = _send_meta_template(to, "hello_world", access_token, phone_number_id)
        if tmpl_res.get("status") == "sent":
            tmpl_res["fallback_from"] = "text"
            tmpl_res["original_error"] = res.get("error")
            return tmpl_res
    return res


def _send_meta_template(to: str, template_name: str, access_token: str,
                        phone_number_id: str, language: str = "en_US") -> dict[str, Any]:
    """Send a Meta WhatsApp template message. Use 'hello_world' for sandbox
    verification — Meta auto-approves it and it doesn't need any params."""
    digits = "".join(ch for ch in to if ch.isdigit())
    payload = {
        "messaging_product": "whatsapp",
        "to": digits,
        "type": "template",
        "template": {"name": template_name, "language": {"code": language}},
    }
    return _meta_post(payload, access_token, phone_number_id)


def send_meta_template(to: str, template_name: str = "hello_world",
                       language: str = "en_US") -> dict[str, Any]:
    """Public helper — fire a template message directly, no Issue lookup.

    Used by scripts/whatsapp_test_send.py to verify credentials before
    wiring real issue flows. Reads creds from env.
    """
    api_key  = os.environ.get("WHATSAPP_API_KEY") or ""
    meta_pid = os.environ.get("WHATSAPP_PHONE_NUMBER_ID") or ""
    if not api_key or not meta_pid:
        return {"status": "skipped", "reason": "missing WHATSAPP_API_KEY or WHATSAPP_PHONE_NUMBER_ID"}
    result = _send_meta_template(to, template_name, api_key, meta_pid, language)
    _append_log({"kind": "_probe_template", "ticket_id": None, "to": to,
                 "template": template_name, **result})
    return result


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
    _track_send(to, result.get("status", "unknown"), result.get("code"))
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
