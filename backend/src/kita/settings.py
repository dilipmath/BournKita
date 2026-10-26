from pydantic_settings import BaseSettings, SettingsConfigDict


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
