"""Child profiles

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"


def upgrade() -> None:
    op.create_table(
        "children",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("gender", sa.String(20)),
        sa.Column("languages", sa.String(200), nullable=False),
        sa.Column("food_preferences", sa.String(2000), nullable=False),
        sa.Column("interests", sa.String(2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("gender IN ('girl', 'boy', 'diverse')", name="gender"),
    )


def downgrade() -> None:
    op.drop_table("children")
