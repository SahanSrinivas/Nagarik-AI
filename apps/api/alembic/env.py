"""Alembic environment — wires in our SQLAlchemy metadata + GeoAlchemy/pgvector types."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from geoalchemy2 import Geography  # noqa: F401 — register type for autogenerate
from pgvector.sqlalchemy import Vector  # noqa: F401 — register type for autogenerate
from sqlalchemy import engine_from_config, pool

from nagarik.db import Base
from nagarik.models import (  # noqa: F401 — load model metadata
    AgentEvent,
    Citizen,
    Crew,
    Issue,
    Verification,
)
from nagarik.notifications import Notification  # noqa: F401 — register model
from nagarik.settings import get_settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Reuse the live SQLAlchemy engine from nagarik/db.py so we don't have to
# round-trip the URL through alembic's configparser — configparser does
# %-interpolation, which corrupts URL-encoded passwords (e.g. M%40inCoffee
# would error on '%40'). Reusing the engine also picks up our pgBouncer
# settings (prepare_threshold=None) without duplication.
from nagarik.db import engine as _live_engine

target_metadata = Base.metadata


def _include_object(obj, name: str, type_: str, reflected: bool, compare_to) -> bool:
    # Skip PostGIS internal tables.
    if type_ == "table" and name in {"spatial_ref_sys"}:
        return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=str(_live_engine.url),
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=_include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with _live_engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=_include_object,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
