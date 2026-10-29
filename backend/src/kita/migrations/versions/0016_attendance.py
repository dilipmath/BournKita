"""Attendance and Absences

Revision ID: 0016
Revises: 0015
"""

import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"


def upgrade() -> None:
    op.create_table(
        "attendance",
        sa.Column(
            "child_id",
            sa.Integer,
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("on", sa.Date, primary_key=True),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("checked_out_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "absences",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "child_id",
            sa.Integer,
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("starts_on", sa.Date, nullable=False),
        sa.Column("ends_on", sa.Date, nullable=False),
        sa.Column("reason", sa.Text, nullable=False),
    )
    op.create_index("ix_absences_child_id", "absences", ["child_id"])


def downgrade() -> None:
    op.drop_table("absences")
    op.drop_table("attendance")
