import itertools
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from kita.app import create_app
from kita.crash import CrashReport
from kita.settings import Settings
from tests.fakes import CapturingMailer, FixedClock, RecordingCrashSink


def test_unhandled_api_error_produces_a_report(
    app: FastAPI, client: TestClient, crash_sink: RecordingCrashSink, clock: FixedClock
) -> None:
    clock.now_value = datetime(2027, 2, 3, 9, 15, tzinfo=UTC)

    @app.get("/api/test-crash/{thing_id}")
    def crash(thing_id: int) -> None:
        raise ValueError("boom")

    response = client.get("/api/test-crash/42")

    assert response.status_code == 500
    [report] = crash_sink.reports
    assert report.source == "api"
    assert report.error_type == "ValueError"
    assert report.location == "GET /api/test-crash/{thing_id}"
    assert report.version == "0.1.0"
    assert report.occurred_at == clock.now_value
    assert any(frame.startswith("tests/test_crash_reports.py:") for frame in report.frames)


# Text shaped like names, addresses, email addresses and health notes. Each value holds a character
# no report can contain (umlaut, comma, @), so a match in a report is always a real leak.
personal_data = st.text(
    alphabet=st.sampled_from(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZäöüßÄÖÜé0123456789 ,.-@"
    ),
    min_size=8,
    max_size=40,
).filter(lambda text: any(char in text for char in ",@äöüßÄÖÜé"))


@pytest.fixture
def leaky_client(app: FastAPI, client: TestClient) -> TestClient:
    """A client for an app with a route that crashes with the request's data in its message."""

    @app.get("/api/test-leak/{name}")
    def leak(name: str, note: str) -> None:
        raise RuntimeError(f"Could not save {name}: {note}")

    return client


@settings(suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
@given(path_value=personal_data, query_value=personal_data)
def test_api_reports_never_contain_the_data_involved(
    leaky_client: TestClient, crash_sink: RecordingCrashSink, path_value: str, query_value: str
) -> None:
    crash_sink.reports.clear()

    leaky_client.get(f"/api/test-leak/{quote(path_value, safe='')}", params={"note": query_value})

    [report] = crash_sink.reports
    assert path_value not in str(report)
    assert query_value not in str(report)


def web_report(**overrides: object) -> dict[str, object]:
    return {
        "errorType": "TypeError",
        "page": "/groups/*",
        "version": "0.0.0",
        "frames": ["/assets/index-a1b2c3.js:1:2345", "/assets/index-a1b2c3.js:1:678"],
        **overrides,
    }


def test_frontend_error_report_reaches_the_sink(
    client: TestClient, crash_sink: RecordingCrashSink, clock: FixedClock
) -> None:
    clock.now_value = datetime(2027, 2, 3, 9, 15, tzinfo=UTC)

    response = client.post("/api/crash-reports", json=web_report())

    assert response.status_code == 202
    [report] = crash_sink.reports
    assert report.source == "web"
    assert report.error_type == "TypeError"
    assert report.location == "/groups/*"
    assert report.version == "0.0.0"
    assert report.frames == ("/assets/index-a1b2c3.js:1:2345", "/assets/index-a1b2c3.js:1:678")
    assert report.occurred_at == clock.now_value


addresses = itertools.count()


@settings(suppress_health_check=[HealthCheck.function_scoped_fixture], deadline=None)
@given(
    field=st.sampled_from(["errorType", "page", "version", "frames"]),
    secret=personal_data,
)
def test_frontend_reports_never_forward_free_text(
    client: TestClient, crash_sink: RecordingCrashSink, field: str, secret: str
) -> None:
    crash_sink.reports.clear()
    value: object = {
        "errorType": f"TypeError {secret}",
        "page": f"/groups/3?child={secret}",
        "version": secret,
        "frames": [f"/assets/index.js:1:2 {secret}"],
    }[field]

    # A new address each time, so the limit per address never turns a report away unchecked.
    address = {"X-Kita-Client-Address": f"10.0.0.{next(addresses)}"}
    response = client.post("/api/crash-reports", json=web_report(**{field: value}), headers=address)

    assert response.status_code in (202, 422)
    assert all(secret not in str(report) for report in crash_sink.reports)


def test_reports_are_emailed_to_the_developer_when_an_address_is_configured(
    settings: Settings, clock: FixedClock, mailer: CapturingMailer
) -> None:
    app_settings = settings.model_copy(update={"crash_report_email": "developer@example.org"})
    with TestClient(create_app(app_settings, clock=clock, mailer=mailer)) as client:
        client.post("/api/crash-reports", json=web_report())

    [email] = mailer.outbox
    assert email.to == "developer@example.org"
    assert "TypeError" in email.subject
    assert "/groups/*" in email.body
    assert "/assets/index-a1b2c3.js:1:2345" in email.body


class FailingCrashSink:
    def send(self, report: CrashReport) -> None:
        raise ConnectionError("mail server down")


def test_a_failing_sink_does_not_turn_a_report_into_another_crash(
    settings: Settings, clock: FixedClock, mailer: CapturingMailer
) -> None:
    app = create_app(settings, clock=clock, mailer=mailer, crash_sink=FailingCrashSink())
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post("/api/crash-reports", json=web_report())

    assert response.status_code == 202


def test_frontend_reports_with_more_than_a_page_section_are_rejected(
    client: TestClient, crash_sink: RecordingCrashSink
) -> None:
    response = client.post("/api/crash-reports", json=web_report(page="/children/anna-mueller"))

    assert response.status_code == 422
    assert crash_sink.reports == []


def test_reports_are_still_logged_in_full_when_emailed(
    settings: Settings,
    clock: FixedClock,
    mailer: CapturingMailer,
    caplog: pytest.LogCaptureFixture,
) -> None:
    app_settings = settings.model_copy(update={"crash_report_email": "developer@example.org"})
    with TestClient(create_app(app_settings, clock=clock, mailer=mailer)) as client:
        client.post("/api/crash-reports", json=web_report())

    assert "TypeError" in caplog.text
    assert "/assets/index-a1b2c3.js:1:2345" in caplog.text


@pytest.mark.parametrize(
    ("backup", "location"),
    [
        ("nightly", "nightly backup"),
        ("weekly", "weekly backup"),
        ("service", "backup service"),
    ],
)
def test_a_failed_backup_is_filed_as_a_crash_report(
    client: TestClient,
    crash_sink: RecordingCrashSink,
    clock: FixedClock,
    backup: str,
    location: str,
) -> None:
    response = client.post("/api/crash-reports/backups", json={"backup": backup})

    assert response.status_code == 202
    [report] = crash_sink.reports
    assert (report.source, report.error_type, report.location) == ("api", "BackupFailed", location)
    assert report.frames == ()
    assert report.occurred_at == clock.now_value


@pytest.mark.parametrize("backup", ["reminder job", "nightly backup", "nightly; rm -rf /", ""])
def test_only_the_backups_can_report_a_failure(
    client: TestClient, crash_sink: RecordingCrashSink, backup: str
) -> None:
    response = client.post("/api/crash-reports/backups", json={"backup": backup})

    assert response.status_code == 422
    assert crash_sink.reports == []


def test_at_most_five_browser_crash_emails_an_hour_and_the_next_counts_the_rest(
    settings: Settings,
    clock: FixedClock,
    mailer: CapturingMailer,
    caplog: pytest.LogCaptureFixture,
) -> None:
    app_settings = settings.model_copy(update={"crash_report_email": "developer@example.org"})
    with TestClient(create_app(app_settings, clock=clock, mailer=mailer)) as client:
        for _ in range(8):
            client.post("/api/crash-reports", json=web_report())
        emailed_at_once = len(mailer.outbox)
        # The API's own reports (here a failed backup) are never held back.
        client.post("/api/crash-reports/backups", json={"backup": "nightly"})
        backup_email = mailer.outbox[-1]
        clock.now_value += timedelta(hours=1)
        client.post("/api/crash-reports", json=web_report(errorType="RangeError"))

    assert emailed_at_once == 5
    # It also says how many browser reports were left out.
    assert backup_email.subject == "Kita crash: BackupFailed in nightly backup"
    assert "3 more crash reports were not emailed" in backup_email.body
    # A new hour, a new allowance.
    assert len(mailer.outbox) == 7
    assert "RangeError" in mailer.outbox[-1].subject
    # Every report is still logged.
    assert caplog.text.count("Crash in web") == 9


def test_too_many_crash_reports_from_one_address_are_refused_for_a_while(
    client: TestClient, crash_sink: RecordingCrashSink, clock: FixedClock
) -> None:
    tablet = {"X-Kita-Client-Address": "192.168.1.23"}
    accepted = [
        client.post("/api/crash-reports", json=web_report(), headers=tablet).status_code
        for _ in range(30)
    ]

    refused = client.post("/api/crash-reports", json=web_report(), headers=tablet)
    elsewhere = client.post(
        "/api/crash-reports", json=web_report(), headers={"X-Kita-Client-Address": "192.168.1.24"}
    )
    clock.now_value += timedelta(minutes=10)
    later = client.post("/api/crash-reports", json=web_report(), headers=tablet)

    assert accepted == [202] * 30
    assert refused.status_code == 429
    assert refused.json() == {"detail": "too_many_reports"}
    assert (elsewhere.status_code, later.status_code) == (202, 202)
    assert len(crash_sink.reports) == 32
