"""citizen: password_hash + username

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("citizens", sa.Column("username", sa.String(60), nullable=True))
    op.add_column("citizens", sa.Column("password_hash", sa.String(200), nullable=True))
    op.create_index("ix_citizens_username", "citizens", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_citizens_username", "citizens")
    op.drop_column("citizens", "password_hash")
    op.drop_column("citizens", "username")
