from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# How the connection to the mail server is secured: STARTTLS (usually port 587), TLS from the
# start (465), or not at all (only for a local mail catcher such as Mailpit).
SmtpSecurity = Literal["starttls", "tls", "none"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KITA_")

    database_url: str = "postgresql+psycopg://kita:kita@localhost:5433/kita"
    database_connect_timeout_seconds: int = 2
    # Crash reports are always logged; set this to also email them to the developer.
    crash_report_email: str | None = None
    # A session ends after this long without a request.
    session_inactivity_minutes: int = 30
    # Off only for plain-HTTP development outside localhost; production runs behind HTTPS.
    session_cookie_secure: bool = True
    # Where Staff members open the app; links in emails point here.
    public_url: str = "http://localhost:8080"
    # Mail server for outgoing email. Unset: emails are only written to the server log.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_security: SmtpSecurity = "starttls"
    smtp_username: str | None = None
    smtp_password: str | None = None
    mail_from: str = "Kita Kids Database <kita@localhost>"
    # Encrypts sensitive fields; required to start. `kita-admin generate-key` makes one.
    encryption_key: SecretStr | None = None
    # Where photo files are kept (encrypted), e.g. on the Kita's network drive.
    photo_folder: Path = Path("photos")
    # How often the Reminder job looks for Event Reminders due; 0: never (tests run it themselves).
    reminder_check_seconds: int = 300
    # How long a deleted Child profile stays in the archive before it is purged with all its
    # data; set by the Kita's data-protection assessment.
    archive_retention_months: int = Field(default=12, ge=1)
    # How often the purge job looks for archived Children whose retention period has ended; 0:
    # never (tests run it themselves).
    purge_check_seconds: int = 3600
    # Where feedback from the app's pages is emailed; unset: to crash_report_email, and with
    # neither, feedback is only stored.
    feedback_email: str | None = None
