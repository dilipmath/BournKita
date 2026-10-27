from datetime import UTC, date, datetime
from typing import Protocol
from zoneinfo import ZoneInfo

# Where the Kita is, which decides what day it is there.
KITA_TIME_ZONE = ZoneInfo("Europe/Berlin")


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


def today(clock: Clock) -> date:
    """The date at the Kita."""
    return clock.now().astimezone(KITA_TIME_ZONE).date()
