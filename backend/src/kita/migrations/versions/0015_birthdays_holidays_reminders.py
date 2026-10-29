"""Dates of birth, holidays and Event reminders

Revision ID: 0015
Revises: 0014
"""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"


def upgrade() -> None:
    op.add_column("children", sa.Column("date_of_birth", sa.Date))
    op.create_table(
        "holidays",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("starts_on", sa.Date, nullable=False),
        sa.Column("ends_on", sa.Date, nullable=False),
        sa.CheckConstraint("kind IN ('public', 'school')", name="kind"),
        sa.CheckConstraint("ends_on >= starts_on", name="ends_after_start"),
    )
    op.create_index("ix_holidays_starts_on", "holidays", ["starts_on"])
    op.add_column("events", sa.Column("remind_days_before", sa.Integer))
    op.create_table(
        "reminders_sent",
        sa.Column(
            "event_id",
            sa.Integer,
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("occurs_on", sa.Date, primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
    )


def downgrade() -> None:
    op.drop_table("reminders_sent")
    op.drop_column("events", "remind_days_before")
    op.drop_table("holidays")
    op.drop_column("children", "date_of_birth")
