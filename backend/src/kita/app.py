from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from importlib.metadata import version
from typing import Literal

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from kita.audit import Audit
from kita.audit_api import audit_router, audited_route
from kita.children import Children
from kita.children_api import children_router
from kita.clock import Clock, SystemClock
from kita.contacts import Contacts
from kita.crash import (
    CrashReportingMailer,
    CrashReportSink,
    WebCrashReport,
    api_crash_report,
    default_crash_sink,
    send_safely,
)
from kita.encryption import FieldCipher
from kita.identity import Identity
from kita.identity_api import (
    email_verification_router,
    identity_router,
    password_reset_router,
)
from kita.mail import Mailer, mailer_from_settings
from kita.parents import Parents
from kita.parents_api import parents_router
from kita.settings import Settings
from kita.staff_api import staff_router


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
    # First, so a missing or broken key stops the app before it serves anything.
    cipher = FieldCipher.from_settings(settings)
    clock = clock or SystemClock()
    mailer = mailer or mailer_from_settings(settings)
    crash_sink = crash_sink or default_crash_sink(settings, mailer)
    app_version = version("kita")
    reporting_mailer = CrashReportingMailer(mailer, crash_sink, clock, app_version)
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
    identity = Identity.from_settings(engine, clock, reporting_mailer, settings)
    app.include_router(identity_router(identity, settings))
    app.include_router(email_verification_router(identity))
    app.include_router(password_reset_router(identity))
    app.include_router(staff_router(identity))
    children = Children(engine, clock)
    audit = Audit(engine, clock)
    audited_route_class = audited_route(audit, engine)
    parents = Parents(engine, clock, cipher)
    contacts = Contacts(engine, cipher)
    app.include_router(children_router(identity, children, parents, contacts, audited_route_class))
    app.include_router(parents_router(identity, parents, audited_route_class))
    app.include_router(audit_router(identity, audit, children))

    @app.exception_handler(Exception)
    async def report_crash(request: Request, error: Exception) -> JSONResponse:
        send_safely(crash_sink, api_crash_report(request, error, app_version, clock.now()))
        return JSONResponse({"detail": "Internal Server Error"}, status_code=500)

    @app.post("/api/crash-reports", status_code=status.HTTP_202_ACCEPTED)
    def receive_web_crash_report(report: WebCrashReport) -> None:
        send_safely(crash_sink, report.to_crash_report(clock.now()))

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
