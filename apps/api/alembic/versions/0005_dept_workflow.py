"""issue dept-workflow cols + departments + department_users

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Issue dept-workflow columns
    op.add_column("issues", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("issues", sa.Column("delivered_channel", sa.String(20), nullable=True))
    op.add_column("issues", sa.Column("acked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "issues",
        sa.Column("escalation_level", sa.Integer, nullable=False, server_default=sa.text("0")),
    )
    op.add_column("issues", sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True))

    # departments
    op.create_table(
        "departments",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(40), nullable=False, unique=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("primary_channel", sa.String(20), nullable=False, server_default="inapp_only"),
        sa.Column("whatsapp_number", sa.String(20), nullable=True),
        sa.Column("email", sa.String(120), nullable=True),
        sa.Column("webhook_url", sa.String(300), nullable=True),
        sa.Column("supervisor_name", sa.String(80), nullable=True),
        sa.Column("supervisor_phone", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_departments_code", "departments", ["code"], unique=True)

    # department_users
    op.create_table(
        "department_users",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(60), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(200), nullable=False),
        sa.Column("department_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("departments.id"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="supervisor"),
        sa.Column("name", sa.String(80), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_department_users_username", "department_users", ["username"], unique=True)
    op.create_index("ix_department_users_department_id", "department_users", ["department_id"])


def downgrade() -> None:
    op.drop_index("ix_department_users_department_id", "department_users")
    op.drop_index("ix_department_users_username", "department_users")
    op.drop_table("department_users")
    op.drop_index("ix_departments_code", "departments")
    op.drop_table("departments")
    op.drop_column("issues", "escalated_at")
    op.drop_column("issues", "escalation_level")
    op.drop_column("issues", "acked_at")
    op.drop_column("issues", "delivered_channel")
    op.drop_column("issues", "delivered_at")
