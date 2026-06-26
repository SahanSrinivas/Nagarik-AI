"""issue.before_video_url + after_video_url; citizen.home_lat/lng + is_verifier

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("issues", sa.Column("before_video_url", sa.String(500), nullable=True))
    op.add_column("issues", sa.Column("after_video_url", sa.String(500), nullable=True))

    op.add_column("citizens", sa.Column("home_lat", sa.Float, nullable=True))
    op.add_column("citizens", sa.Column("home_lng", sa.Float, nullable=True))
    op.add_column(
        "citizens",
        sa.Column("is_verifier", sa.Boolean, nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("citizens", "is_verifier")
    op.drop_column("citizens", "home_lng")
    op.drop_column("citizens", "home_lat")
    op.drop_column("issues", "after_video_url")
    op.drop_column("issues", "before_video_url")
