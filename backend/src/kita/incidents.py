"""Incidents: accidents and other incidents involving a Child, logged by any Staff member as a
reliable record: once saved, nobody changes or deletes one. Admins review the log and add
Follow-ups. What happened, who was informed and the Follow-ups may describe injuries, so are
stored encrypted."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import (
    Column,
    Connection,
    Date,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    Row,
    Table,
    Text,
    Time,
    insert,
    select,
    update,
)

from kita.children import ChildNotFound, ChildSummary, TooLong, children
from kita.clock import Clock, today
from kita.db import metadata, transaction
from kita.encryption import FieldCipher
from kita.groups import child_groups
from kita.identity import users

_MAX_DESCRIPTION_LENGTH = 4000
_MAX_INFORMED_LENGTH = 500
_MAX_NOTE_LENGTH = 2000

incidents = Table(
    "incidents",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "child_id",
        Integer,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("happened_on", Date, nullable=False),
    # None when not known.
    Column("happened_at", Time),
    # Encrypted (see FieldCipher), bound to the row.
    Column("description", Text, nullable=False),
    Column("informed", Text, nullable=False),
    # None once the Staff account is gone.
    Column("reported_by", Integer, ForeignKey("users.id", ondelete="SET NULL")),
    Column("reported_at", DateTime(timezone=True), nullable=False),
)

incident_follow_ups = Table(
    "incident_follow_ups",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "incident_id",
        Integer,
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    # Encrypted (see FieldCipher), bound to the row.
    Column("note", Text, nullable=False),
    Column("author", Integer, ForeignKey("users.id", ondelete="SET NULL")),
    Column("written_at", DateTime(timezone=True), nullable=False),
)


@dataclass(frozen=True)
class IncidentDetails:
    """What a Staff member reports: when, what happened, and who was informed."""

    happened_on: date
    happened_at: time | None
    description: str
    informed: str


@dataclass(frozen=True)
class FollowUp:
    id: int
    note: str
    # The Admin's email address; None once their account is gone.
    author: str | None
    at: datetime


@dataclass(frozen=True)
class Incident(IncidentDetails):
    id: int
    child: ChildSummary
    reported_by: str | None
    reported_at: datetime
    follow_ups: tuple[FollowUp, ...]


@dataclass(frozen=True)
class IncidentFilter:
    """Which Incidents to list; None matches every one."""

    child_id: int | None = None
    group_id: int | None = None
    since: date | None = None
    until: date | None = None
    # Only those this Staff member reported.
    reported_by: str | None = None


class IncidentNotFound(Exception):
    """There is no Incident with this ID."""


class DescriptionRequired(Exception):
    """An Incident needs a description of what happened."""


class InformedRequired(Exception):
    """An Incident needs to say who was informed."""


class NoteRequired(Exception):
    """A Follow-up needs a note."""


class HappenedInFuture(Exception):
    """An Incident cannot have happened after today."""


def _incident_field(name: str, incident_id: int) -> str:
    # Bound to the row, so a value copied to another Incident does not read back there.
    return f"incidents.{name}.{incident_id}"


def _follow_up_field(follow_up_id: int) -> str:
    return f"incident_follow_ups.note.{follow_up_id}"


@dataclass(frozen=True)
class FollowedUp:
    """A Follow-up just added, and the Child whose Incident it is (by ID), for the audit log."""

    follow_up: FollowUp
    child_id: int


def _account_id(connection: Connection, email: str) -> int | None:
    found: int | None = connection.scalar(select(users.c.id).where(users.c.email == email))
    return found


class Incidents:
    def __init__(self, engine: Engine, clock: Clock, cipher: FieldCipher) -> None:
        self._engine = engine
        self._clock = clock
        self._cipher = cipher

    def report(self, child_id: int, details: IncidentDetails, reporter: str) -> Incident:
        """Logs an Incident of the Child, reported by the Staff member with this email address."""
        description = details.description.strip()
        informed = details.informed.strip()
        if not description:
            raise DescriptionRequired
        if not informed:
            raise InformedRequired
        if len(description) > _MAX_DESCRIPTION_LENGTH or len(informed) > _MAX_INFORMED_LENGTH:
            raise TooLong
        if details.happened_on > today(self._clock):
            raise HappenedInFuture
        with transaction(self._engine) as connection:
            if connection.scalar(select(children.c.id).where(children.c.id == child_id)) is None:
                raise ChildNotFound
            # The encrypted values are bound to the row's ID, so they follow once it exists.
            incident_id = connection.scalar(
                insert(incidents)
                .values(
                    child_id=child_id,
                    happened_on=details.happened_on,
                    happened_at=details.happened_at,
                    description="",
                    informed="",
                    reported_by=_account_id(connection, reporter),
                    reported_at=self._clock.now(),
                )
                .returning(incidents.c.id)
            )
            assert incident_id is not None
            connection.execute(
                update(incidents)
                .where(incidents.c.id == incident_id)
                .values(
                    description=self._encrypt("description", description, incident_id),
                    informed=self._encrypt("informed", informed, incident_id),
                )
            )
            return self._loaded(connection, [incident_id])[0]

    def add_follow_up(self, incident_id: int, note: str, author: str) -> FollowedUp:
        """Adds an Admin's Follow-up to the Incident."""
        note = note.strip()
        if not note:
            raise NoteRequired
        if len(note) > _MAX_NOTE_LENGTH:
            raise TooLong
        now = self._clock.now()
        with transaction(self._engine) as connection:
            child_id = connection.scalar(
                select(incidents.c.child_id).where(incidents.c.id == incident_id)
            )
            if child_id is None:
                raise IncidentNotFound
            follow_up_id = connection.scalar(
                insert(incident_follow_ups)
                .values(
                    incident_id=incident_id,
                    note="",
                    author=_account_id(connection, author),
                    written_at=now,
                )
                .returning(incident_follow_ups.c.id)
            )
            assert follow_up_id is not None
            connection.execute(
                update(incident_follow_ups)
                .where(incident_follow_ups.c.id == follow_up_id)
                .values(note=self._cipher.encrypt(note, _follow_up_field(follow_up_id)))
            )
        return FollowedUp(FollowUp(follow_up_id, note, author, now), child_id)

    def log(self, matching: IncidentFilter) -> list[Incident]:
        """The Incidents matching, newest first."""
        query = select(incidents.c.id).order_by(
            incidents.c.happened_on.desc(), incidents.c.reported_at.desc(), incidents.c.id.desc()
        )
        if matching.child_id is not None:
            query = query.where(incidents.c.child_id == matching.child_id)
        if matching.group_id is not None:
            query = query.join(child_groups, child_groups.c.child_id == incidents.c.child_id).where(
                child_groups.c.group_id == matching.group_id
            )
        if matching.since is not None:
            query = query.where(incidents.c.happened_on >= matching.since)
        if matching.until is not None:
            query = query.where(incidents.c.happened_on <= matching.until)
        with transaction(self._engine) as connection:
            if matching.reported_by is not None:
                reporter = _account_id(connection, matching.reported_by)
                if reporter is None:
                    # No such account reported anything; never match those whose reporter is gone.
                    return []
                query = query.where(incidents.c.reported_by == reporter)
            ids = list(connection.scalars(query))
            return self._loaded(connection, ids)

    def _loaded(self, connection: Connection, ids: Sequence[int]) -> list[Incident]:
        """These Incidents, in this order, with their Children and Follow-ups."""
        if not ids:
            return []
        reporters = users.alias("reporters")
        rows = connection.execute(
            select(
                incidents,
                children.c.first_name,
                children.c.last_name,
                reporters.c.email.label("reporter_email"),
            )
            .join(children, children.c.id == incidents.c.child_id)
            .outerjoin(reporters, reporters.c.id == incidents.c.reported_by)
            .where(incidents.c.id.in_(ids))
        ).all()
        follow_up_rows = connection.execute(
            select(incident_follow_ups, users.c.email.label("author_email"))
            .outerjoin(users, users.c.id == incident_follow_ups.c.author)
            .where(incident_follow_ups.c.incident_id.in_(ids))
            .order_by(incident_follow_ups.c.id)
        ).all()
        follow_ups: dict[int, list[FollowUp]] = {}
        for row in follow_up_rows:
            follow_ups.setdefault(row.incident_id, []).append(self._to_follow_up(row))
        by_id = {row.id: self._to_incident(row, follow_ups.get(row.id, [])) for row in rows}
        return [by_id[incident_id] for incident_id in ids]

    def _to_incident(self, row: Row[Any], follow_ups: list[FollowUp]) -> Incident:
        return Incident(
            happened_on=row.happened_on,
            happened_at=row.happened_at,
            description=self._decrypt("description", row.description, row.id),
            informed=self._decrypt("informed", row.informed, row.id),
            id=row.id,
            child=ChildSummary(row.child_id, row.first_name, row.last_name),
            reported_by=row.reporter_email,
            reported_at=row.reported_at,
            follow_ups=tuple(follow_ups),
        )

    def _to_follow_up(self, row: Row[Any]) -> FollowUp:
        note = self._cipher.decrypt(row.note, _follow_up_field(row.id))
        return FollowUp(row.id, note, row.author_email, row.written_at)

    def _encrypt(self, name: str, value: str, incident_id: int) -> str:
        return self._cipher.encrypt(value, _incident_field(name, incident_id))

    def _decrypt(self, name: str, stored: str, incident_id: int) -> str:
        return self._cipher.decrypt(stored, _incident_field(name, incident_id))
