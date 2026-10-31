"""Audit entries about a Parent: their data deleted for good

Revision ID: 0021
Revises: 0020
"""

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"


def upgrade() -> None:
    op.alter_column("audit_log", "child_id", nullable=True)
    op.add_column("audit_log", sa.Column("parent_id", sa.Integer))
    op.create_index("ix_audit_log_parent_id", "audit_log", ["parent_id"])
    op.create_check_constraint(
        op.f("ck_audit_log_about_one"), "audit_log", "num_nonnulls(child_id, parent_id) = 1"
    )


def downgrade() -> None:
    # Deletes the entries about Parents for good: the old table cannot hold them. Only for going
    # back on a development database; never on the Kita's.
    op.drop_constraint(op.f("ck_audit_log_about_one"), "audit_log", type_="check")
    op.drop_index("ix_audit_log_parent_id", "audit_log")
    op.drop_column("audit_log", "parent_id")
    op.execute("DELETE FROM audit_log WHERE child_id IS NULL")
    op.alter_column("audit_log", "child_id", nullable=False)
