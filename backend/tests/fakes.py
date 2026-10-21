from dataclasses import dataclass, field
from datetime import UTC, datetime

from kita.mail import Email


@dataclass
class FixedClock:
    """A Clock that returns whatever time the test sets."""

    now_value: datetime = datetime(2027, 1, 4, 8, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.now_value


@dataclass
class CapturingMailer:
    """A Mailer that keeps sent emails in memory instead of sending them."""

    outbox: list[Email] = field(default_factory=list)

    def send(self, email: Email) -> None:
        self.outbox.append(email)
