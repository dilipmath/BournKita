import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

from kita.settings import Settings, SmtpSecurity

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    body: str


class MailNotSent(Exception):
    """The email could not be handed to the mail server."""


class Mailer(Protocol):
    def send(self, email: Email) -> None:
        """Raises MailNotSent when the email cannot be sent."""
        ...


class SmtpMailer:
    """Sends emails through an SMTP server."""

    def __init__(
        self,
        host: str,
        port: int,
        security: SmtpSecurity,
        username: str | None,
        password: str | None,
        sender: str,
        timeout_seconds: float = 10,
        ssl_context: ssl.SSLContext | None = None,
    ) -> None:
        if bool(username) != bool(password):
            raise ValueError("Set both the SMTP username and password, or neither.")
        self._host = host
        self._port = port
        self._security = security
        self._username = username
        self._password = password
        self._sender = sender
        self._timeout_seconds = timeout_seconds
        # The system's trusted certificate authorities unless told otherwise (tests use their own).
        self._ssl_context = ssl_context or ssl.create_default_context()

    @classmethod
    def from_settings(cls, host: str, settings: Settings) -> "SmtpMailer":
        return cls(
            host=host,
            port=settings.smtp_port,
            security=settings.smtp_security,
            username=settings.smtp_username,
            password=settings.smtp_password,
            sender=settings.mail_from,
        )

    def send(self, email: Email) -> None:
        try:
            # Building the message rejects line breaks in headers, so nothing can be injected.
            message = EmailMessage()
            message["From"] = self._sender
            message["To"] = email.to
            message["Subject"] = email.subject
            message.set_content(email.body)
            with self._connect() as server:
                if self._username and self._password:
                    server.login(self._username, self._password)
                server.send_message(message)
        except (OSError, ValueError, smtplib.SMTPException) as error:
            raise MailNotSent(f"Could not send email via {self._host}:{self._port}") from error

    def _connect(self) -> smtplib.SMTP:
        if self._security == "tls":
            return smtplib.SMTP_SSL(
                self._host, self._port, timeout=self._timeout_seconds, context=self._ssl_context
            )
        server = smtplib.SMTP(self._host, self._port, timeout=self._timeout_seconds)
        if self._security == "starttls":
            try:
                server.starttls(context=self._ssl_context)
            except BaseException:
                server.close()
                raise
        return server


class LogMailer:
    """Fallback when no mail server is configured: logs emails, links included, instead of
    sending them, so a developer can follow them from the server log."""

    def send(self, email: Email) -> None:
        logger.warning(
            "Email NOT sent (no mail server configured)\nTo: %s\nSubject: %s\n\n%s",
            email.to,
            email.subject,
            email.body,
        )


def mailer_from_settings(settings: Settings) -> Mailer:
    """The SMTP Mailer when a mail server is configured, otherwise the log Mailer."""
    if not settings.smtp_host:
        return LogMailer()
    return SmtpMailer.from_settings(settings.smtp_host, settings)
