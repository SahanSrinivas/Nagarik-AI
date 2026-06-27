"""Single source of truth for IST (Asia/Kolkata) display formatting.

Database columns stay in UTC — that's the right shape for storage. But
every string a citizen, supervisor, crew lead, judge, or WhatsApp recipient
sees should be in IST. Use ``fmt_ist`` at the display boundary.

Why this module exists: notifications.py used to do
``dt.astimezone(timezone.utc).strftime("%a %d %b, %H:%M IST")`` which
labels UTC as IST — silently 5.5h off. Centralising the conversion
prevents that drift.
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    """Current wall-clock time in IST (Asia/Kolkata, UTC+5:30)."""
    return datetime.now(IST)


def to_ist(dt: datetime) -> datetime:
    """Convert any timezone-aware (or naive-assumed-UTC) datetime to IST."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)


def fmt_ist(dt: datetime, *, fmt: str = "%a %d %b, %H:%M IST") -> str:
    """Render a datetime as an IST display string, default 'Mon 29 Jun, 14:24 IST'."""
    return to_ist(dt).strftime(fmt)
