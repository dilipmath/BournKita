from datetime import timedelta

from fastapi.testclient import TestClient

from kita.settings import Settings
from tests.accounts import ADMIN_EMAIL as EMAIL
from tests.accounts import PASSWORD, create_admin, log_in
from tests.fakes import FixedClock


def test_first_admin_created_by_the_setup_command_can_log_in(
    settings: Settings, client: TestClient
) -> None:
    assert create_admin(settings, "Leitung@Kita.example") == 0

    response = log_in(client)

    assert response.status_code == 200
    session = {"email": EMAIL, "role": "admin", "inactivityTimeoutMinutes": 30}
    assert response.json() == session
    assert client.get("/api/session").json() == session


def test_wrong_password_and_unknown_email_get_the_same_clear_rejection(
    settings: Settings, client: TestClient
) -> None:
    create_admin(settings)

    wrong_password = log_in(client, password="not the password")
    unknown_email = log_in(client, email="someone@kita.example")

    for response in (wrong_password, unknown_email):
        assert response.status_code == 401
        assert response.json() == {"detail": "invalid_credentials"}
    assert client.get("/api/session").status_code == 401


def test_logout_ends_the_session(settings: Settings, client: TestClient) -> None:
    create_admin(settings)
    log_in(client)
    token = client.cookies["kita_session"]

    assert client.delete("/api/session").status_code == 204

    assert client.get("/api/session").status_code == 401
    # The old token is dead on the server too, not just removed from the browser.
    client.cookies.set("kita_session", token)
    assert client.get("/api/session").status_code == 401


def test_logging_in_again_ends_the_previous_session_of_that_browser(
    settings: Settings, client: TestClient
) -> None:
    create_admin(settings)
    log_in(client)
    first_token = client.cookies["kita_session"]

    log_in(client)

    client.cookies.set("kita_session", first_token)
    assert client.get("/api/session").status_code == 401


def test_session_expires_after_30_minutes_without_activity(
    settings: Settings, client: TestClient, clock: FixedClock
) -> None:
    create_admin(settings)
    log_in(client)

    clock.now_value += timedelta(minutes=30)

    assert client.get("/api/session").status_code == 401


def test_activity_keeps_the_session_alive(
    settings: Settings, client: TestClient, clock: FixedClock
) -> None:
    create_admin(settings)
    log_in(client)

    for _ in range(3):
        clock.now_value += timedelta(minutes=29)
        assert client.get("/api/session").status_code == 200


def test_setup_command_only_creates_the_first_admin(settings: Settings, client: TestClient) -> None:
    assert create_admin(settings) == 0

    assert create_admin(settings, "intruder@kita.example") != 0

    assert log_in(client, "intruder@kita.example").status_code == 401


def test_setup_command_rejects_a_short_or_mistyped_password(
    settings: Settings, client: TestClient
) -> None:
    assert create_admin(settings, EMAIL, "too short", "too short") != 0
    assert create_admin(settings, EMAIL, PASSWORD, "correct horse batery") != 0

    assert log_in(client, password="too short").status_code == 401
    assert log_in(client).status_code == 401
