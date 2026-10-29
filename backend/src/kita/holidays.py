"""Holidays: the public and school Holidays of the Kita's region, which an Admin imports from an
iCal file (e.g. one downloaded from a holiday website). They are the whole Kita's: every Group's
Calendar shows them."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Literal, get_args

from icalendar import Calendar
from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    Engine,
    Integer,
    String,
    Table,
    delete,
    func,
    insert,
    select,
)

from kita.clock import KITA_TIME_ZONE
from kita.db import metadata, transaction

HolidayKind = Literal["public", "school"]

_MAX_NAME_LENGTH = 200

holidays = Table(
    "holidays",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("kind", String(10), nullable=False),
    Column("name", String(_MAX_NAME_LENGTH), nullable=False),
    # The first and last day, both included.
    Column("starts_on", Date, nullable=False, index=True),
    Column("ends_on", Date, nullable=False),
    CheckConstraint(f"kind IN {get_args(HolidayKind)}", name="kind"),
    CheckConstraint("ends_on >= starts_on", name="ends_after_start"),
)


@dataclass(frozen=True)
class Holiday:
    kind: HolidayKind
    name: str
    starts_on: date
    ends_on: date


@dataclass(frozen=True)
class HolidaysImported:
    """What one kind of Holidays holds: how many, from the first to the last day."""

    kind: HolidayKind
    count: int
    first_day: date
    last_day: date


class NotACalendar(Exception):
    """The file is not an iCal file."""


class RepeatingHolidays(Exception):
    """The file has repeating entries (rules), which are not imported: a Holiday file lists each
    holiday once, with its dates."""


class NoHolidays(Exception):
    """The file holds no Holidays."""


def _day(value: Any) -> date:
    """The Kita's day of a date or time: a time with a time zone (e.g. UTC) counts on the day it
    is at the Kita; one without is taken as the Kita's own."""
    if not isinstance(value, datetime):
        plain: date = value
        return plain
    return (value.astimezone(KITA_TIME_ZONE) if value.tzinfo else value).date()


def _last_day(start: Any, end: Any) -> date:
    """The last day from `start` up to `end`, which iCal does not include: for dates, the day
    before; for times, the day of the moment before (so midnight to midnight is one day)."""
    just_before = end - (
        timedelta(days=1) if not isinstance(end, datetime) else timedelta(microseconds=1)
    )
    return max(_day(start), _day(just_before))


def parse(data: bytes, kind: HolidayKind) -> list[Holiday]:
    """The Holidays an iCal file lists, as Holidays of `kind`."""
    try:
        calendar = Calendar.from_ical(data)
        entries = list(calendar.walk("VEVENT"))
    except (ValueError, KeyError, IndexError, UnicodeDecodeError) as error:
        raise NotACalendar from error
    found: list[Holiday] = []
    for entry in entries:
        if "RRULE" in entry or "RDATE" in entry:
            raise RepeatingHolidays
        if "DTSTART" not in entry:
            raise NotACalendar
        start = entry.decoded("DTSTART")
        if "DTEND" in entry:
            last = _last_day(start, entry.decoded("DTEND"))
        elif "DURATION" in entry:
            last = _last_day(start, start + entry.decoded("DURATION"))
        else:
            last = _day(start)
        name = " ".join(str(entry.get("SUMMARY", "")).split())[:_MAX_NAME_LENGTH]
        found.append(Holiday(kind, name, _day(start), last))
    if not found:
        raise NoHolidays
    return found


class Holidays:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def replace(self, kind: HolidayKind, imported: list[Holiday]) -> None:
        """Puts these Holidays in place of all of that kind: importing a file again (e.g. next
        year's) does not add them twice."""
        with transaction(self._engine) as connection:
            connection.execute(delete(holidays).where(holidays.c.kind == kind))
            connection.execute(
                insert(holidays),
                [
                    {"kind": kind, "name": h.name, "starts_on": h.starts_on, "ends_on": h.ends_on}
                    for h in imported
                ],
            )

    def imported(self) -> list[HolidaysImported]:
        """Each kind of Holidays imported so far."""
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(
                    holidays.c.kind,
                    func.count(),
                    func.min(holidays.c.starts_on),
                    func.max(holidays.c.ends_on),
                )
                .group_by(holidays.c.kind)
                .order_by(holidays.c.kind)
            ).all()
        return [HolidaysImported(*row) for row in rows]

    def between(self, first: date, last: date) -> list[Holiday]:
        """The Holidays touching `first` to `last` (both included), in order."""
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(holidays.c.kind, holidays.c.name, holidays.c.starts_on, holidays.c.ends_on)
                .where(holidays.c.starts_on <= last, holidays.c.ends_on >= first)
                .order_by(holidays.c.starts_on, holidays.c.kind, holidays.c.name)
            ).all()
        return [Holiday(*row) for row in rows]
