"""Parents, linked to Children

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"


def upgrade() -> None:
    op.create_table(
        "parents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("address", sa.Text, nullable=False),
        sa.Column("phone", sa.Text, nullable=False),
        sa.Column("email", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "child_parents",
        sa.Column(
            "child_id",
            sa.Integer,
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "parent_id",
            sa.Integer,
            sa.ForeignKey("parents.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("child_parents")
    op.drop_table("parents")
