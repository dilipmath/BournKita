from dataclasses import dataclass, field
from datetime import UTC, datetime

from kita.crash import CrashReport
from kita.mail import Email, MailNotSent
from kita.photos import FileNotStored


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


@dataclass
class RecordingCrashSink:
    """A CrashReportSink that keeps reports in memory instead of forwarding them."""

    reports: list[CrashReport] = field(default_factory=list)

    def send(self, report: CrashReport) -> None:
        self.reports.append(report)


@dataclass
class OutageMailer(CapturingMailer):
    """A CapturingMailer whose mail server can go down (`down = True`) and come back."""

    down: bool = False

    def send(self, email: Email) -> None:
        if self.down:
            raise MailNotSent("mail server unreachable") from ConnectionRefusedError()
        super().send(email)


@dataclass
class MemoryFileStore:
    """A FileStore that keeps files in memory instead of on disk."""

    files: dict[str, bytes] = field(default_factory=dict)

    def put(self, name: str, data: bytes) -> None:
        self.files[name] = data

    def get(self, name: str) -> bytes:
        if name not in self.files:
            raise FileNotStored(name)
        return self.files[name]

    def delete(self, name: str) -> None:
        self.files.pop(name, None)
