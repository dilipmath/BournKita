"""Events: what is on in the Kita, for one Group or the whole Kita. An Event is all-day (on one
day or several) or timed (on one day, from a start to an end time), and may repeat every few
days, weeks, months or years. Dates and times are the Kita's (Europe/Berlin). Admins and Teachers
may add, change and remove every Event."""

import calendar
from collections.abc import Iterator
from dataclasses import dataclass, replace
from datetime import date, time, timedelta
from typing import Any, Literal, get_args

from sqlalchemy import (
    CheckConstraint,
    Column,
    Connection,
    Date,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    Row,
    String,
    Table,
    Time,
    delete,
    insert,
    or_,
    select,
    update,
)

from kita.children import NameRequired, TooLong
from kita.clock import Clock
from kita.db import metadata, transaction
from kita.groups import Group, GroupNotFound, groups

Repeat = Literal["none", "daily", "weekly", "monthly", "yearly"]

_MAX_TITLE_LENGTH = 200
_MAX_NOTE_LENGTH = 2000
_MAX_REPEAT_EVERY = 99
# How many days before an occurrence a Reminder may go out: that morning, the day before, two days
# before, a week before.
REMIND_DAYS_BEFORE = (0, 1, 2, 7)
# The longest span a Calendar asks for at once: more than a month view's six weeks, or an agenda.
MAX_SPAN_DAYS = 100

events = Table(
    "events",
    metadata,
    Column("id", Integer, primary_key=True),
    # None: for the whole Kita.
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), index=True),
    Column("title", String(_MAX_TITLE_LENGTH), nullable=False),
    Column("note", String(_MAX_NOTE_LENGTH), nullable=False),
    # The first occurrence: its first and last day, and its times if it is not all-day.
    Column("starts_on", Date, nullable=False),
    Column("ends_on", Date, nullable=False),
    Column("start_time", Time),
    Column("end_time", Time),
    Column("repeat", String(10), nullable=False),
    Column("repeat_every", Integer, nullable=False),
    # The last day an occurrence may start on; None: for ever.
    Column("repeat_until", Date),
    # Days before an occurrence its Staff are emailed a Reminder (0: that morning); None: no Reminder.
    Column("remind_days_before", Integer),
    Column("created_at", DateTime(timezone=True), nullable=False),
    CheckConstraint(f"repeat IN {get_args(Repeat)}", name="repeat"),
    CheckConstraint("ends_on >= starts_on", name="ends_after_start"),
)


@dataclass(frozen=True)
class EventDetails:
    """What a Staff member enters for an Event. All-day without times; timed with both, on one
    day."""

    group_id: int | None
    title: str
    note: str
    starts_on: date
    ends_on: date
    start_time: time | None = None
    end_time: time | None = None
    repeat: Repeat = "none"
    repeat_every: int = 1
    repeat_until: date | None = None
    remind_days_before: int | None = None


@dataclass(frozen=True)
class Event:
    id: int
    # None: for the whole Kita.
    group: Group | None
    title: str
    note: str
    starts_on: date
    ends_on: date
    start_time: time | None
    end_time: time | None
    repeat: Repeat
    repeat_every: int
    repeat_until: date | None
    remind_days_before: int | None


@dataclass(frozen=True)
class Occurrence:
    """One time an Event happens: from its first to its last day."""

    event: Event
    starts_on: date
    ends_on: date


class EventNotFound(Exception):
    """There is no Event with this ID."""


class EndsBeforeStart(Exception):
    """An Event's end, or the date its repeats end, comes before its start."""


class InvalidTimes(Exception):
    """A timed Event needs a start and an end time, and is on one day."""


class InvalidRepeat(Exception):
    """An Event repeats every 1 to 99 days, weeks, months or years."""


class InvalidReminder(Exception):
    """A Reminder goes out that morning, or 1, 2 or 7 days before."""


class SpanTooLong(Exception):
    """A Calendar asks for more days at once than MAX_SPAN_DAYS."""


def _checked(details: EventDetails) -> EventDetails:
    title = " ".join(details.title.split())
    note = details.note.strip()
    if not title:
        raise NameRequired
    if len(title) > _MAX_TITLE_LENGTH or len(note) > _MAX_NOTE_LENGTH:
        raise TooLong
    if details.remind_days_before not in (None, *REMIND_DAYS_BEFORE):
        raise InvalidReminder
    if details.ends_on < details.starts_on:
        raise EndsBeforeStart
    timed = details.start_time is not None or details.end_time is not None
    if timed:
        if details.start_time is None or details.end_time is None:
            raise InvalidTimes
        if details.ends_on != details.starts_on:
            raise InvalidTimes
        if details.end_time <= details.start_time:
            raise EndsBeforeStart
    if details.repeat == "none":
        # Nothing to repeat: keep no leftovers from a form.
        return replace(details, title=title, note=note, repeat_every=1, repeat_until=None)
    if not 1 <= details.repeat_every <= _MAX_REPEAT_EVERY:
        raise InvalidRepeat
    if details.repeat_until is not None and details.repeat_until < details.starts_on:
        raise EndsBeforeStart
    return replace(details, title=title, note=note)


def _shifted_by_months(day: date, months: int) -> date | None:
    """The same day of the month, `months` later; None if that month has no such day (e.g. the
    31st, or 29 February), so that occurrence is left out, as calendar apps do."""
    month_index = day.month - 1 + months
    year, month = day.year + month_index // 12, month_index % 12 + 1
    if day.day > calendar.monthrange(year, month)[1]:
        return None
    return date(year, month, day.day)


def _starts(event: Event, first: date, last: date) -> Iterator[date]:
    """The first days of the Event's occurrences that overlap `first` to `last`."""
    length = event.ends_on - event.starts_on
    # An occurrence starting this early still reaches into the span.
    earliest = first - length
    latest = last if event.repeat_until is None else min(last, event.repeat_until)
    if event.repeat == "none":
        if earliest <= event.starts_on <= last:
            yield event.starts_on
        return
    if event.repeat in ("daily", "weekly"):
        step = timedelta(days=event.repeat_every * (7 if event.repeat == "weekly" else 1))
        # Skips straight to the first occurrence that can reach the span.
        skipped = max(0, -(-(earliest - event.starts_on).days // step.days))
        day = event.starts_on + skipped * step
        while day <= latest:
            yield day
            day += step
        return
    months = event.repeat_every * (12 if event.repeat == "yearly" else 1)
    months_to_earliest = (earliest.year - event.starts_on.year) * 12 + (
        earliest.month - event.starts_on.month
    )
    # From a little before the span, as months differ in length.
    count = max(0, months_to_earliest // months - 1)
    while True:
        shifted = _shifted_by_months(event.starts_on, count * months)
        count += 1
        if shifted is None:
            continue
        if shifted > latest:
            return
        if shifted >= earliest:
            yield shifted


def _to_event(row: Row[Any]) -> Event:
    group = None if row.group_id is None else Group(row.group_name, row.group_icon, row.group_id)
    return Event(
        row.id,
        group,
        row.title,
        row.note,
        row.starts_on,
        row.ends_on,
        row.start_time,
        row.end_time,
        row.repeat,
        row.repeat_every,
        row.repeat_until,
        row.remind_days_before,
    )


def _event_query() -> Any:
    return select(
        events, groups.c.name.label("group_name"), groups.c.icon.label("group_icon")
    ).outerjoin(groups, groups.c.id == events.c.group_id)


def _order(occurrence: Occurrence) -> tuple[Any, ...]:
    # All-day before timed on the same day.
    event = occurrence.event
    return (
        occurrence.starts_on,
        event.start_time is not None,
        event.start_time,
        event.title,
        event.id,
    )


class Events:
    def __init__(self, engine: Engine, clock: Clock) -> None:
        self._engine = engine
        self._clock = clock

    def occurrences(self, first: date, last: date, group_id: int | None) -> list[Occurrence]:
        """What happens from `first` to `last` (both included), in order: for one Group, its
        own and the whole Kita's Events; with no Group, every Event."""
        if last < first:
            raise EndsBeforeStart
        if (last - first).days >= MAX_SPAN_DAYS:
            raise SpanTooLong
        # Roughly: those that can overlap the span; _starts decides exactly.
        query = _event_query().where(
            events.c.starts_on <= last,
            or_(events.c.repeat != "none", events.c.ends_on >= first),
        )
        with transaction(self._engine) as connection:
            if group_id is not None:
                self._check_group(connection, group_id)
                query = query.where(or_(events.c.group_id == group_id, events.c.group_id.is_(None)))
            rows = connection.execute(query).all()
        found = [
            Occurrence(event, start, start + (event.ends_on - event.starts_on))
            for event in map(_to_event, rows)
            for start in _starts(event, first, last)
        ]
        return sorted(found, key=_order)

    def add(self, details: EventDetails) -> Event:
        details = _checked(details)
        with transaction(self._engine) as connection:
            self._check_group(connection, details.group_id)
            event_id = connection.scalar(
                insert(events)
                .values(**_values(details), created_at=self._clock.now())
                .returning(events.c.id)
            )
            assert event_id is not None
            return self._event(connection, event_id)

    def update(self, event_id: int, details: EventDetails) -> Event:
        """Changes the Event: every occurrence of it, if it repeats."""
        details = _checked(details)
        with transaction(self._engine) as connection:
            self._check_group(connection, details.group_id)
            found = connection.scalar(
                update(events)
                .where(events.c.id == event_id)
                .values(**_values(details))
                .returning(events.c.id)
            )
            if found is None:
                raise EventNotFound
            return self._event(connection, event_id)

    def remove(self, event_id: int) -> None:
        """Removes the Event: every occurrence of it, if it repeats."""
        with transaction(self._engine) as connection:
            found = connection.scalar(
                delete(events).where(events.c.id == event_id).returning(events.c.id)
            )
        if found is None:
            raise EventNotFound

    @staticmethod
    def _check_group(connection: Connection, group_id: int | None) -> None:
        if group_id is None:
            return
        found = connection.scalar(
            select(groups.c.id).where(groups.c.id == group_id).with_for_update(read=True)
        )
        if found is None:
            raise GroupNotFound

    @staticmethod
    def _event(connection: Connection, event_id: int) -> Event:
        return _to_event(connection.execute(_event_query().where(events.c.id == event_id)).one())


def _values(details: EventDetails) -> dict[str, Any]:
    return {
        "group_id": details.group_id,
        "title": details.title,
        "note": details.note,
        "starts_on": details.starts_on,
        "ends_on": details.ends_on,
        "start_time": details.start_time,
        "end_time": details.end_time,
        "repeat": details.repeat,
        "repeat_every": details.repeat_every,
        "repeat_until": details.repeat_until,
        "remind_days_before": details.remind_days_before,
    }
