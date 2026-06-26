"""Probe the Meta WhatsApp Cloud API integration.

Usage:
    PYTHONPATH=. python -m scripts.whatsapp_test_send +911234567890

Sends the auto-approved 'hello_world' template. Recipient MUST be in your
Meta App's 'WhatsApp test recipients' list (developers.facebook.com → your
app → WhatsApp → API Setup → To). Without that, Meta returns error code
131030 and the message is rejected before delivery.
"""

from __future__ import annotations

import json
import os
import sys


def main(argv: list[str]) -> int:
    if not argv:
        print("Pass the recipient phone number as the first arg, e.g.:")
        print("  python -m scripts.whatsapp_test_send +911234567890")
        return 1
    to = argv[0]

    # Surface what creds are in scope so misconfiguration is obvious.
    api_key  = os.environ.get("WHATSAPP_API_KEY")  or ""
    phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID") or ""
    provider = os.environ.get("WHATSAPP_PROVIDER") or ""
    print(f"provider:          {provider!r}")
    print(f"phone_number_id:   {phone_id!r}")
    print(f"api_key:           {(api_key[:6] + '...' + api_key[-4:]) if len(api_key) > 12 else '***'}")
    print(f"recipient:         {to!r}")
    print()

    from nagarik.whatsapp import send_meta_template
    res = send_meta_template(to, template_name="hello_world", language="en_US")
    print("Result:")
    print(json.dumps(res, indent=2))

    if res.get("status") == "sent":
        print("\n✓ Meta accepted the message. Check WhatsApp on the recipient phone "
              "within ~5 seconds.")
        return 0
    print("\n✗ Meta did not accept the message. See error above.")
    if res.get("code") == 131030:
        print("  Likely fix: open developers.facebook.com → your app → WhatsApp")
        print("              → API Setup → 'To' → Manage phone number list →")
        print(f"             Add Phone Number → enter {to}.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
