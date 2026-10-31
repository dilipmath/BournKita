"""Feedback sent from the app's pages

Revision ID: 0020
Revises: 0019
"""

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("page", sa.String(200), nullable=False),
        sa.Column("sent_by", sa.String(320), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("feedback")
