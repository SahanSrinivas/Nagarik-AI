"""Viral before/after share-image generator.

Once ResolutionAgent verifies a fix (CLIP scene match + defect CNN), it
calls `mark_share_ready(issue_id)` which sets `issues.share_image_url` to
`/issues/{id}/share.png` (this route). When the citizen taps "Share fix"
in the app, the Web Share API hits this URL and the OS file picker sees a
ready-to-share PNG.

PIL composes:

  ┌───────────────┬───────────────┐
  │   BEFORE      │     AFTER     │
  │   (cropped)   │   (cropped)   │
  │               │               │
  ├───────────────┴───────────────┤
  │ Pothole · Fixed in 36h        │
  │ via NagarikAI · BBMP Roads    │
  └───────────────────────────────┘

Falls back to a clean text-only card when the source photos can't be
downloaded — the loop never fails on a missing image, the social-share
button just renders the badge.
"""

from __future__ import annotations

import io
import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import update

from nagarik.db import SessionLocal
from nagarik.models import Issue

log = logging.getLogger(__name__)

router = APIRouter(prefix="/issues", tags=["share"])

CARD_W = 1200
CARD_H = 800
PANEL_H = 600
BRAND = (88, 28, 135)   # deep purple — matches NagarikAI accent in the web UI
BRAND_LIGHT = (236, 233, 254)
INK = (24, 24, 27)
MUTED = (113, 113, 122)


def _fetch(url: str) -> bytes | None:
    try:
        with httpx.Client(follow_redirects=True, timeout=15) as client:
            r = client.get(url, headers={"User-Agent": "NagarikAI-Share/0.1"})
            r.raise_for_status()
            return r.content
    except Exception as exc:  # noqa: BLE001 — share image is best-effort
        log.warning("share: failed to fetch %s: %s", url, exc)
        return None


def _hours_between(a: datetime | None, b: datetime | None) -> int:
    if a is None or b is None:
        return 0
    return max(0, int((b - a).total_seconds() // 3600))


def _load_image(blob: bytes | None, target_w: int, target_h: int):
    """Decode + cover-crop an image to (target_w, target_h)."""
    from PIL import Image, ImageOps
    if not blob:
        return None
    try:
        img = Image.open(io.BytesIO(blob)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        log.warning("share: bad image bytes: %s", exc)
        return None
    return ImageOps.fit(img, (target_w, target_h), method=Image.LANCZOS)


def _font(size: int):
    """Try a few common system fonts; fall back to PIL default."""
    from PIL import ImageFont
    for candidate in (
        "C:/Windows/Fonts/segoeuib.ttf",       # Windows
        "C:/Windows/Fonts/seguisb.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc",  # macOS
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
        "DejaVuSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(candidate, size)
        except Exception:  # noqa: BLE001
            continue
    return ImageFont.load_default()


def _render_card(
    before_blob: bytes | None,
    after_blob: bytes | None,
    issue_type: str,
    dept: str | None,
    hours: int,
) -> bytes:
    from PIL import Image, ImageDraw

    canvas = Image.new("RGB", (CARD_W, CARD_H), BRAND_LIGHT)
    half = CARD_W // 2

    before = _load_image(before_blob, half, PANEL_H)
    after = _load_image(after_blob, half, PANEL_H)
    if before is not None:
        canvas.paste(before, (0, 0))
    if after is not None:
        canvas.paste(after, (half, 0))

    draw = ImageDraw.Draw(canvas)
    # Vertical divider
    draw.rectangle([half - 3, 0, half + 3, PANEL_H], fill=BRAND)

    # BEFORE / AFTER chips
    chip_font = _font(28)
    for label, x in (("BEFORE", 24), ("AFTER", half + 24)):
        w = draw.textlength(label, font=chip_font)
        draw.rectangle([x - 8, 18, x + w + 16, 60], fill=(0, 0, 0))
        draw.text((x + 4, 22), label, fill="white", font=chip_font)

    # Footer band
    draw.rectangle([0, PANEL_H, CARD_W, CARD_H], fill="white")
    title_font = _font(52)
    sub_font = _font(28)
    micro_font = _font(22)

    pretty_type = issue_type.replace("_", " ").title()
    headline = f"{pretty_type} · Fixed in {hours}h" if hours else f"{pretty_type} · Fixed"
    draw.text((48, PANEL_H + 32), headline, fill=INK, font=title_font)

    sub = f"via NagarikAI" + (f" · {dept}" if dept else "")
    draw.text((48, PANEL_H + 102), sub, fill=BRAND, font=sub_font)

    draw.text(
        (48, CARD_H - 50),
        "Report your ward's civic issues at nagarik.ai",
        fill=MUTED,
        font=micro_font,
    )

    # Brand watermark (top-right corner)
    wm = "NagarikAI"
    wm_font = _font(32)
    wm_w = draw.textlength(wm, font=wm_font)
    draw.text((CARD_W - wm_w - 24, 20), wm, fill="white", font=wm_font)

    out = io.BytesIO()
    canvas.save(out, "PNG", optimize=True)
    return out.getvalue()


@router.get("/{issue_id}/share.png")
def share_png(issue_id: uuid.UUID) -> Response:
    with SessionLocal() as db:
        issue = db.get(Issue, issue_id)
        if issue is None:
            raise HTTPException(404, "issue not found")
        before_url = issue.before_photo_url
        after_url = issue.after_photo_url
        issue_type = str(issue.type)
        dept = issue.routed_department
        hours = _hours_between(issue.created_at, issue.resolved_at)

    if not after_url:
        raise HTTPException(409, "fix not yet verified — share asset unavailable")

    png = _render_card(
        _fetch(before_url) if before_url else None,
        _fetch(after_url),
        issue_type,
        dept,
        hours,
    )
    return Response(
        content=png,
        media_type="image/png",
        # Cache aggressively — after-photo doesn't change once verified.
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )


def mark_share_ready(issue_id: str, base_path: str = "/issues") -> None:
    """Called by ResolutionAgent when CLIP verifies the fix. Sets
    issues.share_image_url to the relative path the frontend can fetch
    (and the Web Share API can attach). Idempotent — no-op if already set.
    """
    url = f"{base_path}/{issue_id}/share.png"
    with SessionLocal() as db:
        db.execute(
            update(Issue)
            .where(Issue.id == issue_id, Issue.share_image_url.is_(None))
            .values(share_image_url=url)
        )
        db.commit()
