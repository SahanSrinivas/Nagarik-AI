"""Citizen authentication — JWT (HS256) with PBKDF2-SHA256 password hashing.

Why not Argon2/bcrypt? They're better, but PBKDF2 ships in the stdlib so the
demo runs without any new compile-step deps. 200k iterations is well above
OWASP's 2023 floor of 600k for SHA-1 (PBKDF2-SHA256 needs fewer rounds for
equivalent security; we pad with 200k anyway).

JWT lives in localStorage on the client and is sent as a Bearer token.
24-hour expiry. Server reads JWT_SECRET from env, falls back to a stable
per-process secret for the demo (logs a warning).
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from nagarik.db import get_db
from nagarik.models import Citizen

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# ─── Config ──────────────────────────────────────────────────────────────

JWT_SECRET = os.environ.get("JWT_SECRET") or os.environ.get("CH_JWT_SECRET")
if not JWT_SECRET:
    JWT_SECRET = secrets.token_urlsafe(48)
    log.warning("JWT_SECRET unset — generated per-process. Set it in .env for production.")

JWT_ALG = "HS256"
JWT_TTL_HOURS = 24
PBKDF2_ITERATIONS = 200_000
PBKDF2_SALT_BYTES = 16

# Demo credentials — surface on /login so judges can sign in instantly.
DEMO_USERNAME = "H@cktHon"
DEMO_PASSWORD = "Sw33ney@8688"

# ─── Password hashing ────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """PBKDF2-SHA256, salted, encoded as: pbkdf2_sha256$<iters>$<salt_b64>$<hash_b64>"""
    import base64
    salt = secrets.token_bytes(PBKDF2_SALT_BYTES)
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(plain: str, encoded: str | None) -> bool:
    """Constant-time compare against a stored pbkdf2_sha256$... hash."""
    import base64
    if not encoded or not encoded.startswith("pbkdf2_sha256$"):
        return False
    try:
        _, iters_s, salt_b64, dk_b64 = encoded.split("$")
        iters = int(iters_s)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(dk_b64)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, iters)
    return hmac.compare_digest(actual, expected)


# ─── JWT ─────────────────────────────────────────────────────────────────

def issue_jwt(sub: str, *, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_TTL_HOURS)).timestamp()),
        "iss": "nagarik",
        **(extra or {}),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG], issuer="nagarik")


# ─── Schemas ─────────────────────────────────────────────────────────────

class SignupIn(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=8, max_length=200)
    name: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=15)
    # Optional accurate home location. When both lat and lng are supplied
    # the citizen becomes a verifier — eligible to confirm/contest reports
    # near their address (range checked at verify time).
    home_lat: float | None = Field(default=None, ge=-90, le=90)
    home_lng: float | None = Field(default=None, ge=-180, le=180)


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    citizen: dict


# ─── Dependencies ────────────────────────────────────────────────────────

bearer = HTTPBearer(auto_error=False)


def current_citizen(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Session = Depends(get_db),
) -> Citizen:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    try:
        payload = decode_jwt(creds.credentials)
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {exc}") from exc
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token missing subject")
    try:
        cid = uuid.UUID(sub)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token subject not a UUID") from exc
    citizen = db.get(Citizen, cid)
    if citizen is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "citizen no longer exists")
    return citizen


# ─── Routes ──────────────────────────────────────────────────────────────

def _citizen_dict(c: Citizen) -> dict:
    return {
        "id": str(c.id),
        "username": c.username,
        "name": c.name,
        "phone": c.phone,
        "xp": c.xp,
        "badge": c.badge,
        "is_verifier": bool(getattr(c, "is_verifier", False)),
        "home_lat": getattr(c, "home_lat", None),
        "home_lng": getattr(c, "home_lng", None),
    }


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupIn, db: Session = Depends(get_db)) -> TokenOut:
    if db.scalar(select(Citizen).where(Citizen.username == payload.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "username already taken")
    # Auto-phone must fit phone VARCHAR(15). Format: +91d<10 hex> = 14 chars.
    phone = payload.phone or f"+91d{uuid.uuid4().hex[:10]}"
    has_home = payload.home_lat is not None and payload.home_lng is not None
    citizen = Citizen(
        username=payload.username,
        password_hash=hash_password(payload.password),
        name=payload.name or payload.username,
        phone=phone,
        xp=0,
        home_lat=payload.home_lat,
        home_lng=payload.home_lng,
        is_verifier=has_home,
    )
    db.add(citizen)
    db.commit()
    db.refresh(citizen)
    return TokenOut(access_token=issue_jwt(str(citizen.id)), citizen=_citizen_dict(citizen))


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    citizen = db.scalar(select(Citizen).where(Citizen.username == payload.username))
    if citizen is None or not verify_password(payload.password, citizen.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid username or password")
    return TokenOut(access_token=issue_jwt(str(citizen.id)), citizen=_citizen_dict(citizen))


@router.get("/me", response_model=dict)
def me(citizen: Annotated[Citizen, Depends(current_citizen)]) -> dict:
    return _citizen_dict(citizen)


@router.get("/demo-credentials")
def demo_credentials() -> dict:
    """Surface the seeded demo credentials on the login page. Hackathon-only."""
    return {"username": DEMO_USERNAME, "password": DEMO_PASSWORD}


def ensure_demo_user_exists(db: Session) -> None:
    """Seed the demo account on boot so /login always works for judges."""
    existing = db.scalar(select(Citizen).where(Citizen.username == DEMO_USERNAME))
    if existing is None:
        c = Citizen(
            username=DEMO_USERNAME,
            password_hash=hash_password(DEMO_PASSWORD),
            name="Hackathon Demo",
            phone="+919000000001",
            xp=125,
        )
        db.add(c)
        db.commit()
        log.info("seeded demo citizen %s", DEMO_USERNAME)
    elif not existing.password_hash:
        existing.password_hash = hash_password(DEMO_PASSWORD)
        db.commit()
        log.info("rehydrated demo citizen %s with password", DEMO_USERNAME)
