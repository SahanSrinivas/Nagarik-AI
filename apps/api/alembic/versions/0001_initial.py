"""initial schema — citizens, issues, verifications, crews, agent_events

Revision ID: 0001
Revises:
Create Date: 2026-06-25
"""

from __future__ import annotations

import geoalchemy2
import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON, UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "citizens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(15), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(80)),
        sa.Column("xp", sa.Integer, nullable=False, server_default="0"),
        sa.Column("badge", sa.String(40)),
        sa.Column("ward", sa.String(40)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "crews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("department", sa.String(80), nullable=False, index=True),
        sa.Column(
            "depot_location",
            geoalchemy2.Geography(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column("skills", JSON, nullable=False, server_default="[]"),
        sa.Column("daily_capacity", sa.Integer, nullable=False, server_default="8"),
        sa.Column("shift_start_hour", sa.Integer, nullable=False, server_default="9"),
        sa.Column("shift_end_hour", sa.Integer, nullable=False, server_default="18"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "issues",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("reporter_id", UUID(as_uuid=True), sa.ForeignKey("citizens.id"), nullable=False, index=True),
        sa.Column("type", sa.String(20), nullable=False, server_default="other"),
        sa.Column("severity", sa.Integer, nullable=False, server_default="3"),
        sa.Column("status", sa.String(20), nullable=False, server_default="reported", index=True),
        sa.Column(
            "location",
            geoalchemy2.Geography(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column("address", sa.String(300)),
        sa.Column("ward", sa.String(40), index=True),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("before_photo_url", sa.String(500)),
        sa.Column("after_photo_url", sa.String(500)),
        sa.Column("ai_classification", JSON, nullable=False, server_default="{}"),
        sa.Column("ai_confidence", sa.Float, nullable=False, server_default="0"),
        sa.Column("image_embedding", pgvector.sqlalchemy.Vector(512)),
        sa.Column("duplicate_of_id", UUID(as_uuid=True), sa.ForeignKey("issues.id")),
        sa.Column("routed_department", sa.String(80)),
        sa.Column("sla_deadline", sa.DateTime(timezone=True)),
        sa.Column("assigned_crew_id", UUID(as_uuid=True), sa.ForeignKey("crews.id")),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    op.execute("CREATE INDEX ix_issues_location ON issues USING gist (location)")
    op.execute(
        "CREATE INDEX ix_issues_embedding ON issues "
        "USING ivfflat (image_embedding vector_cosine_ops) WITH (lists = 100)"
    )

    op.create_table(
        "verifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("issue_id", UUID(as_uuid=True), sa.ForeignKey("issues.id"), nullable=False, index=True),
        sa.Column("citizen_id", UUID(as_uuid=True), sa.ForeignKey("citizens.id"), nullable=False, index=True),
        sa.Column("confirms", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("note", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "agent_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("issue_id", UUID(as_uuid=True), sa.ForeignKey("issues.id"), nullable=False, index=True),
        sa.Column("agent", sa.String(40), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("payload", JSON, nullable=False, server_default="{}"),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("agent_events")
    op.drop_table("verifications")
    op.execute("DROP INDEX IF EXISTS ix_issues_embedding")
    op.execute("DROP INDEX IF EXISTS ix_issues_location")
    op.drop_table("issues")
    op.drop_table("crews")
    op.drop_table("citizens")
