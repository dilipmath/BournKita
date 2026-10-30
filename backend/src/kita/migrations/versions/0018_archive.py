"""The archive: deleted Children are kept, archived, until the retention period ends

Revision ID: 0018
Revises: 0017
"""

import sqlalchemy as sa
from alembic import op

revision = "0018"
down_revision = "0017"


def upgrade() -> None:
    op.add_column("children", sa.Column("archived_at", sa.DateTime(timezone=True)))
    op.create_index("ix_children_archived_at", "children", ["archived_at"])


def downgrade() -> None:
    op.drop_index("ix_children_archived_at", "children")
    op.drop_column("children", "archived_at")
