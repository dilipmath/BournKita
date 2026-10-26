import logging
import os
import traceback
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

from kita.mail import Email, Mailer

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CrashReport:
    """An anonymised crash: what failed and where in the code, never the data involved."""

    source: Literal["api", "web"]
    error_type: str
    # "METHOD /route/{template}" for the API, the page path for the web app.
    location: str
    version: str
    frames: tuple[str, ...]
    occurred_at: datetime


class CrashReportSink(Protocol):
    def send(self, report: CrashReport) -> None: ...


class LogCrashReportSink:
    """Development sink: logs crash reports instead of forwarding them."""

    def send(self, report: CrashReport) -> None:
        logger.error(
            "Crash in %s %s (%s, version %s)\n%s",
            report.source,
            report.location,
            report.error_type,
            report.version,
            "\n".join(report.frames),
        )


class MailCrashReportSink:
    """Emails each crash report to the developer."""

    def __init__(self, mailer: Mailer, to: str) -> None:
        self._mailer = mailer
        self._to = to

    def send(self, report: CrashReport) -> None:
        body = "\n".join(
            [
                f"Source: {report.source}",
                f"Location: {report.location}",
                f"Error: {report.error_type}",
                f"Version: {report.version}",
                f"Time: {report.occurred_at.isoformat()}",
                "",
                *report.frames,
            ]
        )
        subject = f"Kita crash: {report.error_type} in {report.location}"
        self._mailer.send(Email(to=self._to, subject=subject, body=body))


def send_safely(sink: CrashReportSink, report: CrashReport) -> None:
    """Sends a report. A failing sink is logged, never raised, so reporting cannot cause a crash."""
    try:
        sink.send(report)
    except Exception:
        logger.exception("Crash report could not be sent: %s in %s", report.error_type, report.location)


# ASCII-only shapes: Python's \w and \d would also accept umlauts and other Unicode letters.
_URL_PATH = r"/[A-Za-z0-9_\-./]{0,199}"
ErrorTypeName = Annotated[str, StringConstraints(pattern=r"^[A-Za-z_$][A-Za-z0-9_$]{0,99}$")]
PagePath = Annotated[str, StringConstraints(pattern=rf"^{_URL_PATH}$")]
VersionNumber = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_.+\-]{1,40}$")]
CodeLocation = Annotated[str, StringConstraints(pattern=rf"^{_URL_PATH}:[0-9]{{1,7}}:[0-9]{{1,7}}$")]


class WebCrashReport(BaseModel):
    """What the browser may report. Every field has a strict shape so free text, which could hold
    personal data, is rejected rather than forwarded."""

    model_config = ConfigDict(alias_generator=to_camel)

    error_type: ErrorTypeName
    page: PagePath
    version: VersionNumber
    frames: Annotated[list[CodeLocation], Field(max_length=50)]


def code_frames(error: BaseException) -> tuple[str, ...]:
    """Code locations of the traceback. Leaves out the exception message and local values."""
    return tuple(
        f"{_relative_path(frame.filename)}:{frame.lineno} in {frame.name}"
        for frame in traceback.extract_tb(error.__traceback__)
    )


def _relative_path(filename: str) -> str:
    path = filename.replace("\\", "/")
    for marker in ("/site-packages/", "/src/"):
        if marker in path:
            return path.rsplit(marker, 1)[1]
    cwd = os.getcwd().replace("\\", "/") + "/"
    # Anything else keeps only its file name, so no home directory or user name gets through.
    return path.removeprefix(cwd) if path.startswith(cwd) else path.rsplit("/", 1)[-1]
