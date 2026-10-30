"""Incidents and their Follow-ups

Revision ID: 0017
Revises: 0016
"""

import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"


def upgrade() -> None:
    op.create_table(
        "incidents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "child_id",
            sa.Integer,
            sa.ForeignKey("children.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("happened_on", sa.Date, nullable=False),
        sa.Column("happened_at", sa.Time),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("informed", sa.Text, nullable=False),
        sa.Column("reported_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_incidents_child_id", "incidents", ["child_id"])
    op.create_table(
        "incident_follow_ups",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "incident_id",
            sa.Integer,
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("note", sa.Text, nullable=False),
        sa.Column("author", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("written_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_incident_follow_ups_incident_id", "incident_follow_ups", ["incident_id"])


def downgrade() -> None:
    op.drop_table("incident_follow_ups")
    op.drop_table("incidents")
