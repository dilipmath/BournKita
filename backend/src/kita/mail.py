import logging
from dataclasses import dataclass
from typing import Protocol

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    body: str


class Mailer(Protocol):
    def send(self, email: Email) -> None: ...


class LogMailer:
    """Development mailer: logs emails, links included, instead of sending them, so a developer
    can follow them from the server log. Replaced by SMTP later."""

    def send(self, email: Email) -> None:
        logger.warning(
            "Email NOT sent (no mail server configured)\nTo: %s\nSubject: %s\n\n%s",
            email.to,
            email.subject,
            email.body,
        )
