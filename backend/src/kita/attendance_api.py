"""The API's form of Attendance and Absences, shared by the Child routes and the Group
dashboard (the Today view)."""

from datetime import date, datetime
from typing import Literal

from fastapi import status
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals
from kita.attendance import (
    Absence,
    AbsenceEndsBeforeStart,
    AbsenceNotFound,
    AbsenceReason,
    AbsentToday,
    AlreadyCheckedIn,
    AlreadyCheckedOut,
    AttendanceDay,
    NotCheckedIn,
    OverlappingAbsence,
    PresentThen,
)

# What a Staff member does at the door: check in, check out, or undo today's last of these.
AttendanceStep = Literal["check-in", "check-out", "undo"]


class AttendanceDayOut(BaseModel):
    """A Child's day: checked in at, and out at (None while still at the Kita)."""

    model_config = CAMEL_CASE

    checked_in_at: datetime
    checked_out_at: datetime | None

    @classmethod
    def of(cls, day: AttendanceDay) -> "AttendanceDayOut":
        return cls.model_validate(day)


class AbsenceIn(BaseModel):
    model_config = CAMEL_CASE

    starts_on: date
    # None: the day it starts.
    ends_on: date | None = None
    reason: AbsenceReason


class AbsenceOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    starts_on: date
    ends_on: date
    reason: AbsenceReason

    @classmethod
    def of(cls, absence: Absence) -> "AbsenceOut":
        return cls.model_validate(absence)


ATTENDANCE_REFUSALS: Refusals = {
    NotCheckedIn: (status.HTTP_409_CONFLICT, "not_checked_in"),
    AlreadyCheckedIn: (status.HTTP_409_CONFLICT, "already_checked_in"),
    AlreadyCheckedOut: (status.HTTP_409_CONFLICT, "already_checked_out"),
    AbsentToday: (status.HTTP_409_CONFLICT, "absent_today"),
    PresentThen: (status.HTTP_409_CONFLICT, "present_then"),
    OverlappingAbsence: (status.HTTP_409_CONFLICT, "overlapping_absence"),
    AbsenceEndsBeforeStart: (status.HTTP_422_UNPROCESSABLE_CONTENT, "ends_before_start"),
    AbsenceNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
}
