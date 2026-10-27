"""Consents

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"


def upgrade() -> None:
    op.create_table(
        "child_consents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "child_id",
            sa.Integer,
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("consent", sa.String(20), nullable=False),
        sa.Column("given_on", sa.Date, nullable=False),
        sa.Column("withdrawn_on", sa.Date),
        sa.CheckConstraint("consent IN ('photo', 'excursion', 'dataProtection')", name="consent"),
    )
    op.create_index("ix_child_consents_child_id", "child_consents", ["child_id"])


def downgrade() -> None:
    op.drop_table("child_consents")
