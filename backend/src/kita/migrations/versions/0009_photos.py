"""Photos

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"


def upgrade() -> None:
    op.create_table(
        "photos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("child_id", sa.Integer, sa.ForeignKey("children.id", ondelete="CASCADE")),
        sa.Column(
            "contact_id",
            sa.Integer,
            sa.ForeignKey("child_contacts.id", ondelete="CASCADE"),
            unique=True,
        ),
        sa.Column(
            "parent_id", sa.Integer, sa.ForeignKey("parents.id", ondelete="CASCADE"), unique=True
        ),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("num_nonnulls(child_id, contact_id, parent_id) = 1", name="one_owner"),
    )
    op.create_index("ix_photos_child_id", "photos", ["child_id"])


def downgrade() -> None:
    op.drop_table("photos")
