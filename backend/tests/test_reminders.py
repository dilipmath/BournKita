import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from kita.mail import Email
from tests.accounts import ADMIN_EMAIL, TEACHER_EMAIL, invite, onboard
from tests.fakes import FixedClock, OutageMailer
from tests.groups import create_group

OTHER_TEACHER = "zweite@kita.example"


@pytest.fixture
def staff(
    admin: TestClient,
    new_client: Callable[[], TestClient],
    mailer: OutageMailer,
) -> dict[str, int]:
    """Monkeys, with one Teacher working in it and another not; the Admin works in none."""
    monkeys = create_group(admin)
    teacher_id, _ = onboard(admin, new_client, mailer)
    other_id, _ = onboard(admin, new_client, mailer, OTHER_TEACHER)
    admin.put(f"/api/staff/{teacher_id}/groups", json={"groupIds": [monkeys]})
    mailer.outbox.clear()
    return {"monkeys": monkeys, "teacher": teacher_id, "other": other_id}


def at(clock: FixedClock, kita_time: str) -> None:
    """Sets the clock to a time at the Kita, e.g. "2027-01-04 07:00"."""
    local = datetime.fromisoformat(kita_time).replace(tzinfo=ZoneInfo("Europe/Berlin"))
    clock.now_value = local.astimezone(UTC)


def add_event(admin: TestClient, event: dict[str, Any], group_id: int | None = None) -> int:
    response = admin.post("/api/events", json={**event, "groupId": group_id})
    assert response.status_code == 201, response.text
    event_id: int = response.json()["id"]
    return event_id


def send_due(app: FastAPI) -> None:
    app.state.reminders.send_due()


def reminders(mailer: OutageMailer) -> list[Email]:
    return [email for email in mailer.outbox if email.subject.startswith("Erinnerung")]


def test_a_groups_staff_are_reminded_the_chosen_days_before_from_7_oclock(
    app: FastAPI, admin: TestClient, staff: dict[str, int], clock: FixedClock, mailer: OutageMailer
) -> None:
    add_event(
        admin,
        {
            "title": "Trip to the farm",
            "note": "Bring boots",
            "startsOn": "2027-01-06",
            "startTime": "09:30",
            "endTime": "12:00",
            "remindDaysBefore": 2,
        },
        staff["monkeys"],
    )

    at(clock, "2027-01-04 06:55")
    send_due(app)
    assert reminders(mailer) == []

    at(clock, "2027-01-04 07:00")
    send_due(app)
    at(clock, "2027-01-04 15:00")
    send_due(app)  # Each reminder once.

    [email] = reminders(mailer)
    assert email.to == TEACHER_EMAIL
    assert "Trip to the farm" in email.subject and "06.01.2027" in email.subject
    assert "09:30–12:00" in email.body and "Monkeys" in email.body and "Bring boots" in email.body


def test_the_whole_kitas_events_remind_every_active_staff_member(
    app: FastAPI, admin: TestClient, staff: dict[str, int], clock: FixedClock, mailer: OutageMailer
) -> None:
    add_event(admin, {"title": "Parents' evening", "startsOn": "2027-01-04", "remindDaysBefore": 0})
    admin.put(f"/api/staff/{staff['other']}/active", json={"active": False})
    invite(admin, "neu@kita.example", "teacher")  # Invited, not verified yet: no login, no email.
    mailer.outbox.clear()

    at(clock, "2027-01-04 07:30")
    send_due(app)

    assert sorted(email.to for email in reminders(mailer)) == [TEACHER_EMAIL, ADMIN_EMAIL]


def test_a_repeating_event_reminds_every_time(
    app: FastAPI, admin: TestClient, staff: dict[str, int], clock: FixedClock, mailer: OutageMailer
) -> None:
    add_event(
        admin,
        {"title": "Music", "startsOn": "2027-01-05", "repeat": "weekly", "remindDaysBefore": 1},
        staff["monkeys"],
    )

    for day in ("2027-01-04", "2027-01-11", "2027-01-12"):
        at(clock, f"{day} 08:00")
        send_due(app)

    # For Tuesday 5 and Tuesday 12 January; on the 12th, the next is a week away.
    first, second = reminders(mailer)
    assert "05.01.2027" in first.subject and "12.01.2027" in second.subject


def test_a_reminder_that_could_not_be_sent_is_sent_later(
    app: FastAPI, admin: TestClient, staff: dict[str, int], clock: FixedClock, mailer: OutageMailer
) -> None:
    add_event(
        admin, {"title": "Music", "startsOn": "2027-01-05", "remindDaysBefore": 1}, staff["monkeys"]
    )
    at(clock, "2027-01-04 07:00")

    mailer.down = True
    send_due(app)
    mailer.down = False
    send_due(app)

    assert [email.to for email in reminders(mailer)] == [TEACHER_EMAIL]


def test_events_remind_only_when_asked_and_a_few_ways(
    app: FastAPI, admin: TestClient, staff: dict[str, int], clock: FixedClock, mailer: OutageMailer
) -> None:
    add_event(admin, {"title": "Music", "startsOn": "2027-01-05"}, staff["monkeys"])
    at(clock, "2027-01-04 07:00")
    send_due(app)

    refused = admin.post(
        "/api/events", json={"title": "Music", "startsOn": "2027-01-05", "remindDaysBefore": 3}
    )

    assert reminders(mailer) == []
    assert refused.json() == {"detail": "invalid_reminder"}


def test_a_reminder_missed_on_its_day_goes_out_until_the_event_begins(
    app: FastAPI, admin: TestClient, staff: dict[str, int], clock: FixedClock, mailer: OutageMailer
) -> None:
    # Due on Monday, a week before; the server was off until Thursday.
    add_event(
        admin,
        {"title": "Summer fair", "startsOn": "2027-01-11", "remindDaysBefore": 7},
        staff["monkeys"],
    )
    # Added on Thursday for Saturday, though "a week before" had passed: reminded at once.
    add_event(
        admin,
        {"title": "Cleaning day", "startsOn": "2027-01-09", "remindDaysBefore": 7},
        staff["monkeys"],
    )

    at(clock, "2027-01-07 09:00")
    send_due(app)
    at(clock, "2027-01-12 09:00")
    send_due(app)  # After the fair: too late to remind of it.

    assert sorted(
        email.subject.split(":")[1].split("–")[0].strip() for email in reminders(mailer)
    ) == [
        "Cleaning day",
        "Summer fair",
    ]


def test_two_runs_at_once_remind_once(
    app: FastAPI, admin: TestClient, staff: dict[str, int], clock: FixedClock, mailer: OutageMailer
) -> None:
    add_event(
        admin, {"title": "Music", "startsOn": "2027-01-05", "remindDaysBefore": 1}, staff["monkeys"]
    )
    at(clock, "2027-01-04 07:00")
    started = threading.Event()
    original = mailer.send

    def slow_send(email: Email) -> None:
        started.set()
        time.sleep(0.5)
        original(email)

    mailer.send = slow_send  # type: ignore[method-assign]
    first = threading.Thread(target=send_due, args=(app,))
    first.start()
    started.wait(5)
    send_due(app)  # While the first is still sending.
    first.join()

    assert [email.to for email in reminders(mailer)] == [TEACHER_EMAIL]
