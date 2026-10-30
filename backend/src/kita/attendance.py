"""Attendance: which Children are at the Kita today. Staff check a Child in when they arrive and
out when they leave, once a day each, and record Absences (sick, the family's holiday) for days
they will not come. Days are the Kita's (Europe/Berlin). The reason of an Absence is health data
("sick"), so stored encrypted."""

from collections.abc import Collection
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Literal, cast

from sqlalchemy import (
    Column,
    ColumnElement,
    Connection,
    Date,
    DateTime,
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

from kita.children import ChildNotFound, children
from kita.clock import KITA_TIME_ZONE, Clock, today
from kita.db import metadata, transaction
from kita.encryption import FieldCipher

# "holiday": the family's own time off, not one of the region's Holidays.
AbsenceReason = Literal["sick", "holiday", "other"]

# One row per Child per day they were checked in.
attendance = Table(
    "attendance",
    metadata,
    Column("child_id", Integer, ForeignKey("children.id", ondelete="CASCADE"), primary_key=True),
    Column("on", Date, primary_key=True),
    Column("checked_in_at", DateTime(timezone=True), nullable=False),
    Column("checked_out_at", DateTime(timezone=True)),
)

absences = Table(
    "absences",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "child_id",
        Integer,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    # The first and last day, both included.
    Column("starts_on", Date, nullable=False),
    Column("ends_on", Date, nullable=False),
    # Encrypted (see FieldCipher), bound to the row.
    Column("reason", Text, nullable=False),
)


@dataclass(frozen=True)
class AttendanceDay:
    """A Child's Attendance on one day: checked in at, and out at (None while still there)."""

    checked_in_at: datetime
    checked_out_at: datetime | None


@dataclass(frozen=True)
class Absence:
    id: int
    starts_on: date
    ends_on: date
    reason: AbsenceReason


class NotCheckedIn(Exception):
    """The Child has not been checked in today (or that was undone)."""


class AlreadyCheckedIn(Exception):
    """The Child has already been checked in today."""


class AlreadyCheckedOut(Exception):
    """The Child has already been checked out today."""


class AbsentToday(Exception):
    """The Child is recorded as absent today: remove the Absence first."""


class PresentThen(Exception):
    """The Child was checked in on one of the Absence's days, so was not absent then."""


class OverlappingAbsence(Exception):
    """The Child already has an Absence on one of these days."""


class AbsenceEndsBeforeStart(Exception):
    """An Absence ends before it starts."""


class AbsenceNotFound(Exception):
    """The Child has no Absence with this ID."""


def _reason_field(absence_id: int) -> str:
    # Bound to the row, so a reason copied to another Absence does not read back there.
    return f"absences.reason.{absence_id}"


def _absent_between(first: date, last: date) -> ColumnElement[bool]:
    """Absences touching `first` to `last` (both included)."""
    return (absences.c.starts_on <= last) & (absences.c.ends_on >= first)


def _attendance_of(child_id: int, on: date) -> ColumnElement[bool]:
    return (attendance.c.child_id == child_id) & (attendance.c.on == on)


def _lock_child(connection: Connection, child_id: int) -> None:
    """Raises ChildNotFound; two steps for one Child at once happen one after the other."""
    found = connection.scalar(
        select(children.c.id).where(children.c.id == child_id).with_for_update()
    )
    if found is None:
        raise ChildNotFound


def _attendance_row(connection: Connection, child_id: int, on: date) -> Row[Any] | None:
    row: Row[Any] | None = connection.execute(
        select(attendance).where(_attendance_of(child_id, on))
    ).one_or_none()
    return row


class Attendance:
    def __init__(self, engine: Engine, clock: Clock, cipher: FieldCipher) -> None:
        self._engine = engine
        self._clock = clock
        self._cipher = cipher

    def today(self) -> date:
        """Today at the Kita."""
        return today(self._clock)

    def _now(self) -> tuple[datetime, date]:
        """Now, and the Kita's day of it: read once, so the two never disagree at midnight."""
        now = self._clock.now()
        return now, now.astimezone(KITA_TIME_ZONE).date()

    def check_in(self, child_id: int) -> None:
        now, on = self._now()
        with transaction(self._engine) as connection:
            _lock_child(connection, child_id)
            absent = connection.scalar(
                select(absences.c.id).where(
                    absences.c.child_id == child_id, _absent_between(on, on)
                )
            )
            if absent is not None:
                raise AbsentToday
            if _attendance_row(connection, child_id, on) is not None:
                raise AlreadyCheckedIn
            connection.execute(
                insert(attendance).values(child_id=child_id, on=on, checked_in_at=now)
            )

    def check_out(self, child_id: int) -> None:
        now, on = self._now()
        with transaction(self._engine) as connection:
            _lock_child(connection, child_id)
            row = _attendance_row(connection, child_id, on)
            if row is None:
                raise NotCheckedIn
            if row.checked_out_at is not None:
                raise AlreadyCheckedOut
            connection.execute(
                update(attendance).where(_attendance_of(child_id, on)).values(checked_out_at=now)
            )

    def undo(self, child_id: int) -> None:
        """Undoes today's last step: a check-out, else the check-in."""
        _, on = self._now()
        with transaction(self._engine) as connection:
            _lock_child(connection, child_id)
            row = _attendance_row(connection, child_id, on)
            if row is None:
                raise NotCheckedIn
            if row.checked_out_at is not None:
                connection.execute(
                    update(attendance)
                    .where(_attendance_of(child_id, on))
                    .values(checked_out_at=None)
                )
            else:
                connection.execute(delete(attendance).where(_attendance_of(child_id, on)))

    def add_absence(
        self, child_id: int, starts_on: date, ends_on: date, reason: AbsenceReason
    ) -> Absence:
        """Records that the Child will not come (or did not come) from `starts_on` to
        `ends_on`."""
        if ends_on < starts_on:
            raise AbsenceEndsBeforeStart
        with transaction(self._engine) as connection:
            _lock_child(connection, child_id)
            overlapping = connection.scalar(
                select(absences.c.id).where(
                    absences.c.child_id == child_id, _absent_between(starts_on, ends_on)
                )
            )
            if overlapping is not None:
                raise OverlappingAbsence
            was_here = connection.scalar(
                select(attendance.c.on).where(
                    attendance.c.child_id == child_id,
                    attendance.c.on >= starts_on,
                    attendance.c.on <= ends_on,
                )
            )
            if was_here is not None:
                raise PresentThen
            absence_id = connection.scalar(
                insert(absences)
                .values(child_id=child_id, starts_on=starts_on, ends_on=ends_on, reason="")
                .returning(absences.c.id)
            )
            assert absence_id is not None
            connection.execute(
                update(absences)
                .where(absences.c.id == absence_id)
                .values(reason=self._cipher.encrypt(reason, _reason_field(absence_id)))
            )
        return Absence(absence_id, starts_on, ends_on, reason)

    def remove_absence(self, child_id: int, absence_id: int) -> None:
        with transaction(self._engine) as connection:
            _lock_child(connection, child_id)
            found = connection.scalar(
                delete(absences)
                .where(absences.c.id == absence_id, absences.c.child_id == child_id)
                .returning(absences.c.id)
            )
        if found is None:
            raise AbsenceNotFound

    def days_on(self, on: date, child_ids: Collection[int]) -> dict[int, AttendanceDay]:
        """The Children of these who were checked in on that day, with their Attendance."""
        if not child_ids:
            return {}
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(attendance).where(
                    attendance.c.on == on, attendance.c.child_id.in_(child_ids)
                )
            ).all()
        return {row.child_id: AttendanceDay(row.checked_in_at, row.checked_out_at) for row in rows}

    def absences_on(self, on: date, child_ids: Collection[int]) -> dict[int, Absence]:
        """The Children of these who are absent on that day, with their Absence."""
        if not child_ids:
            return {}
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(absences).where(absences.c.child_id.in_(child_ids), _absent_between(on, on))
            ).all()
        return {row.child_id: self._to_absence(row) for row in rows}

    def held_days(self, child_id: int) -> dict[date, AttendanceDay]:
        """Every day the Child was checked in, oldest first; for a data-subject request."""
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(attendance)
                .where(attendance.c.child_id == child_id)
                .order_by(attendance.c.on)
            ).all()
        return {row.on: AttendanceDay(row.checked_in_at, row.checked_out_at) for row in rows}

    def held_absences(self, child_id: int) -> list[Absence]:
        """All the Child's Absences, past and coming, by start; for a data-subject request."""
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(absences)
                .where(absences.c.child_id == child_id)
                .order_by(absences.c.starts_on)
            ).all()
        return [self._to_absence(row) for row in rows]

    def coming_absences(self, child_id: int) -> list[Absence]:
        """The Child's Absences that have not ended yet, by start: today's and later ones."""
        on = today(self._clock)
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(absences)
                .where(absences.c.child_id == child_id, absences.c.ends_on >= on)
                .order_by(absences.c.starts_on)
            ).all()
        return [self._to_absence(row) for row in rows]

    def _to_absence(self, row: Row[Any]) -> Absence:
        reason = self._cipher.decrypt(row.reason, _reason_field(row.id))
        return Absence(row.id, row.starts_on, row.ends_on, cast(AbsenceReason, reason))
