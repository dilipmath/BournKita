"""Parents: contact persons recorded for one or more Children, so Siblings share them. Not
logins. Addresses and contact details are stored encrypted."""

from dataclasses import asdict, dataclass, fields
from typing import Any

from sqlalchemy import (
    Column,
    Connection,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    Row,
    String,
    Table,
    Text,
    delete,
    insert,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert

from kita.children import ChildNotFound, ChildSummary, NameRequired, TooLong, children
from kita.clock import Clock
from kita.db import metadata, transaction
from kita.encryption import FieldCipher

parents = Table(
    "parents",
    metadata,
    Column("id", Integer, primary_key=True),
    # Names stay plain, so Admins can search for a Parent when linking Siblings.
    Column("first_name", String(100), nullable=False),
    Column("last_name", String(100), nullable=False),
    # Encrypted (see FieldCipher), so their stored length says nothing about the value's.
    Column("address", Text, nullable=False),
    Column("phone", Text, nullable=False),
    Column("email", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

child_parents = Table(
    "child_parents",
    metadata,
    Column("child_id", Integer, ForeignKey("children.id", ondelete="CASCADE"), primary_key=True),
    Column("parent_id", Integer, ForeignKey("parents.id", ondelete="CASCADE"), primary_key=True),
)

# The longest value each field takes, before encryption.
_MAX_LENGTHS = {"first_name": 100, "last_name": 100, "address": 500, "phone": 50, "email": 320}
_ENCRYPTED = ("address", "phone", "email")


@dataclass(frozen=True)
class ParentDetails:
    """What an Admin enters for a Parent; only the names are required."""

    first_name: str
    last_name: str
    address: str
    phone: str
    email: str


@dataclass(frozen=True)
class Parent(ParentDetails):
    id: int


@dataclass(frozen=True)
class ParentWithChildren:
    parent: Parent
    # By first name.
    children: list[ChildSummary]


@dataclass(frozen=True)
class ParentUpdate:
    parent: Parent
    # The fields that changed, by their names in ParentDetails.
    changed_fields: list[str]
    # The Parent's Children, whose data this changes too.
    child_ids: list[int]


@dataclass(frozen=True)
class ParentSummary:
    """A Parent as a list for linking shows them: the name only."""

    id: int
    first_name: str
    last_name: str


class ParentNotFound(Exception):
    """No Parent has this ID."""


def _checked(details: ParentDetails) -> ParentDetails:
    """The details with whitespace trimmed as for Child profiles; raises NameRequired or
    TooLong."""
    values = {field.name: getattr(details, field.name).strip() for field in fields(details)}
    for name in ("first_name", "last_name"):
        values[name] = " ".join(values[name].split())
    if not values["first_name"] or not values["last_name"]:
        raise NameRequired
    if any(len(value) > _MAX_LENGTHS[name] for name, value in values.items()):
        raise TooLong
    return ParentDetails(**values)


def _field(name: str, parent_id: int) -> str:
    # Bound to the row as well as the column, so a value moved to another Parent's record (by
    # someone with database access) does not read back there.
    return f"parents.{name}.{parent_id}"


class Parents:
    def __init__(self, engine: Engine, clock: Clock, cipher: FieldCipher) -> None:
        self._engine = engine
        self._clock = clock
        self._cipher = cipher

    def create(self, details: ParentDetails) -> Parent:
        details = _checked(details)
        now = self._clock.now()
        with transaction(self._engine) as connection:
            # The encrypted values are bound to the row's ID, so they follow once it exists. Never
            # the plain values meanwhile: they would reach the database's log on disk.
            parent_id = connection.scalar(
                insert(parents)
                .values(
                    first_name=details.first_name,
                    last_name=details.last_name,
                    **dict.fromkeys(_ENCRYPTED, ""),
                    created_at=now,
                    updated_at=now,
                )
                .returning(parents.c.id)
            )
            assert parent_id is not None
            connection.execute(
                update(parents)
                .where(parents.c.id == parent_id)
                .values(**self._stored(details, parent_id))
            )
        return Parent(id=parent_id, **asdict(details))

    def update(self, parent_id: int, details: ParentDetails) -> ParentUpdate:
        """Changes the Parent's details."""
        details = _checked(details)
        with transaction(self._engine) as connection:
            before = self._parent(connection, parent_id, for_update=True)
            changed = [
                name for name, value in asdict(details).items() if getattr(before, name) != value
            ]
            connection.execute(
                update(parents)
                .where(parents.c.id == parent_id)
                .values(**self._stored(details, parent_id), updated_at=self._clock.now())
            )
            child_ids = [child.id for child in self._children(connection, parent_id)]
        return ParentUpdate(Parent(id=parent_id, **asdict(details)), changed, child_ids)

    def parent(self, parent_id: int) -> ParentWithChildren:
        with transaction(self._engine) as connection:
            return ParentWithChildren(
                self._parent(connection, parent_id), self._children(connection, parent_id)
            )

    def of_child(self, child_id: int) -> list[Parent]:
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(parents)
                .join(child_parents, child_parents.c.parent_id == parents.c.id)
                .where(child_parents.c.child_id == child_id)
                .order_by(parents.c.last_name, parents.c.first_name, parents.c.id)
            ).all()
        return [self._to_parent(row) for row in rows]

    def summaries(self, search: str = "") -> list[ParentSummary]:
        """All Parents by last name; `search` keeps those whose name contains it."""
        query = select(parents.c.id, parents.c.first_name, parents.c.last_name).order_by(
            parents.c.last_name, parents.c.first_name, parents.c.id
        )
        search = " ".join(search.split())
        if search:
            first_last = parents.c.first_name + " " + parents.c.last_name
            last_first = parents.c.last_name + " " + parents.c.first_name
            query = query.where(
                first_last.icontains(search, autoescape=True)
                | last_first.icontains(search, autoescape=True)
            )
        with transaction(self._engine) as connection:
            rows = connection.execute(query).all()
        return [ParentSummary(**row._asdict()) for row in rows]

    def link(self, child_id: int, parent_id: int) -> bool:
        """Links the Parent to the Child; False if they already were."""
        with transaction(self._engine) as connection:
            self._ensure_exists(connection, child_id, parent_id)
            linked = connection.scalar(
                pg_insert(child_parents)
                .values(child_id=child_id, parent_id=parent_id)
                .on_conflict_do_nothing()
                .returning(child_parents.c.child_id)
            )
        return linked is not None

    def unlink(self, child_id: int, parent_id: int) -> bool:
        """Removes the link; the Parent's record stays. False if there was no link."""
        with transaction(self._engine) as connection:
            self._ensure_exists(connection, child_id, parent_id)
            unlinked = connection.execute(
                delete(child_parents).where(
                    child_parents.c.child_id == child_id, child_parents.c.parent_id == parent_id
                )
            )
        return unlinked.rowcount == 1

    def _stored(self, details: ParentDetails, parent_id: int) -> dict[str, str]:
        values = asdict(details)
        for name in _ENCRYPTED:
            values[name] = self._cipher.encrypt(values[name], _field(name, parent_id))
        return values

    def _to_parent(self, row: Row[*tuple[Any, ...]]) -> Parent:
        values = {field.name: getattr(row, field.name) for field in fields(Parent)}
        for name in _ENCRYPTED:
            values[name] = self._cipher.decrypt(values[name], _field(name, row.id))
        return Parent(**values)

    def _parent(self, connection: Connection, parent_id: int, for_update: bool = False) -> Parent:
        query = select(parents).where(parents.c.id == parent_id)
        row = connection.execute(query.with_for_update() if for_update else query).one_or_none()
        if row is None:
            raise ParentNotFound
        return self._to_parent(row)

    @staticmethod
    def _children(connection: Connection, parent_id: int) -> list[ChildSummary]:
        rows = connection.execute(
            select(children.c.id, children.c.first_name, children.c.last_name)
            .join(child_parents, child_parents.c.child_id == children.c.id)
            .where(child_parents.c.parent_id == parent_id)
            .order_by(children.c.first_name, children.c.last_name, children.c.id)
        ).all()
        return [ChildSummary(**row._asdict()) for row in rows]

    @staticmethod
    def _ensure_exists(connection: Connection, child_id: int, parent_id: int) -> None:
        if connection.scalar(select(children.c.id).where(children.c.id == child_id)) is None:
            raise ChildNotFound
        if connection.scalar(select(parents.c.id).where(parents.c.id == parent_id)) is None:
            raise ParentNotFound
