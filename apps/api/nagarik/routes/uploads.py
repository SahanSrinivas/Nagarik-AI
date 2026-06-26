"""Direct-to-Supabase upload endpoints.

We hand out a signed upload URL so photos go straight from the citizen's
browser to Supabase Storage — the API never relays bytes. When Supabase
isn't configured we fall back to a stub that returns a placeholder URL.

The stub path is triggered when:
  - SUPABASE_URL / SUPABASE_SERVICE_KEY are empty, OR
  - SUPABASE_URL still has the .env.example placeholder ("xxx" / "your-project"), OR
  - any runtime error (DNS, auth, network) — we never propagate as a 500
    because that breaks the citizen /report flow.
"""

from __future__ import annotations

import logging
import secrets
import uuid

from fastapi import APIRouter

from nagarik.settings import get_settings

log = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _looks_like_placeholder(url: str) -> bool:
    """True for .env.example template values that won't resolve."""
    if not url:
        return True
    bad_tokens = ("xxx.supabase", "your-project", "<your", "example.supabase")
    return any(t in url.lower() for t in bad_tokens)


def _stub(file_key: str, reason: str) -> dict:
    # .jpg suffix forces placehold.co to return a real JPEG (not the
    # default SVG, which Gemini Vision rejects with INVALID_ARGUMENT).
    short = file_key.split("/")[-1][:24]
    return {
        "provider": "stub",
        "key": file_key,
        "upload_url": None,
        "public_url": f"https://placehold.co/600x400.jpg?text={short}",
        "note": f"Storage not configured: {reason}. /report still works — submit "
                "with this placeholder, the agent loop runs end-to-end. Set "
                "SUPABASE_URL + SUPABASE_SERVICE_KEY to enable real uploads.",
    }


@router.post("/signed-url")
def signed_url(content_type: str = "image/jpeg") -> dict:
    settings = get_settings()
    file_key = f"issues/{uuid.uuid4()}-{secrets.token_hex(4)}.jpg"

    if not settings.supabase_url or not settings.supabase_service_key:
        return _stub(file_key, "credentials missing")
    if _looks_like_placeholder(settings.supabase_url):
        return _stub(file_key, "SUPABASE_URL is a template placeholder")

    try:
        from supabase import create_client
    except ImportError:
        return _stub(file_key, "`supabase` package not installed")

    try:
        client = create_client(settings.supabase_url, settings.supabase_service_key)
        res = client.storage.from_(settings.supabase_bucket).create_signed_upload_url(file_key)
        public = client.storage.from_(settings.supabase_bucket).get_public_url(file_key)
    except Exception as exc:  # noqa: BLE001 — never propagate to the browser
        log.warning("supabase signed-url failed (%s) — falling back to stub", exc.__class__.__name__)
        return _stub(file_key, f"{exc.__class__.__name__} from Supabase")

    return {
        "provider": "supabase",
        "key": file_key,
        "upload_url": res.get("signedURL") or res.get("signed_url"),
        "token": res.get("token"),
        "public_url": public,
    }
