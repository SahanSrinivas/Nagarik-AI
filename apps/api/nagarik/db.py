"""SQLAlchemy engine + session factory.

Handles three deployment modes:
  - Local Docker Postgres (default)            - postgresql+psycopg://… on 5432
  - Supabase Postgres direct                    - postgresql+psycopg://… on 5432
  - Supabase Postgres via pgBouncer pooler     - …pooler.supabase.com:6543

The pooler runs pgBouncer in *transaction* mode, which rejects prepared
statements. psycopg3 prepares any query it sees 5+ times by default, so we
disable prepared statements globally (prepare_threshold=None) whenever the
URL points at the pooler. Local postgres keeps prepared statements for
performance.
"""

from collections.abc import Iterator
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from nagarik.settings import get_settings


class Base(DeclarativeBase):
    """All ORM models inherit this."""


def _normalise_db_url(raw: str) -> str:
    """Accept both ``postgresql://…`` and ``postgresql+psycopg://…`` — coerce
    the former to the psycopg3 driver SQLAlchemy expects."""
    if raw.startswith("postgresql://"):
        return "postgresql+psycopg://" + raw[len("postgresql://"):]
    return raw


def _is_pooler(url: str) -> bool:
    try:
        host = urlparse(url).hostname or ""
    except Exception:  # noqa: BLE001
        return False
    return "pooler.supabase.com" in host or "pgbouncer" in host


_settings = get_settings()
_db_url = _normalise_db_url(_settings.database_url)

# Disable prepared statements when talking to pgBouncer transaction pooling;
# also set a smaller pool since the pooler does its own connection multiplexing.
_connect_args: dict = {}
_engine_kwargs: dict = {"pool_pre_ping": True, "future": True}
if _is_pooler(_db_url):
    _connect_args["prepare_threshold"] = None
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 5

engine = create_engine(_db_url, connect_args=_connect_args, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
