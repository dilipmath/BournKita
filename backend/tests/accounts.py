"""Helpers for tests that need accounts and logins."""

import re

import httpx2
from fastapi.testclient import TestClient

from kita import cli
from kita.settings import Settings
from tests.fakes import CapturingMailer

ADMIN_EMAIL = "leitung@kita.example"
PASSWORD = "correct horse battery"
NEW_PASSWORD = "a brand new password"


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
