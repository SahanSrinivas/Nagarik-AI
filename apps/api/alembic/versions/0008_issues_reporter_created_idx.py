"""Composite (reporter_id, created_at DESC) index for /issues/mine

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-30

The /issues/mine endpoint filters by reporter_id and orders by
created_at DESC. The existing single-column ix_issues_reporter_id can
satisfy the WHERE but Postgres still has to sort the matching rows for
the ORDER BY. A composite index on (reporter_id, created_at DESC) lets
the planner skip the sort and pull the top-N rows directly.

The single-column index is left in place — the composite index can serve
reporter_id-only lookups too, but removing the old one would be a churn
unrelated to the perf goal here.
"""

from __future__ import annotations

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_issues_reporter_id_created_at",
        "issues",
        ["reporter_id", "created_at"],
        postgresql_ops={"created_at": "DESC"},
    )


def downgrade() -> None:
    op.drop_index("ix_issues_reporter_id_created_at", "issues")
