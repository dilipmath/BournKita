from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from kita.app import create_app
from kita.settings import Settings
from tests.fakes import CapturingMailer, FixedClock


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock()


@pytest.fixture
def mailer() -> CapturingMailer:
    return CapturingMailer()


@pytest.fixture
def client(clock: FixedClock, mailer: CapturingMailer) -> Iterator[TestClient]:
    app = create_app(Settings(), clock=clock, mailer=mailer)
    with TestClient(app) as test_client:
        yield test_client
