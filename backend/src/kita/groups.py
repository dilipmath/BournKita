"""Groups: the Children cared for together, and the Staff members who work in each."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal, get_args

from sqlalchemy import (
    CheckConstraint,
    Column,
    Connection,
    Engine,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    delete,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as upsert
from sqlalchemy.exc import IntegrityError

from kita.children import CURRENT, ChildNotFound, ChildSummary, NameRequired, TooLong, children
from kita.db import metadata, transaction
from kita.identity import AccountNotFound, users

# The icons a Group can have; the app draws each.
GroupIcon = Literal[
    "monkey",
    "butterfly",
    "bee",
    "ladybird",
    "frog",
    "fox",
    "bear",
    "rabbit",
    "owl",
    "hedgehog",
    "turtle",
    "fish",
    "sun",
    "flower",
    "tree",
    "star",
]
_MAX_NAME_LENGTH = 50

groups = Table(
    "groups",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(_MAX_NAME_LENGTH), nullable=False),
    Column("icon", String(20), nullable=False),
    CheckConstraint(f"icon IN {get_args(GroupIcon)}", name="icon"),
)
# Two Groups of one name would be told apart only by their icons.
Index("uq_groups_name", func.lower(groups.c.name), unique=True)

# The Group each Child is in, if any: one at most.
child_groups = Table(
    "child_groups",
    metadata,
    Column("child_id", Integer, ForeignKey("children.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "group_id",
        Integer,
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
)

# The Staff members who work in each Group.
group_staff = Table(
    "group_staff",
    metadata,
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


@dataclass(frozen=True)
class GroupDetails:
    name: str
    icon: GroupIcon


@dataclass(frozen=True)
class Group(GroupDetails):
    id: int


@dataclass(frozen=True)
class GroupForStaffMember(Group):
    # Whether the Staff member works in it.
    mine: bool


class GroupNotFound(Exception):
    """There is no Group with this ID."""


class GroupNameTaken(Exception):
    """Another Group has this name (ignoring case)."""


def _checked(details: GroupDetails) -> GroupDetails:
    name = " ".join(details.name.split())
    if not name:
        raise NameRequired
    if len(name) > _MAX_NAME_LENGTH:
        raise TooLong
    return GroupDetails(name, details.icon)


def _exists(connection: Connection, group_id: int) -> bool:
    """Whether the Group exists; it is locked against removal until the transaction ends."""
    found = connection.scalar(
        select(groups.c.id).where(groups.c.id == group_id).with_for_update(read=True)
    )
    return found is not None


class Groups:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def create(self, details: GroupDetails) -> Group:
        details = _checked(details)
        try:
            with transaction(self._engine) as connection:
                group_id = connection.scalar(
                    insert(groups)
                    .values(name=details.name, icon=details.icon)
                    .returning(groups.c.id)
                )
        except IntegrityError:
            raise GroupNameTaken from None
        assert group_id is not None
        return Group(details.name, details.icon, group_id)

    def update(self, group_id: int, details: GroupDetails) -> Group:
        details = _checked(details)
        try:
            with transaction(self._engine) as connection:
                found = connection.scalar(
                    update(groups)
                    .where(groups.c.id == group_id)
                    .values(name=details.name, icon=details.icon)
                    .returning(groups.c.id)
                )
        except IntegrityError:
            raise GroupNameTaken from None
        if found is None:
            raise GroupNotFound
        return Group(details.name, details.icon, group_id)

    def remove(self, group_id: int) -> list[int]:
        """Removes the Group; its Children and Staff members stay, in no Group. Returns the
        Children taken out of it, by ID."""
        with transaction(self._engine) as connection:
            child_ids = list(
                connection.scalars(
                    select(child_groups.c.child_id).where(child_groups.c.group_id == group_id)
                )
            )
            found = connection.scalar(
                delete(groups).where(groups.c.id == group_id).returning(groups.c.id)
            )
        if found is None:
            raise GroupNotFound
        return child_ids

    def put_child(self, child_id: int, group_id: int | None) -> bool:
        """Puts the Child in the Group (None: in none), out of any other; returns whether that
        changed anything."""
        with transaction(self._engine) as connection:
            # Locked, so two moves at once happen one after the other.
            locked = connection.scalar(
                select(children.c.id).where(children.c.id == child_id).with_for_update()
            )
            if locked is None:
                raise ChildNotFound
            if group_id is not None and not _exists(connection, group_id):
                raise GroupNotFound
            before = connection.scalar(
                select(child_groups.c.group_id).where(child_groups.c.child_id == child_id)
            )
            if group_id is None:
                connection.execute(delete(child_groups).where(child_groups.c.child_id == child_id))
            else:
                connection.execute(
                    upsert(child_groups)
                    .values(child_id=child_id, group_id=group_id)
                    .on_conflict_do_update(
                        index_elements=[child_groups.c.child_id], set_={"group_id": group_id}
                    )
                )
        return before != group_id

    def of_child(self, child_id: int) -> Group | None:
        with transaction(self._engine) as connection:
            row = connection.execute(
                select(groups)
                .join(child_groups, child_groups.c.group_id == groups.c.id)
                .where(child_groups.c.child_id == child_id)
            ).one_or_none()
        return None if row is None else Group(row.name, row.icon, row.id)

    def children_of(self, group_id: int) -> list[ChildSummary]:
        """The Group's Children, by first name."""
        with transaction(self._engine) as connection:
            if not _exists(connection, group_id):
                raise GroupNotFound
            rows = connection.execute(
                select(children.c.id, children.c.first_name, children.c.last_name)
                .join(child_groups, child_groups.c.child_id == children.c.id)
                .where(child_groups.c.group_id == group_id, CURRENT)
                .order_by(children.c.first_name, children.c.last_name, children.c.id)
            ).all()
        return [ChildSummary(row.id, row.first_name, row.last_name) for row in rows]

    def set_staff_groups(self, account_id: int, group_ids: Sequence[int]) -> list[int]:
        """Says which Groups the Staff member works in, instead of any before; returns them by
        ID."""
        wanted = set(group_ids)
        with transaction(self._engine) as connection:
            locked = connection.scalar(
                select(users.c.id).where(users.c.id == account_id).with_for_update()
            )
            if locked is None:
                raise AccountNotFound
            found = set(
                connection.scalars(
                    select(groups.c.id).where(groups.c.id.in_(wanted)).with_for_update(read=True)
                )
            )
            if found != wanted:
                raise GroupNotFound
            connection.execute(delete(group_staff).where(group_staff.c.user_id == account_id))
            if wanted:
                connection.execute(
                    insert(group_staff),
                    [{"group_id": group_id, "user_id": account_id} for group_id in wanted],
                )
        return sorted(wanted)

    def of_staff_member(self, account_id: int) -> list[int]:
        """The Groups the Staff member works in, by ID."""
        with transaction(self._engine) as connection:
            return list(
                connection.scalars(
                    select(group_staff.c.group_id)
                    .where(group_staff.c.user_id == account_id)
                    .order_by(group_staff.c.group_id)
                )
            )

    def group(self, group_id: int) -> Group:
        with transaction(self._engine) as connection:
            row = connection.execute(select(groups).where(groups.c.id == group_id)).one_or_none()
        if row is None:
            raise GroupNotFound
        return Group(row.name, row.icon, row.id)

    def all(self) -> list[Group]:
        """All Groups, by name."""
        with transaction(self._engine) as connection:
            rows = connection.execute(select(groups).order_by(func.lower(groups.c.name))).all()
        return [Group(row.name, row.icon, row.id) for row in rows]

    def staff_groups(self) -> dict[int, list[int]]:
        """The Groups each Staff member works in, by account ID; those in none are left out."""
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(group_staff.c.user_id, group_staff.c.group_id).order_by(
                    group_staff.c.group_id
                )
            ).all()
        by_account: dict[int, list[int]] = {}
        for account_id, group_id in rows:
            by_account.setdefault(account_id, []).append(group_id)
        return by_account

    def for_staff_member(self, email: str) -> list[GroupForStaffMember]:
        """All Groups by name, saying which the Staff member works in."""
        mine = (
            select(group_staff.c.group_id)
            .join(users, users.c.id == group_staff.c.user_id)
            .where(users.c.email == email)
        )
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(groups, groups.c.id.in_(mine).label("mine")).order_by(
                    func.lower(groups.c.name)
                )
            ).all()
        return [GroupForStaffMember(row.name, row.icon, row.id, row.mine) for row in rows]
