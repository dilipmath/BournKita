"""Groups

Revision ID: 0010
Revises: 0009
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"

_ICONS = [
    "monkey",
    "butterfly",
    "bee",
    "ladybird",
    "frog",
    "fox",
    "bear",
    "rabbit",
    "owl",
    "hedgehog",
    "turtle",
    "fish",
    "sun",
    "flower",
    "tree",
    "star",
]


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("icon", sa.String(20), nullable=False),
        sa.CheckConstraint(f"icon IN {tuple(_ICONS)}", name="icon"),
    )
    op.create_index("uq_groups_name", "groups", [sa.text("lower(name)")], unique=True)
    op.create_table(
        "child_groups",
        sa.Column(
            "child_id",
            sa.Integer,
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_child_groups_group_id", "child_groups", ["group_id"])
    op.create_table(
        "group_staff",
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
    )


def downgrade() -> None:
    op.drop_table("group_staff")
    op.drop_table("child_groups")
    op.drop_table("groups")
