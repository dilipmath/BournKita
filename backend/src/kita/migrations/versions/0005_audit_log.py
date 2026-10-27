"""Audit log

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("staff_email", sa.String(320), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("child_id", sa.Integer, nullable=False),
        sa.Column("changed_fields", sa.ARRAY(sa.String(50)), nullable=False),
        sa.CheckConstraint("action IN ('viewed', 'created', 'changed', 'deleted')", name="action"),
    )
    op.create_index("ix_audit_log_at", "audit_log", ["at"])
    op.create_index("ix_audit_log_child_id", "audit_log", ["child_id"])


def downgrade() -> None:
    op.drop_table("audit_log")
