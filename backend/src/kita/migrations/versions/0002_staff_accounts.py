"""Staff accounts: email verification and deactivation

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade() -> None:
    # Invited Staff members choose their password when they verify their email address.
    op.alter_column("users", "password_hash", nullable=True)
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("deactivated_at", sa.DateTime(timezone=True)))
    # Accounts so far were made by the setup command, which needs no verification.
    op.execute("UPDATE users SET email_verified_at = created_at")
    op.create_table(
        "email_verifications",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("email_verifications")
    op.drop_column("users", "deactivated_at")
    op.drop_column("users", "email_verified_at")
    op.execute("DELETE FROM users WHERE password_hash IS NULL")
    op.alter_column("users", "password_hash", nullable=False)
