from datetime import timedelta

from fastapi.testclient import TestClient

from kita.settings import Settings
from tests.accounts import (
    ADMIN_EMAIL,
    NEW_PASSWORD,
    create_admin,
    log_in,
    reset_password_status,
    reset_token,
)
from tests.fakes import CapturingMailer, FixedClock


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
