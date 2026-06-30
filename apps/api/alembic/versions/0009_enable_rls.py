"""Enable RLS on every public table to lock down Supabase's anon REST API

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-30

Supabase auto-exposes every public-schema table via PostgREST. With RLS
disabled, the anon API key can read+write+delete every row — Supabase
flagged this as a critical issue. NagarikAI's FastAPI backend connects
via SQLAlchemy as the table owner, which bypasses RLS by default, so
this migration is transparent to the app: only the PostgREST surface is
affected.

No policies are created, which is the intent — empty policy set + RLS
enabled = total deny for non-owner roles (anon, authenticated). If we
ever want to expose a table via PostgREST later, add a SELECT policy
for the `anon` or `authenticated` role at that point.

spatial_ref_sys is owned by the PostGIS extension and cannot be altered.
"""

from __future__ import annotations

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


TABLES = [
    "agent_events",
    "alembic_version",
    "citizens",
    "crews",
    "department_users",
    "departments",
    "issues",
    "notifications",
    "pledges",
    "verifications",
]


def upgrade() -> None:
    for t in TABLES:
        op.execute(f'ALTER TABLE public."{t}" ENABLE ROW LEVEL SECURITY;')


def downgrade() -> None:
    for t in TABLES:
        op.execute(f'ALTER TABLE public."{t}" DISABLE ROW LEVEL SECURITY;')
