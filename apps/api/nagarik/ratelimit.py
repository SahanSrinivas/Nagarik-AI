"""Rate limiting via slowapi — in-process token bucket.

Public endpoints (signup, login, upload, issue submission, coverage) get
explicit limits. Operator endpoints are not limited because they assume
authenticated trusted users.

For multi-instance prod, swap the storage to redis://… via the
SLOWAPI_STORAGE_URI env var; the limiter API stays identical.
"""

from __future__ import annotations

import os

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

STORAGE_URI = os.environ.get("SLOWAPI_STORAGE_URI", "memory://")


def _client_ip(request: Request) -> str:
    # Behind GCP HTTPS LB / Cloud Run, request.client.host is the LB's
    # internal IP — everyone shares one bucket. The real caller's IP is
    # the leftmost entry in X-Forwarded-For.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(
    key_func=_client_ip,
    storage_uri=STORAGE_URI,
    default_limits=["120/minute"],
)
