"""HTTP API for the Calendar: what a span of days holds. Admins and Teachers see it; Guests see
the Kita-wide Events and the Holidays. Birthdays show a Child's name and day only, like the list
of Children, so they are not audited."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, refusals_as_http_errors
from kita.birthdays import Birthday, Birthdays
from kita.events import Events
from kita.events_api import EVENT_REFUSALS, OccurrenceOut
from kita.holidays import Holidays
from kita.holidays_api import HolidayOut
from kita.identity import Identity, StaffMember
from kita.identity_api import staff_member_dependency


class BirthdayOut(BaseModel):
    model_config = CAMEL_CASE

    child_id: int
    first_name: str
    last_name: str
    on: date

    @classmethod
    def of(cls, birthday: Birthday) -> "BirthdayOut":
        return cls.model_validate(birthday)


class CalendarOut(BaseModel):
    """A span of days: its Events' occurrences, the Children's Birthdays and the Holidays,
    each in order."""

    model_config = CAMEL_CASE

    events: list[OccurrenceOut]
    birthdays: list[BirthdayOut]
    # The whole Kita's, so in every Group's Calendar too.
    holidays: list[HolidayOut]


def calendar_router(
    identity: Identity, events: Events, birthdays: Birthdays, holidays: Holidays
) -> APIRouter:
    router = APIRouter(prefix="/api/calendar")
    # Guests too, but they see less: see `calendar`.
    StaffMemberOrGuest = Annotated[
        StaffMember, Depends(staff_member_dependency(identity, guests_allowed=True))
    ]

    @router.get("")
    def calendar(
        staff_member: StaffMemberOrGuest,
        first: Annotated[date, Query(alias="from")],
        last: Annotated[date, Query(alias="to")],
        group_id: Annotated[int | None, Query(alias="groupId")] = None,
    ) -> CalendarOut:
        """From `from` to `to` (both included, at most 100 days). With `groupId`, that Group's
        Calendar: its own and the whole Kita's Events, its Children's birthdays. Without, the
        Kita-wide one: everything. A Guest gets the whole Kita's Events and the Holidays only:
        no Birthdays (Children's names) and no Group's Events, which may name Children."""
        is_guest = staff_member.role == "guest"
        if is_guest and group_id is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="not_for_guests")
        with refusals_as_http_errors(EVENT_REFUSALS):
            occurrences = events.occurrences(first, last, group_id)
        if is_guest:
            occurrences = [each for each in occurrences if each.event.group is None]
        return CalendarOut(
            events=[OccurrenceOut.of(occurrence) for occurrence in occurrences],
            birthdays=[]
            if is_guest
            else [BirthdayOut.of(b) for b in birthdays.between(first, last, group_id)],
            holidays=[HolidayOut.of(h) for h in holidays.between(first, last)],
        )

    return router
