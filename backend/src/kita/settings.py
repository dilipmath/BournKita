from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KITA_")

    database_url: str = "postgresql+psycopg://kita:kita@localhost:5433/kita"
    database_connect_timeout_seconds: int = 2
    # Where crash reports go. Unset: they are only logged on the server.
    crash_report_email: str | None = None
