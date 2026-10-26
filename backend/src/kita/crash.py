import logging
import os
import traceback
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Literal, Protocol

from fastapi import Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

from kita.mail import Email, Mailer
from kita.settings import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CrashReport:
    """An anonymised crash: what failed and where in the code, never the data involved."""

    source: Literal["api", "web"]
    error_type: str
    # "METHOD /route/{template}" for the API, the page section for the web app.
    location: str
    version: str
    frames: tuple[str, ...]
    occurred_at: datetime


class CrashReportSink(Protocol):
    def send(self, report: CrashReport) -> None: ...


class LogCrashReportSink:
    """Logs crash reports on the server."""

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


class FanOutCrashReportSink:
    """Sends each report to several sinks; one failing does not stop the others."""

    def __init__(self, *sinks: CrashReportSink) -> None:
        self._sinks = sinks

    def send(self, report: CrashReport) -> None:
        for sink in self._sinks:
            send_safely(sink, report)


def default_crash_sink(settings: Settings, mailer: Mailer) -> CrashReportSink:
    """Always logs; also emails the developer when an address is configured."""
    if settings.crash_report_email:
        return FanOutCrashReportSink(
            LogCrashReportSink(), MailCrashReportSink(mailer, settings.crash_report_email)
        )
    return LogCrashReportSink()


def send_safely(sink: CrashReportSink, report: CrashReport) -> None:
    """Sends a report. A failing sink is logged, never raised, so reporting cannot cause a crash."""
    try:
        sink.send(report)
    except Exception:
        logger.exception("Crash report could not be sent: %s in %s", report.error_type, report.location)


def api_crash_report(
    request: Request, error: BaseException, version: str, occurred_at: datetime
) -> CrashReport:
    # The route template, not the URL, so IDs and query strings stay out of the report.
    route_path = getattr(request.scope.get("route"), "path", "<unmatched>")
    return CrashReport(
        source="api",
        error_type=type(error).__name__,
        location=f"{request.method} {route_path}",
        version=version,
        frames=code_frames(error),
        occurred_at=occurred_at,
    )


# ASCII-only shapes: Python's \w and \d would also accept umlauts and other Unicode letters.
ErrorTypeName = Annotated[str, StringConstraints(pattern=r"^[A-Za-z_$][A-Za-z0-9_$]{0,99}$")]
# Only the first path segment, so deeper segments (IDs, or names in a careless route) never arrive.
PageSection = Annotated[str, StringConstraints(pattern=r"^/(?:[A-Za-z0-9_\-]{1,50}(?:/\*)?)?$")]
VersionNumber = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_.+\-]{1,40}$")]
CodeLocation = Annotated[
    str, StringConstraints(pattern=r"^/[A-Za-z0-9_\-./]{0,199}:[0-9]{1,7}:[0-9]{1,7}$")
]


class WebCrashReport(BaseModel):
    """What the browser may report. Every field has a strict shape so free text, which could hold
    personal data, is rejected rather than forwarded."""

    model_config = ConfigDict(alias_generator=to_camel)

    error_type: ErrorTypeName
    page: PageSection
    version: VersionNumber
    frames: Annotated[list[CodeLocation], Field(max_length=50)]

    def to_crash_report(self, occurred_at: datetime) -> CrashReport:
        return CrashReport(
            source="web",
            error_type=self.error_type,
            location=self.page,
            version=self.version,
            frames=tuple(self.frames),
            occurred_at=occurred_at,
        )


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
