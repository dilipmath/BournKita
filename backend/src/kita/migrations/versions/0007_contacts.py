"""Emergency contacts and Pick-up persons; whether a Parent may pick up

Revision ID: 0007
Revises: 0006
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"


def upgrade() -> None:
    op.create_table(
        "child_contacts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "child_id",
            sa.Integer,
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("relationship", sa.String(100), nullable=False),
        sa.Column("phone", sa.Text, nullable=False),
        sa.Column("note", sa.Text, nullable=False),
        sa.CheckConstraint("kind IN ('emergency', 'pickUp')", name="kind"),
    )
    op.create_index("ix_child_contacts_child_id", "child_contacts", ["child_id"])
    # Parents linked so far may pick up their Children, as before.
    op.add_column(
        "child_parents",
        sa.Column("may_pick_up", sa.Boolean, nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("child_parents", "may_pick_up")
    op.drop_table("child_contacts")
