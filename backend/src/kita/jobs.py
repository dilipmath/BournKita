"""Background jobs inside the API service, such as sending Reminders or purging the archive."""

import asyncio
from collections.abc import Callable

from fastapi.concurrency import run_in_threadpool


async def run_regularly(
    work: Callable[[], None], every_seconds: int, report_crash: Callable[[Exception], None]
) -> None:
    """Runs `work` every `every_seconds`, until cancelled. A failing run is reported, and the
    next one tries again."""
    while True:
        try:
            await run_in_threadpool(work)
        except Exception as error:  # noqa: BLE001 - the job must outlive any one failing run.
            report_crash(error)
        await asyncio.sleep(every_seconds)
