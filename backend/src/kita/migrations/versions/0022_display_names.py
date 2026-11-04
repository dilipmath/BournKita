"""Staff accounts get an optional display name, for greeting the Staff member

Revision ID: 0022
Revises: 0021
"""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(50)))


def downgrade() -> None:
    op.drop_column("users", "display_name")
