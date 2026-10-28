"""Alerts: allergies and medical conditions

Revision ID: 0011
Revises: 0010
"""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"


def upgrade() -> None:
    op.create_table(
        "child_alerts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "child_id",
            sa.Integer,
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Encrypted, like name and note, so checked by the API rather than here.
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("note", sa.Text, nullable=False),
    )
    op.create_index("ix_child_alerts_child_id", "child_alerts", ["child_id"])


def downgrade() -> None:
    op.drop_table("child_alerts")
