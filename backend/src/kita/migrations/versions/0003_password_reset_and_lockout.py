"""Password reset links and lockout after repeated failed logins

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"


def upgrade() -> None:
    op.create_table(
        "password_resets",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.add_column(
        "users", sa.Column("failed_logins", sa.Integer, nullable=False, server_default="0")
    )
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_logins")
    op.drop_table("password_resets")
