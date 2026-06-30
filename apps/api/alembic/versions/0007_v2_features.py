"""V2 features: audio reporting + budget estimator + crowdfunding/DIY + share assets

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-30

Adds the four V2 capabilities:

  1. Voice-first multimodal — issues.before_audio_url
  2. AI budget estimator    — issues.estimated_materials (JSON list),
                              issues.estimated_cost_inr (int rupees)
  3. Viral before/after loop — issues.share_image_url (URL to the
                              generated PNG; populated by ResolutionAgent)
  4. Community DIY + crowdfunding
       - issues.diy_unlocked_at         (NULL until SLA-3 breach on sev≤2)
       - issues.diy_threshold_met_at    (NULL until pledges cross threshold)
       - issues.diy_schedule (JSON)     (Claude-generated workplan)
       - new table: pledges             (each citizen pledge — funds OR hours)
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Issue-level columns ──────────────────────────────────────────────
    op.add_column("issues", sa.Column("before_audio_url", sa.String(500), nullable=True))
    op.add_column(
        "issues",
        sa.Column("estimated_materials", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column("issues", sa.Column("estimated_cost_inr", sa.Integer, nullable=True))
    op.add_column("issues", sa.Column("share_image_url", sa.String(500), nullable=True))
    op.add_column("issues", sa.Column("diy_unlocked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("issues", sa.Column("diy_threshold_met_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "issues",
        sa.Column("diy_schedule", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )

    # ── pledges ──────────────────────────────────────────────────────────
    # One row per pledge by a citizen. kind ∈ {funds, hours}.
    # Mock-money for now: amount_inr stored, no payment gateway. Whether
    # the pledge is honoured (citizen showed up / paid) is irrelevant for
    # the threshold trigger — we count pledges, not deliveries.
    op.create_table(
        "pledges",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("issue_id", UUID(as_uuid=True),
                  sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("citizen_id", UUID(as_uuid=True),
                  sa.ForeignKey("citizens.id"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),  # 'funds' | 'hours'
        sa.Column("amount_inr", sa.Integer, nullable=True),
        sa.Column("hours", sa.Float, nullable=True),
        sa.Column("note", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pledges_issue_id", "pledges", ["issue_id"])
    op.create_index("ix_pledges_citizen_id", "pledges", ["citizen_id"])


def downgrade() -> None:
    op.drop_index("ix_pledges_citizen_id", "pledges")
    op.drop_index("ix_pledges_issue_id", "pledges")
    op.drop_table("pledges")

    op.drop_column("issues", "diy_schedule")
    op.drop_column("issues", "diy_threshold_met_at")
    op.drop_column("issues", "diy_unlocked_at")
    op.drop_column("issues", "share_image_url")
    op.drop_column("issues", "estimated_cost_inr")
    op.drop_column("issues", "estimated_materials")
    op.drop_column("issues", "before_audio_url")
