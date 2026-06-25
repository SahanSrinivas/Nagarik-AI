"""Direct-to-Supabase upload endpoints.

We hand out a signed upload URL so photos go straight from the citizen's
browser to Supabase Storage — the API never relays bytes. When Supabase
isn't configured we fall back to a stub that round-trips through /uploads/
local-stub for end-to-end demo flow.
"""

from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, HTTPException

from nagarik.settings import get_settings

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/signed-url")
def signed_url(content_type: str = "image/jpeg") -> dict:
    settings = get_settings()

    file_key = f"issues/{uuid.uuid4()}-{secrets.token_hex(4)}.jpg"

    if not settings.supabase_url or not settings.supabase_service_key:
        return {
            "provider": "stub",
            "key": file_key,
            "upload_url": None,
            "public_url": f"https://placehold.co/600x400?text={file_key.split('/')[-1]}",
            "note": "Supabase not configured — using placeholder URL. Set SUPABASE_URL + SUPABASE_SERVICE_KEY to enable real uploads.",
        }

    try:
        from supabase import create_client
    except ImportError as e:
        raise HTTPException(500, "install `supabase` to enable real uploads") from e

    client = create_client(settings.supabase_url, settings.supabase_service_key)
    res = client.storage.from_(settings.supabase_bucket).create_signed_upload_url(file_key)
    public = client.storage.from_(settings.supabase_bucket).get_public_url(file_key)

    return {
        "provider": "supabase",
        "key": file_key,
        "upload_url": res.get("signedURL") or res.get("signed_url"),
        "token": res.get("token"),
        "public_url": public,
    }
