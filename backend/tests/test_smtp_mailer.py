"""Adapter tests: the SMTP Mailer against a real (in-process) SMTP server."""

import socket
import ssl
from collections.abc import Iterator
from email import message_from_bytes
from email.message import Message
from email.policy import default
from typing import Any

import pytest
import trustme
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult, Envelope, LoginPassword, Session

from kita.mail import Email, MailNotSent, SmtpMailer
from kita.settings import SmtpSecurity

EMAIL = Email(
    to="erzieherin@kita.example",
    subject="Bitte bestätigen / Please verify",
    body="Hallo Jörg,\nfür Sie wurde ein Zugang angelegt: https://kita.local/verify?x=1",
)


class Inbox:
    def __init__(self) -> None:
        self.envelopes: list[Envelope] = []

    async def handle_DATA(self, server: object, session: Session, envelope: Envelope) -> str:
        self.envelopes.append(envelope)
        return "250 OK"

    def messages(self) -> list[Message]:
        return [
            message_from_bytes(envelope.original_content or b"", policy=default)
            for envelope in self.envelopes
        ]


def only_kita_login(
    server: object, session: Session, envelope: Envelope, mechanism: str, auth_data: Any
) -> AuthResult:
    accepted = isinstance(auth_data, LoginPassword) and (auth_data.login, auth_data.password) == (
        b"kita",
        b"mail secret",
    )
    return AuthResult(success=accepted)


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port: int = probe.getsockname()[1]
        return port


@pytest.fixture(scope="module")
def certificate_authority() -> trustme.CA:
    return trustme.CA()


@pytest.fixture
def server_tls(certificate_authority: trustme.CA) -> ssl.SSLContext:
    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    certificate_authority.issue_cert("127.0.0.1").configure_cert(context)
    return context


@pytest.fixture
def client_tls(certificate_authority: trustme.CA) -> ssl.SSLContext:
    context = ssl.create_default_context()
    certificate_authority.configure_trust(context)
    return context


def run_server(**options: Any) -> Iterator[tuple[int, Inbox]]:
    inbox = Inbox()
    port = free_port()
    controller = Controller(inbox, hostname="127.0.0.1", port=port, **options)
    controller.start()
    yield port, inbox
    controller.stop()


@pytest.fixture
def plain_server() -> Iterator[tuple[int, Inbox]]:
    yield from run_server()


@pytest.fixture
def starttls_server(server_tls: ssl.SSLContext) -> Iterator[tuple[int, Inbox]]:
    # Like most mail providers: STARTTLS is mandatory and login only works after it.
    yield from run_server(
        tls_context=server_tls,
        require_starttls=True,
        authenticator=only_kita_login,
        auth_require_tls=True,
    )


@pytest.fixture
def tls_server(server_tls: ssl.SSLContext) -> Iterator[tuple[int, Inbox]]:
    yield from run_server(ssl_context=server_tls)


def mailer(
    port: int,
    security: SmtpSecurity = "none",
    username: str | None = None,
    password: str | None = None,
    ssl_context: ssl.SSLContext | None = None,
    sender: str = "Kita Kids Database <kita@kita.example>",
) -> SmtpMailer:
    return SmtpMailer(
        host="127.0.0.1",
        port=port,
        security=security,
        username=username,
        password=password,
        sender=sender,
        ssl_context=ssl_context,
    )


def test_sends_the_email_with_sender_recipient_subject_and_body(
    plain_server: tuple[int, Inbox],
) -> None:
    port, inbox = plain_server

    mailer(port).send(EMAIL)

    [envelope] = inbox.envelopes
    assert envelope.rcpt_tos == ["erzieherin@kita.example"]
    [message] = inbox.messages()
    assert message["From"] == "Kita Kids Database <kita@kita.example>"
    assert message["To"] == "erzieherin@kita.example"
    assert message["Subject"] == "Bitte bestätigen / Please verify"
    body = message.get_content()  # type: ignore[attr-defined]
    assert "Hallo Jörg," in body
    assert "https://kita.local/verify?x=1" in body


def test_logs_in_after_starttls(
    starttls_server: tuple[int, Inbox], client_tls: ssl.SSLContext
) -> None:
    port, inbox = starttls_server

    mailer(port, "starttls", "kita", "mail secret", client_tls).send(EMAIL)

    assert [envelope.rcpt_tos for envelope in inbox.envelopes] == [["erzieherin@kita.example"]]


def test_a_wrong_login_raises_mail_not_sent(
    starttls_server: tuple[int, Inbox], client_tls: ssl.SSLContext
) -> None:
    port, inbox = starttls_server

    with pytest.raises(MailNotSent):
        mailer(port, "starttls", "kita", "wrong", client_tls).send(EMAIL)
    assert inbox.envelopes == []


def test_sends_over_implicit_tls(tls_server: tuple[int, Inbox], client_tls: ssl.SSLContext) -> None:
    port, inbox = tls_server

    mailer(port, "tls", ssl_context=client_tls).send(EMAIL)

    assert len(inbox.envelopes) == 1


def test_does_not_trust_an_unknown_certificate(tls_server: tuple[int, Inbox]) -> None:
    port, inbox = tls_server

    with pytest.raises(MailNotSent):
        mailer(port, "tls").send(EMAIL)
    assert inbox.envelopes == []


def test_a_line_break_in_a_header_raises_mail_not_sent(plain_server: tuple[int, Inbox]) -> None:
    port, inbox = plain_server

    with pytest.raises(MailNotSent):
        mailer(port, sender="kita@kita.example\r\nBcc: everyone@example.org").send(EMAIL)
    assert inbox.envelopes == []


def test_an_unreachable_mail_server_raises_mail_not_sent() -> None:
    with pytest.raises(MailNotSent):
        mailer(free_port()).send(EMAIL)
