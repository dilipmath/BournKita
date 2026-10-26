from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from kita.app import create_app
from kita.settings import Settings
from tests.accounts import PASSWORD, verification_token
from tests.fakes import FixedClock, OutageMailer, RecordingCrashSink

TEACHER_EMAIL = "erzieherin@kita.example"


def test_an_account_is_still_created_when_its_email_cannot_be_sent(
    admin: TestClient, mailer: OutageMailer, crash_sink: RecordingCrashSink
) -> None:
    mailer.down = True

    response = admin.post("/api/staff", json={"email": TEACHER_EMAIL, "role": "teacher"})

    assert response.status_code == 201
    assert response.json()["emailSent"] is False
    statuses = {a["email"]: a["status"] for a in admin.get("/api/staff").json()}
    assert statuses[TEACHER_EMAIL] == "invited"
    [report] = crash_sink.reports
    assert report.error_type == "ConnectionRefusedError"
    assert report.location == "SMTP"


def test_a_new_link_can_be_sent_once_the_mail_server_is_back(
    admin: TestClient, mailer: OutageMailer
) -> None:
    mailer.down = True
    account_id = admin.post("/api/staff", json={"email": TEACHER_EMAIL, "role": "teacher"}).json()[
        "id"
    ]

    while_down = admin.post(f"/api/staff/{account_id}/invitation")
    mailer.down = False
    when_back = admin.post(f"/api/staff/{account_id}/invitation")

    assert while_down.status_code == 503
    assert while_down.json() == {"detail": "mail_not_sent"}
    assert when_back.status_code == 204
    assert [email.to for email in mailer.outbox] == [TEACHER_EMAIL]


def test_a_sent_email_is_reported_as_sent(admin: TestClient) -> None:
    response = admin.post("/api/staff", json={"email": TEACHER_EMAIL, "role": "teacher"})

    assert response.json()["emailSent"] is True


def test_a_failed_new_link_leaves_the_previous_link_working(
    admin: TestClient, mailer: OutageMailer, new_client: Callable[[], TestClient]
) -> None:
    account_id = admin.post("/api/staff", json={"email": TEACHER_EMAIL, "role": "teacher"}).json()[
        "id"
    ]
    first_link = verification_token(mailer, TEACHER_EMAIL)
    mailer.down = True

    admin.post(f"/api/staff/{account_id}/invitation")

    response = new_client().post(
        "/api/email-verifications", json={"token": first_link, "password": PASSWORD}
    )
    assert response.status_code == 204


def test_the_app_refuses_to_start_with_only_half_the_smtp_login(
    settings: Settings, clock: FixedClock, crash_sink: RecordingCrashSink
) -> None:
    half_configured = settings.model_copy(
        update={"smtp_host": "mail.kita.example", "smtp_username": "kita", "smtp_password": None}
    )

    with pytest.raises(ValueError, match="SMTP username and password"):
        create_app(half_configured, clock=clock, crash_sink=crash_sink)
