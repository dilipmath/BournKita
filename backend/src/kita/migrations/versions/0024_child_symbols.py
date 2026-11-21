"""Children get a Symbol, as on their coat hook: unique within each Group

Each Group's Children get the Symbols in turn by name, the current ones first, then the archived
ones; Children in no Group likewise among themselves. Only a Group of more than 30 Children could
get one twice (an archived Child would then choose another when restored).

Revision ID: 0024
Revises: 0023
"""

import sqlalchemy as sa
from alembic import op

revision = "0024"
down_revision = "0023"

# As in kita.children; copied, since a migration must not change with the code.
_SYMBOLS = (
    "apple",
    "cloud",
    "drop",
    "fish",
    "flower",
    "heart",
    "house",
    "kite",
    "leaf",
    "moon",
    "star",
    "sun",
    "boat",
    "tree",
    "car",
    "bell",
    "ball",
    "bird",
    "butterfly",
    "snail",
    "mushroom",
    "umbrella",
    "rainbow",
    "key",
    "drum",
    "train",
    "cherry",
    "carrot",
    "cat",
    "shell",
)


def upgrade() -> None:
    op.add_column("children", sa.Column("symbol", sa.String(20)))
    children = sa.table(
        "children",
        sa.column("id", sa.Integer),
        sa.column("first_name", sa.String),
        sa.column("last_name", sa.String),
        sa.column("symbol", sa.String),
        sa.column("archived_at", sa.DateTime),
    )
    child_groups = sa.table(
        "child_groups", sa.column("child_id", sa.Integer), sa.column("group_id", sa.Integer)
    )
    connection = op.get_bind()
    rows = connection.execute(
        sa.select(children.c.id, child_groups.c.group_id)
        .select_from(children.outerjoin(child_groups, child_groups.c.child_id == children.c.id))
        .order_by(
            children.c.archived_at.is_not(None),
            children.c.first_name,
            children.c.last_name,
            children.c.id,
        )
    ).all()
    taken: dict[int | None, int] = {}
    for child_id, group_id in rows:
        position = taken.get(group_id, 0)
        taken[group_id] = position + 1
        connection.execute(
            sa.update(children)
            .where(children.c.id == child_id)
            .values(symbol=_SYMBOLS[position % len(_SYMBOLS)])
        )
    op.alter_column("children", "symbol", nullable=False)
    op.create_check_constraint(op.f("ck_children_symbol"), "children", f"symbol IN {_SYMBOLS}")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_children_symbol"), "children", type_="check")
    op.drop_column("children", "symbol")
