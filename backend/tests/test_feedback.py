from collections.abc import Callable
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from kita.app import create_app
from kita.settings import Settings
from tests.accounts import ADMIN_EMAIL, TEACHER_EMAIL, create_admin, log_in, onboard
from tests.fakes import FixedClock, MemoryFileStore, OutageMailer, RecordingCrashSink

DEVELOPER = "entwickler@example.org"
IDEA = {
    "kind": "idea",
    "text": "Could the Today view show who picks each Child up?",
    "page": "/groups/3",
}


@pytest.fixture
def app(
    settings: Settings,
    clock: FixedClock,
    mailer: OutageMailer,
    crash_sink: RecordingCrashSink,
    file_store: MemoryFileStore,
) -> FastAPI:
    """The app with an address for feedback."""
    with_address = settings.model_copy(update={"feedback_email": DEVELOPER})
    return create_app(
        with_address, clock=clock, mailer=mailer, crash_sink=crash_sink, file_store=file_store
    )


def send_feedback(client: TestClient, feedback: dict[str, Any] = IDEA) -> Any:
    return client.post("/api/feedback", json=feedback)


def test_feedback_is_stored_and_emailed_with_its_page_and_sender(
    admin: TestClient, teacher: TestClient, mailer: OutageMailer
) -> None:
    mailer.outbox.clear()

    response = send_feedback(teacher)

    assert response.status_code == 201
    assert response.json() == {"emailed": True}
    [email] = mailer.outbox
    assert email.to == DEVELOPER
    assert email.subject == "Kita feedback: Idea"
    for part in (IDEA["text"], "Page: /groups/3", f"From: {TEACHER_EMAIL}"):
        assert part in email.body
    # From the Teacher who sent it, not from whoever reads it.
    assert ADMIN_EMAIL not in email.body
    assert admin.get("/api/feedback").json() == [
        {**IDEA, "id": 1, "sentBy": TEACHER_EMAIL, "sentAt": "2027-01-04T08:00:00Z"}
    ]


def test_feedback_is_kept_when_its_email_cannot_be_sent(
    admin: TestClient, mailer: OutageMailer, crash_sink: RecordingCrashSink
) -> None:
    mailer.down = True

    response = send_feedback(admin)

    assert response.status_code == 201
    assert response.json() == {"emailed": False}
    assert [sent["text"] for sent in admin.get("/api/feedback").json()] == [IDEA["text"]]
    [report] = crash_sink.reports
    assert report.location == "SMTP"


def app_with(settings: Settings, mailer: OutageMailer, **addresses: str | None) -> FastAPI:
    return create_app(settings.model_copy(update=addresses), clock=FixedClock(), mailer=mailer)


@pytest.mark.parametrize(
    ("addresses", "emailed_to"),
    [
        (
            {"feedback_email": None, "crash_report_email": "crashes@example.org"},
            "crashes@example.org",
        ),
        ({"feedback_email": None, "crash_report_email": None}, None),
    ],
)
def test_without_its_own_address_feedback_goes_to_the_crash_report_address_or_is_only_stored(
    settings: Settings, addresses: dict[str, str | None], emailed_to: str | None
) -> None:
    mailer = OutageMailer()
    with TestClient(
        app_with(settings, mailer, **addresses), base_url="https://testserver"
    ) as admin:
        assert create_admin(settings) == 0
        assert log_in(admin).status_code == 200

        response = send_feedback(admin)

        assert response.json() == {"emailed": emailed_to is not None}
        assert [e.to for e in mailer.outbox if e.subject.startswith("Kita feedback")] == (
            [] if emailed_to is None else [emailed_to]
        )
        assert len(admin.get("/api/feedback").json()) == 1


def test_guests_send_feedback_too_but_only_admins_read_it(
    admin: TestClient,
    teacher: TestClient,
    new_client: Callable[[], TestClient],
    mailer: OutageMailer,
) -> None:
    _, guest = onboard(admin, new_client, mailer, "gast@kita.example", "guest")

    assert send_feedback(guest, {**IDEA, "kind": "problem", "page": "/calendar"}).status_code == 201
    assert teacher.get("/api/feedback").status_code == 403
    assert guest.get("/api/feedback").status_code == 403
    assert [sent["sentBy"] for sent in admin.get("/api/feedback").json()] == ["gast@kita.example"]


def test_feedback_needs_text_and_an_address_of_the_app(admin: TestClient) -> None:
    assert send_feedback(admin, {**IDEA, "text": "  "}).json() == {"detail": "text_required"}
    assert send_feedback(admin, {**IDEA, "text": "x" * 5001}).json() == {"detail": "too_long"}
    # A search could hold a name, so only the path is taken.
    assert send_feedback(admin, {**IDEA, "page": "/children?search=Lena"}).status_code == 422
    assert send_feedback(admin, {**IDEA, "kind": "complaint"}).status_code == 422
    assert admin.get("/api/feedback").json() == []
