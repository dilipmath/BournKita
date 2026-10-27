"""Helpers for tests that need accounts and logins."""

import re
from collections.abc import Callable

import httpx2
from fastapi.testclient import TestClient

from kita import cli
from kita.settings import Settings
from tests.fakes import CapturingMailer

ADMIN_EMAIL = "leitung@kita.example"
PASSWORD = "correct horse battery"
NEW_PASSWORD = "a brand new password"
TEACHER_EMAIL = "erzieherin@kita.example"


def create_admin(settings: Settings, email: str = ADMIN_EMAIL, *typed: str) -> int:
    """Runs the setup command; `typed` are the answers to its password prompts."""
    answers = iter(typed or (PASSWORD, PASSWORD))
    return cli.main(
        ["create-admin", "--email", email], settings=settings, read_password=lambda _: next(answers)
    )


def log_in(
    client: TestClient, email: str = ADMIN_EMAIL, password: str = PASSWORD
) -> httpx2.Response:
    return client.post("/api/session", json={"email": email, "password": password})


def verification_token(mailer: CapturingMailer, to: str) -> str:
    """The token from the link in the last verification email sent to `to`."""
    [*_, email] = [email for email in mailer.outbox if email.to == to]
    match = re.search(r"/verify-email\?token=([\w-]+)", email.body)
    assert match, email.body
    return match.group(1)


def reset_token(mailer: CapturingMailer, to: str) -> str:
    """The token from the link in the last password reset email sent to `to`."""
    [*_, email] = [email for email in mailer.outbox if email.to == to]
    match = re.search(r"/reset-password\?token=([\w-]+)", email.body)
    assert match, email.body
    return match.group(1)


def reset_password_status(client: TestClient, token: str, password: str = NEW_PASSWORD) -> int:
    """Resets the password with the token from a reset link; returns the status code."""
    response = client.put("/api/password-resets", json={"token": token, "password": password})
    return response.status_code


def invite(admin: TestClient, email: str = TEACHER_EMAIL, role: str = "teacher") -> int:
    response = admin.post("/api/staff", json={"email": email, "role": role})
    assert response.status_code == 201, response.text
    account_id: int = response.json()["id"]
    return account_id


def onboard(
    admin: TestClient,
    new_client: Callable[[], TestClient],
    mailer: CapturingMailer,
    email: str = TEACHER_EMAIL,
    role: str = "teacher",
) -> tuple[int, TestClient]:
    """Invites a Staff member, verifies their email and logs them in."""
    account_id = invite(admin, email, role)
    staff_member = new_client()
    verified = staff_member.post(
        "/api/email-verifications",
        json={"token": verification_token(mailer, email), "password": PASSWORD},
    )
    assert verified.status_code == 204
    assert log_in(staff_member, email).status_code == 200
    return account_id, staff_member
