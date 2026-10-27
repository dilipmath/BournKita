from collections.abc import Callable
from datetime import timedelta

from fastapi.testclient import TestClient

from tests.accounts import (
    ADMIN_EMAIL,
    NEW_PASSWORD,
    PASSWORD,
    log_in,
    reset_password_status,
    reset_token,
    verification_token,
)
from tests.fakes import CapturingMailer, FixedClock, OutageMailer, RecordingCrashSink


def test_a_staff_member_resets_a_forgotten_password_with_the_emailed_link(
    admin: TestClient, mailer: CapturingMailer
) -> None:
    requested = admin.post("/api/password-resets", json={"email": "Leitung@Kita.example"})
    token = reset_token(mailer, ADMIN_EMAIL)

    response = admin.put("/api/password-resets", json={"token": token, "password": NEW_PASSWORD})

    assert requested.status_code == 202
    assert response.status_code == 204
    assert log_in(admin, password=PASSWORD).status_code == 401
    assert log_in(admin, password=NEW_PASSWORD).status_code == 200


def test_a_reset_link_works_only_once(admin: TestClient, mailer: CapturingMailer) -> None:
    admin.post("/api/password-resets", json={"email": ADMIN_EMAIL})
    token = reset_token(mailer, ADMIN_EMAIL)

    assert reset_password_status(admin, token) == 204
    response = admin.put(
        "/api/password-resets", json={"token": token, "password": "yet another one"}
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_link"}
    assert log_in(admin, password=NEW_PASSWORD).status_code == 200


def test_a_reset_link_expires_after_an_hour(
    admin: TestClient, mailer: CapturingMailer, clock: FixedClock
) -> None:
    admin.post("/api/password-resets", json={"email": ADMIN_EMAIL})
    clock.now_value += timedelta(hours=1)
    assert reset_password_status(admin, reset_token(mailer, ADMIN_EMAIL)) == 400

    admin.post("/api/password-resets", json={"email": ADMIN_EMAIL})
    clock.now_value += timedelta(minutes=59)
    assert reset_password_status(admin, reset_token(mailer, ADMIN_EMAIL)) == 204


def test_a_new_reset_link_replaces_the_previous_one(
    admin: TestClient, mailer: CapturingMailer, clock: FixedClock
) -> None:
    admin.post("/api/password-resets", json={"email": ADMIN_EMAIL})
    first = reset_token(mailer, ADMIN_EMAIL)
    clock.now_value += timedelta(minutes=1)
    admin.post("/api/password-resets", json={"email": ADMIN_EMAIL})

    assert reset_password_status(admin, first) == 400
    assert reset_password_status(admin, reset_token(mailer, ADMIN_EMAIL)) == 204


def test_asking_again_within_a_minute_sends_no_second_email(
    admin: TestClient, mailer: CapturingMailer, clock: FixedClock
) -> None:
    admin.post("/api/password-resets", json={"email": ADMIN_EMAIL})
    first = reset_token(mailer, ADMIN_EMAIL)
    clock.now_value += timedelta(seconds=59)

    response = admin.post("/api/password-resets", json={"email": ADMIN_EMAIL})

    assert response.status_code == 202
    assert len(mailer.outbox) == 1
    assert reset_password_status(admin, first) == 204


def test_asking_for_an_unknown_email_gets_the_same_answer_and_sends_nothing(
    admin: TestClient, mailer: CapturingMailer
) -> None:
    response = admin.post("/api/password-resets", json={"email": "someone@kita.example"})

    assert response.status_code == 202
    assert mailer.outbox == []


def test_a_reset_ends_every_session_of_the_account(
    admin: TestClient, mailer: CapturingMailer, new_client: Callable[[], TestClient]
) -> None:
    # Whoever knew the old password may still be logged in somewhere.
    admin.post("/api/password-resets", json={"email": ADMIN_EMAIL})

    assert reset_password_status(new_client(), reset_token(mailer, ADMIN_EMAIL)) == 204

    assert admin.get("/api/session").status_code == 401


def test_an_invited_staff_member_gets_no_reset_link(
    admin: TestClient, mailer: CapturingMailer
) -> None:
    # They have no password yet; their verification link is how they choose one.
    admin.post("/api/staff", json={"email": "erzieherin@kita.example", "role": "teacher"})

    admin.post("/api/password-resets", json={"email": "erzieherin@kita.example"})

    assert ["reset-password" in email.body for email in mailer.outbox] == [False]


def test_a_reset_email_that_cannot_be_sent_gets_the_same_answer_and_a_crash_report(
    admin: TestClient, mailer: OutageMailer, crash_sink: RecordingCrashSink
) -> None:
    mailer.down = True

    response = admin.post("/api/password-resets", json={"email": ADMIN_EMAIL})

    assert response.status_code == 202
    assert [report.location for report in crash_sink.reports] == ["SMTP"]


def test_deactivating_an_account_voids_its_reset_link(
    admin: TestClient, mailer: CapturingMailer, new_client: Callable[[], TestClient]
) -> None:
    teacher = "erzieherin@kita.example"
    account_id = admin.post("/api/staff", json={"email": teacher, "role": "teacher"}).json()["id"]
    new_client().post(
        "/api/email-verifications",
        json={"token": verification_token(mailer, teacher), "password": PASSWORD},
    )
    admin.post("/api/password-resets", json={"email": teacher})
    token = reset_token(mailer, teacher)

    admin.put(f"/api/staff/{account_id}/active", json={"active": False})
    admin.put(f"/api/staff/{account_id}/active", json={"active": True})

    assert reset_password_status(new_client(), token) == 400
