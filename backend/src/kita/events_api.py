"""HTTP API for Events: Admins and Teachers add, change and remove them (the Calendar lists
them). Events are not Child data, so not audited."""

from datetime import date, time

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.children import NameRequired, TooLong
from kita.events import (
    EndsBeforeStart,
    Event,
    EventDetails,
    EventNotFound,
    Events,
    InvalidReminder,
    InvalidRepeat,
    InvalidTimes,
    Occurrence,
    Repeat,
    SpanTooLong,
)
from kita.groups import GroupNotFound
from kita.groups_api import GroupOut
from kita.identity import Identity
from kita.identity_api import staff_member_dependency


class EventIn(BaseModel):
    model_config = CAMEL_CASE

    # None: for the whole Kita.
    group_id: int | None = None
    title: str
    note: str = ""
    starts_on: date
    # None: the day it starts.
    ends_on: date | None = None
    # Both, for a timed Event; neither, for an all-day one.
    start_time: time | None = None
    end_time: time | None = None
    repeat: Repeat = "none"
    repeat_every: int = 1
    repeat_until: date | None = None
    # Days before each occurrence its Staff are reminded by email (0: that morning); None: never.
    remind_days_before: int | None = None

    def details(self) -> EventDetails:
        return EventDetails(
            self.group_id,
            self.title,
            self.note,
            self.starts_on,
            self.ends_on or self.starts_on,
            self.start_time,
            self.end_time,
            self.repeat,
            self.repeat_every,
            self.repeat_until,
            self.remind_days_before,
        )


class EventOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    group: GroupOut | None
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

    @classmethod
    def of(cls, event: Event) -> "EventOut":
        return cls.model_validate(event)


class OccurrenceOut(BaseModel):
    """One time an Event happens, from its first to its last day."""

    model_config = CAMEL_CASE

    event: EventOut
    starts_on: date
    ends_on: date

    @classmethod
    def of(cls, occurrence: Occurrence) -> "OccurrenceOut":
        return cls.model_validate(occurrence)


EVENT_REFUSALS: Refusals = {
    NameRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "name_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
    EndsBeforeStart: (status.HTTP_422_UNPROCESSABLE_CONTENT, "ends_before_start"),
    InvalidTimes: (status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_times"),
    InvalidRepeat: (status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_repeat"),
    InvalidReminder: (status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_reminder"),
    SpanTooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "span_too_long"),
    GroupNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    EventNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
}


def events_router(identity: Identity, events: Events) -> APIRouter:
    router = APIRouter(
        prefix="/api/events", dependencies=[Depends(staff_member_dependency(identity))]
    )

    # Their occurrences are listed by the Calendar (calendar_api).
    @router.post("", status_code=status.HTTP_201_CREATED)
    def add_event(event: EventIn) -> EventOut:
        with refusals_as_http_errors(EVENT_REFUSALS):
            return EventOut.of(events.add(event.details()))

    @router.put("/{event_id}")
    def update_event(event_id: int, event: EventIn) -> EventOut:
        """Changes every occurrence of the Event."""
        with refusals_as_http_errors(EVENT_REFUSALS):
            return EventOut.of(events.update(event_id, event.details()))

    @router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
    def remove_event(event_id: int) -> None:
        """Removes every occurrence of the Event."""
        with refusals_as_http_errors(EVENT_REFUSALS):
            events.remove(event_id)

    return router
