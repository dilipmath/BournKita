from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from kita.app import create_app
from kita.settings import Settings
from tests.fakes import CapturingMailer, FixedClock, RecordingCrashSink


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock()


@pytest.fixture
def mailer() -> CapturingMailer:
    return CapturingMailer()


@pytest.fixture
def crash_sink() -> RecordingCrashSink:
    return RecordingCrashSink()


@pytest.fixture
def app(clock: FixedClock, mailer: CapturingMailer, crash_sink: RecordingCrashSink) -> FastAPI:
    return create_app(Settings(), clock=clock, mailer=mailer, crash_sink=crash_sink)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    # Crashes must reach the app's error handling and come back as 500s, as they would in production.
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
