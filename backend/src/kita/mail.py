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
    """Development mailer: logs emails instead of sending them. Replaced by SMTP later."""

    def send(self, email: Email) -> None:
        logger.info("Email to %s: %s", email.to, email.subject)
