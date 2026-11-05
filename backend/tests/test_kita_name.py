from pathlib import Path

from fastapi.testclient import TestClient

from kita.app import create_app
from kita.settings import Settings
from tests.fakes import CapturingMailer, FixedClock
from tests.photos import jpeg


def client_with(
    settings: Settings, clock: FixedClock, mailer: CapturingMailer, **changes: object
) -> TestClient:
    app = create_app(settings.model_copy(update=changes), clock=clock, mailer=mailer)
    return TestClient(app, base_url="https://testserver")


def test_without_a_name_the_kita_has_none_and_no_logo(client: TestClient) -> None:
    kita = client.get("/api/kita")

    assert kita.status_code == 200
    assert kita.json() == {"name": None, "hasLogo": False}
    assert client.get("/api/kita/logo").status_code == 404


def test_the_kitas_name_and_logo_are_there_without_logging_in(
    settings: Settings, clock: FixedClock, mailer: CapturingMailer, tmp_path: Path
) -> None:
    logo = tmp_path / "logo.jpg"
    logo.write_bytes(jpeg(200, 200))
    with client_with(settings, clock, mailer, name="Kita Sonnenschein", logo=logo) as client:
        assert client.get("/api/kita").json() == {"name": "Kita Sonnenschein", "hasLogo": True}
        served = client.get("/api/kita/logo")

    assert served.status_code == 200
    assert served.headers["content-type"] == "image/jpeg"
    assert served.content == logo.read_bytes()


def test_a_logo_that_is_not_a_picture_is_not_served(
    settings: Settings, clock: FixedClock, mailer: CapturingMailer, tmp_path: Path
) -> None:
    # An SVG could carry scripts; a missing file is a mistake in .env. Neither is served.
    script = tmp_path / "logo.svg"
    script.write_text("<svg><script>alert(1)</script></svg>")
    for path in (script, tmp_path / "missing.png"):
        with client_with(settings, clock, mailer, logo=path) as client:
            assert client.get("/api/kita").json()["hasLogo"] is False
            assert client.get("/api/kita/logo").status_code == 404
