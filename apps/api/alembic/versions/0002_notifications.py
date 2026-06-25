"""notifications table

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON, UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("issue_id", UUID(as_uuid=True), sa.ForeignKey("issues.id"), nullable=False, index=True),
        sa.Column("citizen_id", UUID(as_uuid=True), sa.ForeignKey("citizens.id"), nullable=False, index=True),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("body", sa.String(500), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False, server_default="in_app"),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("payload", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("notifications")
