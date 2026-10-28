"""Alerts: a Child's allergies and medical conditions, which every Staff member must know about.
Health data, so all of each Alert (its kind too) is stored encrypted."""

from collections.abc import Collection
from dataclasses import asdict, dataclass
from typing import Any, Literal, cast

from sqlalchemy import (
    Column,
    Engine,
    ForeignKey,
    Integer,
    Row,
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

AlertKind = Literal["allergy", "medical"]

child_alerts = Table(
    "child_alerts",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "child_id",
        Integer,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    # Encrypted (see FieldCipher), bound to the row. The kind is checked by the API, since the
    # database cannot read it.
    Column("kind", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("note", Text, nullable=False),
)

# The longest value each field takes, before encryption.
_MAX_LENGTHS = {"name": 200, "note": 1000}
_ENCRYPTED = ("kind", "name", "note")


@dataclass(frozen=True)
class AlertDetails:
    """What an Admin enters for an Alert: what it is about (e.g. "Peanuts") and, optionally,
    what to do."""

    kind: AlertKind
    name: str
    note: str


@dataclass(frozen=True)
class Alert(AlertDetails):
    id: int


@dataclass(frozen=True)
class AlertUpdate:
    alert: Alert
    changed: bool


class AlertNotFound(Exception):
    """The Child has no Alert with this ID."""


def _checked(details: AlertDetails) -> AlertDetails:
    name = " ".join(details.name.split())
    note = details.note.strip()
    if not name:
        raise NameRequired
    if len(name) > _MAX_LENGTHS["name"] or len(note) > _MAX_LENGTHS["note"]:
        raise TooLong
    return AlertDetails(details.kind, name, note)


def _field(name: str, alert_id: int) -> str:
    # Bound to the row, so a value moved to another Alert does not read back there.
    return f"child_alerts.{name}.{alert_id}"


class Alerts:
    def __init__(self, engine: Engine, cipher: FieldCipher) -> None:
        self._engine = engine
        self._cipher = cipher

    def of_child(self, child_id: int) -> list[Alert]:
        """The Child's Alerts, in the order they were added."""
        return self.of_children([child_id]).get(child_id, [])

    def of_children(self, child_ids: Collection[int]) -> dict[int, list[Alert]]:
        """The Alerts of each of these Children that has any, in the order they were added."""
        if not child_ids:
            return {}
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(child_alerts)
                .where(child_alerts.c.child_id.in_(child_ids))
                .order_by(child_alerts.c.id)
            ).all()
        by_child: dict[int, list[Alert]] = {}
        for row in rows:
            by_child.setdefault(row.child_id, []).append(self._to_alert(row))
        return by_child

    def add(self, child_id: int, details: AlertDetails) -> Alert:
        details = _checked(details)
        with transaction(self._engine) as connection:
            if connection.scalar(select(children.c.id).where(children.c.id == child_id)) is None:
                raise ChildNotFound
            # The encrypted values are bound to the row's ID, so they follow once it exists.
            alert_id = connection.scalar(
                insert(child_alerts)
                .values(child_id=child_id, **dict.fromkeys(_ENCRYPTED, ""))
                .returning(child_alerts.c.id)
            )
            assert alert_id is not None
            connection.execute(
                update(child_alerts)
                .where(child_alerts.c.id == alert_id)
                .values(**self._encrypted(details, alert_id))
            )
        return Alert(id=alert_id, **asdict(details))

    def update(self, child_id: int, alert_id: int, details: AlertDetails) -> AlertUpdate:
        details = _checked(details)
        with transaction(self._engine) as connection:
            row = connection.execute(
                select(child_alerts)
                .where(child_alerts.c.id == alert_id, child_alerts.c.child_id == child_id)
                .with_for_update()
            ).one_or_none()
            if row is None:
                raise AlertNotFound
            before = self._to_alert(row)
            connection.execute(
                update(child_alerts)
                .where(child_alerts.c.id == alert_id)
                .values(**self._encrypted(details, alert_id))
            )
        after = Alert(id=alert_id, **asdict(details))
        return AlertUpdate(after, after != before)

    def remove(self, child_id: int, alert_id: int) -> None:
        with transaction(self._engine) as connection:
            removed = connection.scalar(
                delete(child_alerts)
                .where(child_alerts.c.id == alert_id, child_alerts.c.child_id == child_id)
                .returning(child_alerts.c.id)
            )
        if removed is None:
            raise AlertNotFound

    def _encrypted(self, details: AlertDetails, alert_id: int) -> dict[str, str]:
        return {
            name: self._cipher.encrypt(getattr(details, name), _field(name, alert_id))
            for name in _ENCRYPTED
        }

    def _to_alert(self, row: Row[*tuple[Any, ...]]) -> Alert:
        values = {
            name: self._cipher.decrypt(getattr(row, name), _field(name, row.id))
            for name in _ENCRYPTED
        }
        return Alert(
            id=row.id,
            kind=cast(AlertKind, values["kind"]),
            name=values["name"],
            note=values["note"],
        )
