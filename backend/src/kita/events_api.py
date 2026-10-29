"""HTTP API for the Calendar: Admins and Teachers see every Event and may add, change and remove
them. Events are not Child data, so not audited."""

from datetime import date, time
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.children import NameRequired, TooLong
from kita.events import (
    EndsBeforeStart,
    Event,
    EventDetails,
    EventNotFound,
    Events,
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


_REFUSALS: Refusals = {
    NameRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "name_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
    EndsBeforeStart: (status.HTTP_422_UNPROCESSABLE_CONTENT, "ends_before_start"),
    InvalidTimes: (status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_times"),
    InvalidRepeat: (status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_repeat"),
    SpanTooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "span_too_long"),
    GroupNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    EventNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
}


def events_router(identity: Identity, events: Events) -> APIRouter:
    router = APIRouter(
        prefix="/api/events", dependencies=[Depends(staff_member_dependency(identity))]
    )

    @router.get("")
    def calendar(
        first: Annotated[date, Query(alias="from")],
        last: Annotated[date, Query(alias="to")],
        group_id: Annotated[int | None, Query(alias="groupId")] = None,
    ) -> list[OccurrenceOut]:
        """What happens from `from` to `to` (both included), in order. With `groupId`, that
        Group's own and the whole Kita's Events; without, every Event (the Kita-wide Calendar)."""
        with refusals_as_http_errors(_REFUSALS):
            occurrences = events.occurrences(first, last, group_id)
        return [OccurrenceOut.of(occurrence) for occurrence in occurrences]

    @router.post("", status_code=status.HTTP_201_CREATED)
    def add_event(event: EventIn) -> EventOut:
        with refusals_as_http_errors(_REFUSALS):
            return EventOut.of(events.add(event.details()))

    @router.put("/{event_id}")
    def update_event(event_id: int, event: EventIn) -> EventOut:
        """Changes every occurrence of the Event."""
        with refusals_as_http_errors(_REFUSALS):
            return EventOut.of(events.update(event_id, event.details()))

    @router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
    def remove_event(event_id: int) -> None:
        """Removes every occurrence of the Event."""
        with refusals_as_http_errors(_REFUSALS):
            events.remove(event_id)

    return router
