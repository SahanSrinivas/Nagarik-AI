"""issue.whatsapp_number

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("issues", sa.Column("whatsapp_number", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("issues", "whatsapp_number")
