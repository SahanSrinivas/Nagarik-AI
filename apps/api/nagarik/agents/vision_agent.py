"""Agent 1 — VisionAgent.

Calls Gemini 2.5 Flash on the citizen's evidence (photo OR short video) to
extract:
- type (pothole / garbage / streetlight / water_leak / ...)
- severity (1-5)
- bounding-box metadata (width, depth, hazard score)

Two paths depending on the evidence type:

  PHOTO: download bytes from before_photo_url, inline them as a Part, and
         send (prompt + image) to gemini-2.5-flash with JSON response mime.

  VIDEO: download the clip, upload it to the Gemini Files API (videos must
         go through Files for processing), poll until the file is ACTIVE,
         then send (prompt + file_uri) to gemini-2.5-flash. Gemini samples
         frames internally — same JSON schema comes back.

Falls back to a deterministic stub when GOOGLE_API_KEY is missing or the
call fails, so the agent loop is never blocked by AI errors.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx
from sqlalchemy import update

from nagarik.agents.state import AgentState
from nagarik.db import SessionLocal
from nagarik.models import Issue, IssueStatus
from nagarik.settings import get_settings

log = logging.getLogger(__name__)

ALLOWED_TYPES = {"pothole", "garbage", "streetlight", "water_leak", "sewage", "tree_fall", "encroachment", "other"}

PROMPT = """You are a civic-issue triage assistant for an Indian municipality (BBMP, BWSSB, BESCOM).

Look at the photo and return STRICT JSON only — no prose, no markdown.

Schema:
{
  "type":       one of [pothole, garbage, streetlight, water_leak, sewage, tree_fall, encroachment, other],
  "severity":   integer 1-5 (5 = immediate hazard to life or property),
  "confidence": float 0-1,
  "notes":      one short sentence for the field crew (max 25 words),
  "width_m":    approximate width in metres (or null),
  "depth_cm":   approximate depth in cm if applicable (or null),
  "indoor":     true if the photo is clearly indoor / not a civic issue,
  "hazard_to":  one of [pedestrians, vehicles, residents, sanitation, public_safety, none],
  "bbox":       [x_min, y_min, x_max, y_max]  // normalised 0-1 image coords
                                              // of the SMALLEST region that
                                              // tightly contains the issue.
                                              // Top-left = (0,0). For point-like
                                              // issues (a single streetlight,
                                              // tree branch) make a tight box
                                              // around the fixture, ~5-15% wide.
  "focus_label": short 1-3 word label to print next to the box (e.g.
                 "pothole · sev 4", "broken lamp")
}

Only return the JSON object. No text before or after."""


def _stub(state: AgentState, note: str = "stub") -> AgentState:
    return {
        **state,
        "classified_type": "pothole",
        "severity": 3,
        "ai_confidence": 0.5,
        "ai_meta": {"notes": note},
    }  # type: ignore[return-value]


def _parse_json(text: str) -> dict[str, Any] | None:
    """Tolerant JSON parser — Gemini occasionally wraps output in ```json fences."""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Last resort — grab the first {...} block.
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not m:
            return None
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return None


_GEMINI_ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
_GEMINI_VIDEO_MIMES = {"video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp"}


def _build_video_parts(client, video_url: str):
    """Upload a video to Gemini Files API and return a Part referencing it.

    Gemini cannot accept videos inline — they must be uploaded as a File and
    polled until ``state == ACTIVE``. We download to a temp file, upload,
    poll for up to 60 seconds, then return a single-element [Part(file_uri)].
    """
    import tempfile
    import time
    from pathlib import Path

    from google.genai import types as gtypes

    with httpx.Client(follow_redirects=True, timeout=60) as http:
        r = http.get(video_url, headers={"User-Agent": "NagarikAI-Vision/0.1"})
        r.raise_for_status()
        mime = r.headers.get("content-type", "video/mp4").split(";")[0].strip().lower()
        if mime not in _GEMINI_VIDEO_MIMES:
            mime = "video/mp4"  # best-effort; Gemini sniffs the container

        suffix = ".mp4" if mime == "video/mp4" else Path(video_url).suffix or ".mp4"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(r.content)
            local_path = f.name

    uploaded = client.files.upload(file=local_path, config={"mime_type": mime})
    # Poll until ACTIVE — videos take a few seconds to process.
    for _ in range(20):
        info = client.files.get(name=uploaded.name)
        state_name = getattr(info, "state", None)
        if hasattr(state_name, "name"):
            state_name = state_name.name
        if state_name == "ACTIVE":
            return [gtypes.Part.from_uri(file_uri=info.uri, mime_type=mime)]
        if state_name == "FAILED":
            raise RuntimeError(f"Gemini reported FAILED processing {uploaded.name}")
        time.sleep(2)
    raise TimeoutError("Gemini video processing did not become ACTIVE within 40s")


def _fetch_image(url: str) -> tuple[bytes, str]:
    with httpx.Client(follow_redirects=True, timeout=20) as client:
        r = client.get(url, headers={"User-Agent": "NagarikAI-Vision/0.1"})
        r.raise_for_status()
        mime = r.headers.get("content-type", "image/jpeg").split(";")[0].strip().lower()
        if mime not in _GEMINI_ALLOWED_MIMES:
            # Gemini Vision rejects SVG and other vector/exotic MIME types.
            # Re-encode to JPEG via Pillow so the upstream call always succeeds.
            try:
                import io
                from PIL import Image
                img = Image.open(io.BytesIO(r.content)).convert("RGB")
                buf = io.BytesIO()
                img.save(buf, "JPEG", quality=88)
                return buf.getvalue(), "image/jpeg"
            except Exception as exc:  # noqa: BLE001
                raise ValueError(f"unsupported image MIME {mime!r}: {exc}") from exc
        return r.content, mime


def run_vision(state: AgentState) -> AgentState:
    settings = get_settings()
    if not settings.google_api_key:
        new = _stub(state, "no GOOGLE_API_KEY configured")
        _persist(new)
        return new

    with SessionLocal() as db:
        issue = db.get(Issue, state["issue_id"])
        if issue is None:
            new = _stub(state, "issue not found")
            _persist(new)
            return new
        photo_url = issue.before_photo_url
        video_url = getattr(issue, "before_video_url", None)

    # Prefer video when present (richer signal); fall back to photo.
    if not photo_url and not video_url:
        new = _stub(state, "no evidence on issue")
        _persist(new)
        return new

    try:
        # Lazy import keeps cold-start fast when Gemini isn't wired up.
        from google import genai
        from google.genai import types as gtypes

        client = genai.Client(api_key=settings.google_api_key)

        if video_url:
            try:
                parts = _build_video_parts(client, video_url)
            except Exception as exc:  # noqa: BLE001
                log.warning("vision: video prep failed (%s) — trying photo fallback", exc)
                if not photo_url:
                    new = _stub(state, f"video prep failed: {exc.__class__.__name__}")
                    _persist(new)
                    return new
                video_url = None  # fall through to photo path

        if not video_url:
            try:
                image_bytes, mime = _fetch_image(photo_url)  # type: ignore[arg-type]
            except (httpx.HTTPError, ValueError) as exc:
                log.warning("vision: failed to fetch %s: %s", photo_url, exc)
                new = _stub(state, f"image fetch failed: {exc.__class__.__name__}")
                _persist(new)
                return new
            parts = [gtypes.Part.from_bytes(data=image_bytes, mime_type=mime)]

        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[*parts, PROMPT],
            config=gtypes.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
                # Disable Gemini 2.5 Flash's internal "thinking" — for a
                # straight classify task we don't need extended reasoning,
                # and thinking tokens eat the output budget. (Older 400-
                # then-1500-token caps were exhausted by thinking before
                # any JSON got emitted.)
                thinking_config=gtypes.ThinkingConfig(thinking_budget=0),
                max_output_tokens=800,
            ),
        )
        text = getattr(resp, "text", "") or ""
    except Exception as exc:  # noqa: BLE001 — never let LLM errors halt the loop
        log.warning("vision: gemini call failed: %s", exc)
        # Include the message (truncated) so the supervisor /issue/{id} view
        # surfaces the real failure instead of a bare class name. We have
        # been bitten by this — google-genai version drift returned
        # `ValidationError` with no further hint until this line was changed.
        new = _stub(state, f"gemini error: {exc.__class__.__name__}: {str(exc)[:200]}")
        _persist(new)
        return new

    parsed = _parse_json(text)
    if not parsed:
        log.warning("vision: could not parse gemini output: %r", text[:200])
        new = _stub(state, "parse failed")
        _persist(new)
        return new

    raw_type = str(parsed.get("type", "other")).lower().strip()
    classified = raw_type if raw_type in ALLOWED_TYPES else "other"

    try:
        severity = int(parsed.get("severity", 3))
    except (TypeError, ValueError):
        severity = 3
    severity = max(1, min(5, severity))

    try:
        confidence = float(parsed.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))

    new: AgentState = {
        **state,
        "classified_type": classified,
        "severity": severity,
        "ai_confidence": confidence,
        "ai_meta": parsed,
    }  # type: ignore[assignment]
    _persist(new)
    return new


def _persist(state: AgentState) -> None:
    with SessionLocal() as db:
        db.execute(
            update(Issue)
            .where(Issue.id == state["issue_id"])
            .values(
                type=state.get("classified_type", "other"),
                severity=state.get("severity", 3),
                ai_confidence=state.get("ai_confidence", 0.0),
                ai_classification=state.get("ai_meta", {}),
                status=IssueStatus.CLASSIFIED,
            )
        )
        db.commit()
