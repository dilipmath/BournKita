import logging
from collections.abc import Callable
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from kita.settings import Settings
from tests.accounts import (
    ADMIN_EMAIL,
    NEW_PASSWORD,
    PASSWORD,
    TEACHER_EMAIL,
    create_admin,
    log_in,
    onboard,
    reset_password_status,
    reset_token,
)
from tests.fakes import CapturingMailer, FixedClock, RecordingCrashSink


def fail_logins(client: TestClient, times: int) -> None:
    for _ in range(times):
        assert log_in(client, password="not the password").status_code == 401


def test_five_failed_logins_lock_the_account_even_for_the_right_password(
    settings: Settings, client: TestClient
) -> None:
    create_admin(settings)

    fail_logins(client, 5)
    response = log_in(client)

    # The same answer as a wrong password, so locking cannot be used to find out which
    # email addresses have accounts.
    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_credentials"}
    assert client.get("/api/session").status_code == 401


def test_a_locked_account_unlocks_after_fifteen_minutes(
    settings: Settings, client: TestClient, clock: FixedClock
) -> None:
    create_admin(settings)
    fail_logins(client, 5)

    clock.now_value += timedelta(minutes=14, seconds=59)
    still_locked = log_in(client)
    clock.now_value += timedelta(seconds=1)
    unlocked = log_in(client)

    assert still_locked.status_code == 401
    assert unlocked.status_code == 200


def test_a_successful_login_starts_the_count_again(settings: Settings, client: TestClient) -> None:
    create_admin(settings)
    fail_logins(client, 4)
    assert log_in(client).status_code == 200

    fail_logins(client, 4)

    assert log_in(client).status_code == 200


def test_failed_logins_for_an_unknown_email_lock_nobody(
    settings: Settings, client: TestClient
) -> None:
    create_admin(settings)

    for _ in range(5):
        log_in(client, email="someone@kita.example", password="not the password")

    assert log_in(client).status_code == 200


def test_resetting_the_password_unlocks_the_account(
    settings: Settings, client: TestClient, mailer: CapturingMailer
) -> None:
    create_admin(settings)
    fail_logins(client, 5)

    client.post("/api/password-resets", json={"email": ADMIN_EMAIL})
    assert reset_password_status(client, reset_token(mailer, ADMIN_EMAIL)) == 204

    assert log_in(client, password=NEW_PASSWORD).status_code == 200


def test_a_lockout_is_logged_and_reported_like_a_crash_by_account_number(
    admin: TestClient,
    new_client: Callable[[], TestClient],
    mailer: CapturingMailer,
    crash_sink: RecordingCrashSink,
    clock: FixedClock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    teacher_id, _ = onboard(admin, new_client, mailer)
    guesser = new_client()

    with caplog.at_level(logging.INFO):
        for _ in range(5):
            log_in(guesser, email=TEACHER_EMAIL, password="a wrong guess")

    [report] = crash_sink.reports
    assert (report.error_type, report.location) == ("AccountLocked", f"Staff account {teacher_id}")
    assert report.occurred_at == clock.now_value
    locked = [record.getMessage() for record in caplog.records if "locked" in record.getMessage()]
    assert locked == [
        f"Staff account {teacher_id} locked until {clock.now_value + timedelta(minutes=15):%Y-%m-%d %H:%M} UTC after 5 failed logins"
    ]
    logged = caplog.text + repr(report)
    assert TEACHER_EMAIL not in logged and "a wrong guess" not in logged


def test_failed_logins_are_logged_without_the_email_or_password_typed_in(
    admin: TestClient,
    new_client: Callable[[], TestClient],
    mailer: CapturingMailer,
    caplog: pytest.LogCaptureFixture,
) -> None:
    teacher_id, _ = onboard(admin, new_client, mailer)
    guesser = new_client()

    with caplog.at_level(logging.INFO, logger="kita"):
        log_in(guesser, email=TEACHER_EMAIL, password="first wrong guess")
        log_in(guesser, email=TEACHER_EMAIL, password="second wrong guess")
        log_in(guesser, email="nobody@kita.example", password="third wrong guess")

    assert [record.getMessage() for record in caplog.records if record.name.startswith("kita")] == [
        f"Failed login for Staff account {teacher_id} (1 in a row) from testclient",
        f"Failed login for Staff account {teacher_id} (2 in a row) from testclient",
        "Failed login for no active Staff account from testclient",
    ]
    assert "guess" not in caplog.text and "kita.example" not in caplog.text


def from_address(address: str) -> dict[str, str]:
    """The header with which the web server passes on where a request came from."""
    return {"X-Kita-Client-Address": address}


def test_twenty_failed_logins_from_one_address_refuse_its_logins_for_ten_minutes(
    settings: Settings,
    client: TestClient,
    clock: FixedClock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    create_admin(settings)
    tablet = from_address("192.168.1.23")
    # Different accounts each time, so no account gets locked: only the address is limited.
    for number in range(20):
        response = client.post(
            "/api/session",
            json={"email": f"guess{number}@kita.example", "password": "a guess"},
            headers=tablet,
        )
        assert response.status_code == 401

    with caplog.at_level(logging.INFO, logger="kita"):
        refused = client.post(
            "/api/session", json={"email": ADMIN_EMAIL, "password": PASSWORD}, headers=tablet
        )
    elsewhere = client.post(
        "/api/session",
        json={"email": ADMIN_EMAIL, "password": PASSWORD},
        headers=from_address("192.168.1.24"),
    )
    clock.now_value += timedelta(minutes=10)
    later = client.post(
        "/api/session", json={"email": ADMIN_EMAIL, "password": PASSWORD}, headers=tablet
    )

    assert refused.status_code == 429
    assert refused.json() == {"detail": "too_many_attempts"}
    assert refused.headers["Retry-After"] == "600"
    assert "Login refused from 192.168.1.23: too many failed logins" in caplog.text
    assert elsewhere.status_code == 200
    assert later.status_code == 200


def test_an_admin_sees_a_locked_account_and_unlocks_it(
    admin: TestClient,
    new_client: Callable[[], TestClient],
    mailer: CapturingMailer,
) -> None:
    teacher_id, _ = onboard(admin, new_client, mailer)
    tablet = new_client()
    for _ in range(5):
        log_in(tablet, email=TEACHER_EMAIL, password="a wrong guess")

    locked = {account["id"]: account["locked"] for account in admin.get("/api/staff").json()}
    unlocked = admin.delete(f"/api/staff/{teacher_id}/lock")

    assert locked[teacher_id] is True
    assert unlocked.status_code == 200
    assert unlocked.json()["locked"] is False
    assert log_in(tablet, email=TEACHER_EMAIL).status_code == 200
