from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from importlib.metadata import version
from typing import Literal

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from kita.clock import Clock, SystemClock
from kita.crash import (
    CrashReport,
    CrashReportSink,
    LogCrashReportSink,
    MailCrashReportSink,
    WebCrashReport,
    code_frames,
    send_safely,
)
from kita.mail import LogMailer, Mailer
from kita.settings import Settings


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]
    time: str


def create_app(
    settings: Settings,
    clock: Clock | None = None,
    mailer: Mailer | None = None,
    crash_sink: CrashReportSink | None = None,
) -> FastAPI:
    clock = clock or SystemClock()
    mailer = mailer or LogMailer()
    if crash_sink is None:
        crash_sink = (
            MailCrashReportSink(mailer, settings.crash_report_email)
            if settings.crash_report_email
            else LogCrashReportSink()
        )
    app_version = version("kita")
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": settings.database_connect_timeout_seconds},
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    app = FastAPI(title="Kita Kids Database", lifespan=lifespan)
    app.state.mailer = mailer

    @app.exception_handler(Exception)
    async def report_crash(request: Request, error: Exception) -> JSONResponse:
        # The route template, not the URL, so IDs and query strings stay out of the report.
        route = request.scope.get("route")
        route_path = getattr(route, "path", "<unmatched>")
        send_safely(
            crash_sink,
            CrashReport(
                source="api",
                error_type=type(error).__name__,
                location=f"{request.method} {route_path}",
                version=app_version,
                frames=code_frames(error),
                occurred_at=clock.now(),
            ),
        )
        return JSONResponse({"detail": "Internal Server Error"}, status_code=500)

    @app.post("/api/crash-reports", status_code=status.HTTP_202_ACCEPTED)
    def receive_web_crash_report(report: WebCrashReport) -> None:
        send_safely(
            crash_sink,
            CrashReport(
                source="web",
                error_type=report.error_type,
                location=report.page,
                version=report.version,
                frames=tuple(report.frames),
                occurred_at=clock.now(),
            ),
        )

    @app.get("/api/health")
    def health(response: Response) -> Health:
        now = clock.now().isoformat().replace("+00:00", "Z")
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except OperationalError:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return Health(status="degraded", database="unavailable", time=now)
        return Health(status="ok", database="ok", time=now)

    return app
