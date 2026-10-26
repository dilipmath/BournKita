from collections.abc import Callable, Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, make_url, text

from kita.app import create_app
from kita.db import metadata, migrate
from kita.settings import Settings
from tests.accounts import create_admin, log_in
from tests.fakes import FixedClock, OutageMailer, RecordingCrashSink


@pytest.fixture(scope="session")
def settings() -> Settings:
    """Settings for a separate test database, so tests never touch development data."""
    dev_url = make_url(Settings().database_url)
    test_url = dev_url.set(database=f"{dev_url.database}_test")
    admin = create_engine(dev_url, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        exists = connection.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": test_url.database}
        )
        if not exists:
            connection.execute(text(f'CREATE DATABASE "{test_url.database}"'))
    admin.dispose()
    settings = Settings(database_url=test_url.render_as_string(hide_password=False))
    migrate(settings.database_url)
    return settings


@pytest.fixture(autouse=True)
def empty_database(settings: Settings) -> None:
    engine = create_engine(settings.database_url)
    with engine.begin() as connection:
        tables = ", ".join(f'"{table.name}"' for table in metadata.sorted_tables)
        if tables:
            connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    engine.dispose()


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock()


@pytest.fixture
def mailer() -> OutageMailer:
    return OutageMailer()


@pytest.fixture
def crash_sink() -> RecordingCrashSink:
    return RecordingCrashSink()


@pytest.fixture
def app(
    settings: Settings,
    clock: FixedClock,
    mailer: OutageMailer,
    crash_sink: RecordingCrashSink,
) -> FastAPI:
    return create_app(settings, clock=clock, mailer=mailer, crash_sink=crash_sink)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    # Crashes must reach the app's error handling and come back as 500s, as they would in production.
    with TestClient(
        app, base_url="https://testserver", raise_server_exceptions=False
    ) as test_client:
        yield test_client


@pytest.fixture
def new_client(app: FastAPI) -> Iterator[Callable[[], TestClient]]:
    """Makes further clients, one per Staff member, each with its own cookies."""
    clients: list[TestClient] = []

    def make() -> TestClient:
        test_client = TestClient(app, base_url="https://testserver", raise_server_exceptions=False)
        clients.append(test_client.__enter__())
        return test_client

    yield make
    for test_client in clients:
        test_client.__exit__(None, None, None)


@pytest.fixture
def admin(settings: Settings, client: TestClient) -> TestClient:
    """A client logged in as the first Admin."""
    assert create_admin(settings) == 0
    assert log_in(client).status_code == 200
    return client
