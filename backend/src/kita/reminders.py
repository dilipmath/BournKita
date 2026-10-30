"""Reminders: emails to Staff members about Events coming up, as each Event asks (that morning, or
some days before). A job checks every few minutes; from 07:00 at the Kita on the day a reminder
is due, it goes out, once to each Staff member."""

from datetime import date, time, timedelta

from sqlalchemy import (
    Column,
    Date,
    Engine,
    ForeignKey,
    Integer,
    Table,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import insert as upsert
from sqlalchemy.exc import IntegrityError

from kita.clock import KITA_TIME_ZONE, Clock
from kita.db import metadata, transaction
from kita.events import REMIND_DAYS_BEFORE, Events, Occurrence
from kita.groups import group_staff
from kita.identity import IS_ACTIVE, users
from kita.mail import Email, Mailer, MailNotSent

# Held by the run sending Reminders, so two runs at once (e.g. two server processes) never both
# send. Any number unique among the app's advisory locks.
_RUN_LOCK = 24_0001

# Reminders go out from this time at the Kita, not in the night.
SEND_FROM = time(7, 0)

# Who has been reminded of which occurrence, so nobody is reminded twice.
reminders_sent = Table(
    "reminders_sent",
    metadata,
    Column("event_id", Integer, ForeignKey("events.id", ondelete="CASCADE"), primary_key=True),
    Column("occurs_on", Date, primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


def _german_date(day: date) -> str:
    return day.strftime("%d.%m.%Y")


def _when(occurrence: Occurrence) -> tuple[str, str]:
    """When it is, in German and in English."""
    event = occurrence.event
    if occurrence.starts_on != occurrence.ends_on:
        days = f"{_german_date(occurrence.starts_on)} – {_german_date(occurrence.ends_on)}"
        return days, days
    day = _german_date(occurrence.starts_on)
    if event.start_time is None or event.end_time is None:
        return day, day
    times = f"{event.start_time:%H:%M}–{event.end_time:%H:%M}"
    return f"{day}, {times} Uhr", f"{day}, {times}"


def reminder_email(to: str, occurrence: Occurrence, calendar_link: str) -> Email:
    """In German and English, since the app does not know which language a Staff member prefers."""
    event = occurrence.event
    when_de, when_en = _when(occurrence)
    for_de = f"Gruppe {event.group.name}" if event.group else "die ganze Kita"
    for_en = f"Group {event.group.name}" if event.group else "the whole Kita"
    note = [event.note, ""] if event.note else []
    body = "\n".join(
        [
            "Hallo,",
            "",
            f"eine Erinnerung: „{event.title}“ ({for_de}), {when_de}.",
            "",
            *note,
            f"Zum Kalender: {calendar_link}",
            "",
            "---",
            "",
            "Hello,",
            "",
            f"a reminder: “{event.title}” ({for_en}), {when_en}.",
            "",
            *note,
            f"To the calendar: {calendar_link}",
        ]
    )
    return Email(
        to=to,
        subject=f"Erinnerung / Reminder: {event.title} – {_german_date(occurrence.starts_on)}",
        body=body,
    )


class Reminders:
    def __init__(
        self, engine: Engine, clock: Clock, mailer: Mailer, events: Events, public_url: str
    ) -> None:
        self._engine = engine
        self._clock = clock
        self._mailer = mailer
        self._events = events
        self._calendar_link = f"{public_url.rstrip('/')}/calendar"

    def send_due(self) -> None:
        """Sends the Reminders that are due and have not gone out yet. Before 07:00 at the Kita,
        none. A Reminder is due from its day until its occurrence begins: one missed (the server
        was off, the mail server down) or asked for too late (an Event added the day before it)
        goes out on the next run. Only one run sends at a time; another at once steps aside."""
        now = self._clock.now().astimezone(KITA_TIME_ZONE)
        if now.time() < SEND_FROM:
            return
        today = now.date()
        with self._engine.connect() as lock:
            if not lock.scalar(select(func.pg_try_advisory_lock(_RUN_LOCK))):
                return
            try:
                ahead = today + timedelta(days=max(REMIND_DAYS_BEFORE))
                for occurrence in self._events.occurrences(today, ahead, None):
                    days = occurrence.event.remind_days_before
                    begun = occurrence.starts_on < today
                    if (
                        days is not None
                        and not begun
                        and occurrence.starts_on - timedelta(days=days) <= today
                    ):
                        self._remind(occurrence)
            finally:
                lock.scalar(select(func.pg_advisory_unlock(_RUN_LOCK)))

    def _remind(self, occurrence: Occurrence) -> None:
        event = occurrence.event
        # Active Staff members, of the Group or of the whole Kita; not Guests, who only read the
        # calendar.
        recipients = select(users.c.id, users.c.email).where(*IS_ACTIVE, users.c.role != "guest")
        if event.group is not None:
            recipients = recipients.join(group_staff, group_staff.c.user_id == users.c.id).where(
                group_staff.c.group_id == event.group.id
            )
        reminded = select(reminders_sent.c.user_id).where(
            reminders_sent.c.event_id == event.id,
            reminders_sent.c.occurs_on == occurrence.starts_on,
        )
        with transaction(self._engine) as connection:
            due = connection.execute(
                recipients.where(users.c.id.not_in(reminded)).order_by(users.c.email)
            ).all()
        for user_id, email in due:
            try:
                self._mailer.send(reminder_email(email, occurrence, self._calendar_link))
            except MailNotSent:
                continue  # Reported by the mailer; tried again next time.
            try:
                with transaction(self._engine) as connection:
                    connection.execute(
                        upsert(reminders_sent)
                        .values(event_id=event.id, occurs_on=occurrence.starts_on, user_id=user_id)
                        .on_conflict_do_nothing()
                    )
            except IntegrityError:
                # The Event or the account was deleted meanwhile: nothing left to remind of.
                return
