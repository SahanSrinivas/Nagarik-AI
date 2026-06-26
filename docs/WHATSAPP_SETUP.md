# WhatsApp citizen updates — setup

Append the lines below to **`apps/api/.env`** (and `.env.example` for the
repo). The codebase auto-detects the provider; if nothing is set, sends are
simulated and the citizen tracking page still shows the "forwarded to
WhatsApp" markers from `data/whatsapp_log.jsonl`.

---

## Option A — Meta WhatsApp Cloud API  (recommended · free · official)

You said you already have a Meta developer account. Here's the full setup:

1. <https://developers.facebook.com> → **My Apps** → **Create App** → choose
   **Business**.
2. Open the new app → **Add a Product** → **WhatsApp** → Set up.
3. On the WhatsApp panel:
   - Copy the **temporary access token** (24 h validity — fine for the demo).
     For long-running production: generate a **System User** in Business
     Settings and create a permanent token with `whatsapp_business_messaging`
     scope.
   - Copy the **Phone Number ID** (a numeric ID, NOT the actual phone number).
   - Under **To**, click **Manage phone number list** and add the personal
     numbers you want to test with. Sandbox mode only delivers to
     registered test recipients.

```env
# apps/api/.env
WHATSAPP_PROVIDER=meta
WHATSAPP_API_KEY=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # Bearer access token
WHATSAPP_PHONE_NUMBER_ID=123456789012345                     # numeric ID
WHATSAPP_BUSINESS_NUMBER=+15551234567                        # for display only
```

Restart the API:

```bash
cd apps/api && .venv/bin/uvicorn nagarik.main:app --port 8000 --reload
```

### Template message vs free text

- **Inside a 24-hour customer service window** (the citizen DM'd your number
  recently), free-text messages work.
- **Outside that window** (first message from us to them), Meta requires a
  **pre-approved template**. For the hackathon demo this is usually fine in
  sandbox/test mode — our test recipient list bypasses template approval.
  For production you'd register a `civic_ticket_update` template with
  variables for `{type}`, `{severity}`, `{dept}`, `{sla}`.

The code currently sends as `text` for simplicity. Swap to a template by
editing `_send_meta()` in `apps/api/nagarik/whatsapp.py`.

---

## Option B — AiSensy (Indian reseller, easier compliance)

```env
WHATSAPP_PROVIDER=aisensy
WHATSAPP_API_KEY=<aisensy api key>
```

---

## Option C — Gupshup

```env
WHATSAPP_PROVIDER=gupshup
WHATSAPP_API_KEY=<gupshup api key>
WHATSAPP_BUSINESS_NUMBER=+91xxxxxxxxxx
```

---

## Verifying the integration

1. Open `/report`, fill in the WhatsApp number field (the shaky blue card),
   submit a test ticket.
2. Watch `data/whatsapp_log.jsonl` grow with one entry per status step
   (classified → triaged → verified → in_progress → resolved).
3. With Meta configured + your phone in the test recipient list, the
   actual messages arrive on WhatsApp within 1-2 seconds of each step.
4. `/tracking/<id>` shows a small "📱 sent to WhatsApp · HH:MM" stamp on
   every notification that was successfully forwarded.

If a send fails (bad token, recipient not in test list, etc.) the error is
captured in the log row and surfaced silently in the dashboard — the
in-app notification still works.
