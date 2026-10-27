from datetime import UTC, datetime

from fastapi.testclient import TestClient

from kita.app import create_app
from kita.settings import Settings
from tests.fakes import CapturingMailer, FixedClock


def test_health_reports_api_and_database_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "ok"


def test_health_reports_server_time_from_the_clock(
    client: TestClient, clock: FixedClock
) -> None:
    clock.now_value = datetime(2027, 3, 1, 7, 30, tzinfo=UTC)

    response = client.get("/api/health")

    assert response.json()["time"] == "2027-03-01T07:30:00Z"


def test_health_reports_database_unavailable_when_it_cannot_connect(
    settings: Settings, clock: FixedClock, mailer: CapturingMailer
) -> None:
    unreachable = settings.model_copy(
        update={"database_url": "postgresql+psycopg://kita:kita@localhost:1/kita"}
    )
    with TestClient(create_app(unreachable, clock=clock, mailer=mailer)) as client:
        response = client.get("/api/health")

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["database"] == "unavailable"
