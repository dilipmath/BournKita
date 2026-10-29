"""Events in the calendar

Revision ID: 0014
Revises: 0013
"""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("group_id", sa.Integer, sa.ForeignKey("groups.id", ondelete="CASCADE")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("note", sa.String(2000), nullable=False),
        sa.Column("starts_on", sa.Date, nullable=False),
        sa.Column("ends_on", sa.Date, nullable=False),
        sa.Column("start_time", sa.Time),
        sa.Column("end_time", sa.Time),
        sa.Column("repeat", sa.String(10), nullable=False),
        sa.Column("repeat_every", sa.Integer, nullable=False),
        sa.Column("repeat_until", sa.Date),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "repeat IN ('none', 'daily', 'weekly', 'monthly', 'yearly')", name="repeat"
        ),
        sa.CheckConstraint("ends_on >= starts_on", name="ends_after_start"),
    )
    op.create_index("ix_events_group_id", "events", ["group_id"])


def downgrade() -> None:
    op.drop_table("events")
