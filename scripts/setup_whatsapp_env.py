"""Append/update WHATSAPP_* keys in apps/api/.env without clobbering existing
keys (GOOGLE_API_KEY, JWT_SECRET, SUPABASE_*, etc).

Reads ENV from arguments, merges into the existing .env file atomically,
writes back. Idempotent — re-running with new values updates in place.

Usage:
    python scripts/setup_whatsapp_env.py \\
        WHATSAPP_PROVIDER=meta \\
        WHATSAPP_API_KEY=EAAxxxxxxxxxxxxxxx \\
        WHATSAPP_PHONE_NUMBER_ID=123456789 \\
        WHATSAPP_BUSINESS_NUMBER=+15551234567
"""

from __future__ import annotations

import sys
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[1] / "apps" / "api" / ".env"


def main(argv: list[str]) -> int:
    if not argv:
        print("usage: setup_whatsapp_env.py KEY=value [KEY=value …]")
        return 1

    updates: dict[str, str] = {}
    for arg in argv:
        if "=" not in arg:
            print(f"skip (no =): {arg!r}")
            continue
        k, v = arg.split("=", 1)
        updates[k.strip()] = v.strip()

    # Load existing .env into an ordered list of (key, value) tuples so we
    # preserve line order + comments.
    lines: list[str] = []
    seen_keys: set[str] = set()
    if ENV_FILE.exists():
        with ENV_FILE.open() as f:
            for raw in f:
                stripped = raw.strip()
                if not stripped or stripped.startswith("#") or "=" not in stripped:
                    lines.append(raw.rstrip("\n"))
                    continue
                k = stripped.split("=", 1)[0].strip()
                if k in updates:
                    new_v = updates.pop(k)
                    lines.append(f"{k}={new_v}")
                    seen_keys.add(k)
                else:
                    lines.append(raw.rstrip("\n"))
                    seen_keys.add(k)

    # Append the remaining (truly new) keys at the end with a header.
    if updates:
        if lines and lines[-1].strip():
            lines.append("")
        lines.append("# ─── WhatsApp (added by scripts/setup_whatsapp_env.py) ────────")
        for k, v in updates.items():
            lines.append(f"{k}={v}")

    ENV_FILE.write_text("\n".join(lines) + "\n")
    print(f"✓ updated {ENV_FILE}")
    # Print masked summary
    for k in {"WHATSAPP_PROVIDER", "WHATSAPP_API_KEY", "WHATSAPP_PHONE_NUMBER_ID",
              "WHATSAPP_BUSINESS_NUMBER", "WHATSAPP_BUSINESS_ACCOUNT_ID"}:
        for line in lines:
            if line.startswith(f"{k}="):
                v = line.split("=", 1)[1]
                if "API_KEY" in k or "ACCESS_TOKEN" in k:
                    v = v[:6] + "…" + v[-4:] if len(v) > 12 else "***"
                print(f"  {k}={v}")
                break
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
