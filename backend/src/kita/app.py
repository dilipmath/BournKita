import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager, suppress
from importlib.metadata import version
from typing import Literal

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from kita.alerts import Alerts
from kita.archive import Archive
from kita.archive_api import archive_router
from kita.attendance import Attendance
from kita.audit import Audit
from kita.audit_api import audit_router, audited_route
from kita.birthdays import Birthdays
from kita.calendar_api import calendar_router
from kita.children import Children
from kita.children_api import children_router
from kita.clock import Clock, SystemClock
from kita.consents import Consents
from kita.contacts import Contacts
from kita.crash import (
    CrashReportingMailer,
    CrashReportSink,
    WebCrashReport,
    api_crash_report,
    default_crash_sink,
    job_crash_report,
    send_safely,
)
from kita.data_requests import DataRequests, HeldData
from kita.data_requests_api import data_requests_router
from kita.emergency_list import EmergencyLists
from kita.emergency_list_api import emergency_list_router
from kita.encryption import FieldCipher
from kita.events import Events
from kita.events_api import events_router
from kita.feedback import Feedbacks
from kita.feedback_api import feedback_router
from kita.groups import Groups
from kita.groups_api import groups_router
from kita.holidays import Holidays
from kita.holidays_api import holidays_router
from kita.identity import Identity
from kita.identity_api import (
    email_verification_router,
    identity_router,
    password_reset_router,
)
from kita.incidents import Incidents
from kita.incidents_api import incidents_router
from kita.jobs import run_regularly
from kita.mail import Mailer, mailer_from_settings
from kita.parents import Parents
from kita.parents_api import parents_router
from kita.photos import DiskFileStore, FileStore, Photos
from kita.reminders import Reminders
from kita.settings import Settings
from kita.staff_api import staff_router
from kita.tasks import Tasks
from kita.tasks_api import tasks_router


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]
    time: str


def create_app(
    settings: Settings,
    clock: Clock | None = None,
    mailer: Mailer | None = None,
    crash_sink: CrashReportSink | None = None,
    file_store: FileStore | None = None,
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

    def crash_reporter(job: str) -> Callable[[Exception], None]:
        def report(error: Exception) -> None:
            send_safely(crash_sink, job_crash_report(job, error, app_version, clock.now()))

        return report

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Each job with how often it runs; 0 turns it off (tests run them themselves).
        schedule = [
            ("reminder job", app.state.reminders.send_due, settings.reminder_check_seconds),
            ("archive purge job", app.state.archive.purge_due, settings.purge_check_seconds),
        ]
        jobs = [
            asyncio.create_task(run_regularly(work, every_seconds, crash_reporter(name)))
            for name, work, every_seconds in schedule
            if every_seconds > 0
        ]
        yield
        for job in jobs:
            job.cancel()
            with suppress(asyncio.CancelledError):
                await job
        engine.dispose()

    app = FastAPI(title="Kita Kids Database", lifespan=lifespan)
    app.state.mailer = mailer
    identity = Identity.from_settings(engine, clock, reporting_mailer, settings)
    app.include_router(identity_router(identity, settings))
    app.include_router(email_verification_router(identity))
    app.include_router(password_reset_router(identity))
    children = Children(engine, clock)
    audit = Audit(engine, clock)
    audited_route_class = audited_route(audit, engine)
    parents = Parents(engine, clock, cipher)
    contacts = Contacts(engine, cipher)
    alerts = Alerts(engine, cipher)
    attendance = Attendance(engine, clock, cipher)
    consents = Consents(engine, clock)
    photos = Photos(
        engine, clock, cipher, file_store or DiskFileStore(settings.photo_folder), consents
    )
    groups = Groups(engine)
    # Kept on the app for the purge job, and for tests, which run it themselves.
    app.state.archive = archive = Archive(engine, clock, photos, settings.archive_retention_months)
    app.include_router(staff_router(identity, groups))
    app.include_router(
        children_router(
            identity,
            children,
            parents,
            contacts,
            alerts,
            attendance,
            consents,
            photos,
            groups,
            archive,
            audited_route_class,
        )
    )
    app.include_router(archive_router(identity, archive, audited_route_class))
    app.include_router(parents_router(identity, parents, photos, audited_route_class))
    incidents = Incidents(engine, clock, cipher)
    app.include_router(incidents_router(identity, incidents, audited_route_class))
    held = HeldData(
        children, parents, contacts, alerts, consents, photos, attendance, incidents, groups
    )
    data_requests = DataRequests(engine, clock, held)
    app.include_router(data_requests_router(identity, data_requests, photos, audited_route_class))
    app.include_router(audit_router(identity, audit, children))
    birthdays = Birthdays(engine)
    app.include_router(
        groups_router(identity, groups, alerts, attendance, birthdays, audited_route_class)
    )
    emergency_lists = EmergencyLists(clock, children, groups, attendance, alerts, parents, contacts)
    app.include_router(emergency_list_router(identity, emergency_lists, audited_route_class))
    app.include_router(tasks_router(identity, Tasks(engine, clock)))
    events = Events(engine, clock)
    app.include_router(events_router(identity, events))
    holidays = Holidays(engine)
    app.include_router(holidays_router(identity, holidays))
    app.include_router(calendar_router(identity, events, birthdays, holidays))
    feedback_to = settings.feedback_email or settings.crash_report_email
    feedbacks = Feedbacks(engine, clock, cipher, reporting_mailer, feedback_to)
    app.include_router(feedback_router(identity, feedbacks))
    # Kept on the app for the Reminder job, and for tests, which run it themselves.
    app.state.reminders = Reminders(engine, clock, reporting_mailer, events, settings.public_url)

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
