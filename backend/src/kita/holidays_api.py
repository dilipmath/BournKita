"""HTTP API for importing Holidays: Admins only. Everyone sees them in the Calendar."""

from datetime import date

from fastapi import APIRouter, Depends, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.holidays import (
    Holiday,
    HolidayKind,
    Holidays,
    HolidaysImported,
    NoHolidays,
    NotACalendar,
    RepeatingHolidays,
    parse,
)
from kita.identity import Identity
from kita.identity_api import role_dependency

# A year of Holidays is a few kilobytes; far bigger is not a Holiday file.
_MAX_FILE_BYTES = 1_000_000


class HolidayOut(BaseModel):
    model_config = CAMEL_CASE

    kind: HolidayKind
    name: str
    starts_on: date
    ends_on: date

    @classmethod
    def of(cls, holiday: Holiday) -> "HolidayOut":
        return cls.model_validate(holiday)


class HolidaysImportedOut(BaseModel):
    model_config = CAMEL_CASE

    kind: HolidayKind
    count: int
    first_day: date
    last_day: date

    @classmethod
    def of(cls, imported: HolidaysImported) -> "HolidaysImportedOut":
        return cls.model_validate(imported)


class ImportOut(BaseModel):
    imported: int


class FileTooLarge(Exception):
    """The file is bigger than a Holiday file would be."""


_REFUSALS: Refusals = {
    NotACalendar: (status.HTTP_422_UNPROCESSABLE_CONTENT, "not_a_calendar"),
    RepeatingHolidays: (status.HTTP_422_UNPROCESSABLE_CONTENT, "repeating_holidays"),
    NoHolidays: (status.HTTP_422_UNPROCESSABLE_CONTENT, "no_holidays"),
    FileTooLarge: (status.HTTP_422_UNPROCESSABLE_CONTENT, "file_too_large"),
}


def holidays_router(identity: Identity, holidays: Holidays) -> APIRouter:
    router = APIRouter(
        prefix="/api/holidays", dependencies=[Depends(role_dependency(identity, "admin"))]
    )

    @router.get("")
    def imported_holidays() -> list[HolidaysImportedOut]:
        """Each kind of Holidays imported so far: how many, and from when to when."""
        return [HolidaysImportedOut.of(imported) for imported in holidays.imported()]

    @router.put("/{kind}")
    async def import_holidays(kind: HolidayKind, file: UploadFile) -> ImportOut:
        """Imports an iCal file's Holidays as this kind, in place of all of that kind so far."""
        data = await file.read(_MAX_FILE_BYTES + 1)
        with refusals_as_http_errors(_REFUSALS):
            if len(data) > _MAX_FILE_BYTES:
                raise FileTooLarge
            imported = await run_in_threadpool(parse, data, kind)
        await run_in_threadpool(holidays.replace, kind, imported)
        return ImportOut(imported=len(imported))

    return router
