"""Groups get a paper colour: the existing ones in turn, by when they were made

Revision ID: 0023
Revises: 0022
"""

import sqlalchemy as sa
from alembic import op

revision = "0023"
down_revision = "0022"

# As in kita.groups, in the order Groups get them; copied, since a migration must not change with
# the code.
_COLOURS = ("orange", "lilac", "green", "blue", "yellow", "rose", "teal", "sand")


def upgrade() -> None:
    op.add_column("groups", sa.Column("colour", sa.String(20)))
    groups = sa.table("groups", sa.column("id", sa.Integer), sa.column("colour", sa.String))
    connection = op.get_bind()
    ids = connection.scalars(sa.select(groups.c.id).order_by(groups.c.id)).all()
    for position, group_id in enumerate(ids):
        connection.execute(
            sa.update(groups)
            .where(groups.c.id == group_id)
            .values(colour=_COLOURS[position % len(_COLOURS)])
        )
    op.alter_column("groups", "colour", nullable=False)
    op.create_check_constraint(op.f("ck_groups_colour"), "groups", f"colour IN {_COLOURS}")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_groups_colour"), "groups", type_="check")
    op.drop_column("groups", "colour")
