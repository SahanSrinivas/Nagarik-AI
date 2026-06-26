"""WhatsApp admin endpoints — counter + recipient roster.

Backs the /admin/whatsapp page and the live 'X of 5 WhatsApp slots' chip
on /report. Meta doesn't expose a programmatic API to add test recipients
(the OTP flow is dashboard-only), so we maintain our own tracker in
data/whatsapp_recipients.json and deeplink the operator into the right
Meta dashboard page.
"""

from __future__ import annotations

import os

from fastapi import APIRouter

from nagarik.whatsapp import recipients_summary

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get("/recipients")
def get_recipients() -> dict:
    """Live counter + roster. Polled by /report (slot chip) and /admin/whatsapp."""
    s = recipients_summary()
    # Surface a few env-derived bits the UI uses to deeplink Meta.
    s["sender_number"] = os.environ.get("WHATSAPP_BUSINESS_NUMBER")
    s["phone_number_id"] = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
    s["business_account_id"] = os.environ.get("WHATSAPP_BUSINESS_ACCOUNT_ID")
    s["provider"] = os.environ.get("WHATSAPP_PROVIDER") or "simulated"
    return s
