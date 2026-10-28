"""Backlog: each Task's place, assignee, due date and labels

Revision ID: 0013
Revises: 0012
"""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"


def upgrade() -> None:
    op.add_column("tasks", sa.Column("position", sa.Integer))
    # The Tasks so far keep their order: oldest first.
    op.execute("UPDATE tasks SET position = id")
    op.alter_column("tasks", "position", nullable=False)
    op.add_column(
        "tasks",
        sa.Column("assignee_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
    )
    op.add_column("tasks", sa.Column("due_on", sa.Date))
    op.add_column(
        "tasks",
        sa.Column(
            "labels", sa.ARRAY(sa.String(30)), nullable=False, server_default=sa.text("'{}'")
        ),
    )
    op.alter_column("tasks", "labels", server_default=None)


def downgrade() -> None:
    op.drop_column("tasks", "labels")
    op.drop_column("tasks", "due_on")
    op.drop_column("tasks", "assignee_id")
    op.drop_column("tasks", "position")
