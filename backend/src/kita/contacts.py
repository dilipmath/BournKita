"""Emergency contacts and Pick-up persons (together: a Child's contacts), each Child's own,
apart from their Parents. Phone numbers and notes are stored encrypted."""

from dataclasses import asdict, dataclass, fields
from typing import Any, Literal, get_args

from sqlalchemy import (
    CheckConstraint,
    Column,
    Connection,
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

from kita.children import ChildNotFound, NameRequired, TooLong, children
from kita.db import metadata, transaction
from kita.encryption import FieldCipher

# emergency: whom to call when something happens. pickUp: who else may take the Child home.
ContactKind = Literal["emergency", "pickUp"]

child_contacts = Table(
    "child_contacts",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "child_id",
        Integer,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("kind", String(20), nullable=False),
    Column("name", String(200), nullable=False),
    Column("relationship", String(100), nullable=False),
    # Encrypted (see FieldCipher), bound to the row.
    Column("phone", Text, nullable=False),
    Column("note", Text, nullable=False),
    CheckConstraint(f"kind IN {get_args(ContactKind)}", name="kind"),
)

# The longest value each field takes, before encryption.
_MAX_LENGTHS = {"name": 200, "relationship": 100, "phone": 50, "note": 1000}
_ENCRYPTED = ("phone", "note")


@dataclass(frozen=True)
class ContactDetails:
    """What an Admin enters for a contact; only the name is required."""

    kind: ContactKind
    name: str
    relationship: str
    phone: str
    note: str


@dataclass(frozen=True)
class Contact(ContactDetails):
    id: int


@dataclass(frozen=True)
class ContactUpdate:
    contact: Contact
    changed: bool
    # The kind before the update, which may have moved the contact to the other list.
    previous_kind: ContactKind


class ContactNotFound(Exception):
    """The Child has no contact with this ID."""


def _checked(details: ContactDetails) -> ContactDetails:
    values: dict[str, Any] = {name: getattr(details, name).strip() for name in _MAX_LENGTHS}
    values["name"] = " ".join(values["name"].split())
    if not values["name"]:
        raise NameRequired
    if any(len(value) > _MAX_LENGTHS[name] for name, value in values.items()):
        raise TooLong
    return ContactDetails(kind=details.kind, **values)


def _field(name: str, contact_id: int) -> str:
    # Bound to the row, so a value moved to another contact does not read back there.
    return f"child_contacts.{name}.{contact_id}"


class Contacts:
    def __init__(self, engine: Engine, cipher: FieldCipher) -> None:
        self._engine = engine
        self._cipher = cipher

    def of_child(self, child_id: int) -> list[Contact]:
        """The Child's contacts, in the order they were added."""
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(child_contacts)
                .where(child_contacts.c.child_id == child_id)
                .order_by(child_contacts.c.id)
            ).all()
        return [self._to_contact(row) for row in rows]

    def add(self, child_id: int, details: ContactDetails) -> Contact:
        details = _checked(details)
        with transaction(self._engine) as connection:
            if connection.scalar(select(children.c.id).where(children.c.id == child_id)) is None:
                raise ChildNotFound
            # The encrypted values are bound to the row's ID, so they follow once it exists.
            contact_id = connection.scalar(
                insert(child_contacts)
                .values(
                    child_id=child_id,
                    kind=details.kind,
                    name=details.name,
                    relationship=details.relationship,
                    **dict.fromkeys(_ENCRYPTED, ""),
                )
                .returning(child_contacts.c.id)
            )
            assert contact_id is not None
            connection.execute(
                update(child_contacts)
                .where(child_contacts.c.id == contact_id)
                .values(**self._encrypted(details, contact_id))
            )
        return Contact(id=contact_id, **asdict(details))

    def update(self, child_id: int, contact_id: int, details: ContactDetails) -> ContactUpdate:
        """Changes the contact, which may move it to the other list."""
        details = _checked(details)
        with transaction(self._engine) as connection:
            before = self._contact(connection, child_id, contact_id)
            connection.execute(
                update(child_contacts)
                .where(child_contacts.c.id == contact_id)
                .values(
                    kind=details.kind,
                    name=details.name,
                    relationship=details.relationship,
                    **self._encrypted(details, contact_id),
                )
            )
        after = Contact(id=contact_id, **asdict(details))
        return ContactUpdate(after, after != before, before.kind)

    def remove(self, child_id: int, contact_id: int) -> ContactKind:
        """Removes the contact; returns which kind it was."""
        with transaction(self._engine) as connection:
            kind = connection.scalar(
                delete(child_contacts)
                .where(child_contacts.c.id == contact_id, child_contacts.c.child_id == child_id)
                .returning(child_contacts.c.kind)
            )
        if kind is None:
            raise ContactNotFound
        result: ContactKind = kind
        return result

    def _encrypted(self, details: ContactDetails, contact_id: int) -> dict[str, str]:
        return {
            name: self._cipher.encrypt(getattr(details, name), _field(name, contact_id))
            for name in _ENCRYPTED
        }

    def _to_contact(self, row: Row[*tuple[Any, ...]]) -> Contact:
        values = {field.name: getattr(row, field.name) for field in fields(Contact)}
        for name in _ENCRYPTED:
            values[name] = self._cipher.decrypt(values[name], _field(name, row.id))
        return Contact(**values)

    def _contact(self, connection: Connection, child_id: int, contact_id: int) -> Contact:
        row = connection.execute(
            select(child_contacts)
            .where(child_contacts.c.id == contact_id, child_contacts.c.child_id == child_id)
            .with_for_update()
        ).one_or_none()
        if row is None:
            raise ContactNotFound
        return self._to_contact(row)
