import re
from collections.abc import Callable

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests.accounts import ADMIN_EMAIL, onboard
from tests.children import create_child
from tests.fakes import FixedClock, OutageMailer
from tests.groups import create_group, put_in_group
from tests.test_events import PARENTS_EVENING, TRIP, add_event
from tests.test_holidays import SCHOOL, upload
from tests.test_reminders import at, reminders, send_due

GUEST_EMAIL = "gast@kita.example"


@pytest.fixture
def guest(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: OutageMailer
) -> TestClient:
    """A client logged in as a Guest, onboarded by the first Admin."""
    _, guest_client = onboard(admin, new_client, mailer, GUEST_EMAIL, "guest")
    return guest_client


def test_an_admin_creates_a_guest_account(admin: TestClient, guest: TestClient) -> None:
    accounts = {account["email"]: account for account in admin.get("/api/staff").json()}

    assert accounts[GUEST_EMAIL]["role"] == "guest"
    assert accounts[GUEST_EMAIL]["status"] == "active"
    session = guest.get("/api/session").json()
    assert (session["email"], session["role"]) == (GUEST_EMAIL, "guest")


# What a Guest may do once logged in: see who they are, log out, read the Kita-wide Calendar,
# send feedback.
GUEST_ROUTES = {
    ("GET", "/api/session"),
    ("DELETE", "/api/session"),
    ("GET", "/api/calendar"),
    ("POST", "/api/feedback"),
}


def test_every_route_that_needs_a_login_refuses_a_guest_but_the_calendar(
    app: FastAPI, guest: TestClient, new_client: Callable[[], TestClient]
) -> None:
    anonymous = new_client()
    let_in = []
    without_login = set()
    # Every route of the API, as it describes itself.
    for template, operations in app.openapi()["paths"].items():
        # Any ID will do: the login is checked before the request is looked at.
        path = re.sub(r"\{\w+\}", "1", template)
        for method in sorted(name.upper() for name in operations):
            if (method, template) in GUEST_ROUTES:
                continue  # Tested on their own; logging out here would end the test's session.
            if anonymous.request(method, path).status_code != 401:
                without_login.add((method, template))
                continue
            status = guest.request(method, path).status_code
            if status != 403:
                let_in.append(f"{method} {template}: {status}")

    assert let_in == []
    # The only ones that need no login, none showing anybody's data: so none slipped past above.
    assert without_login == {
        ("GET", "/api/health"),
        ("POST", "/api/crash-reports"),
        ("POST", "/api/crash-reports/backups"),
        ("POST", "/api/session"),
        ("POST", "/api/email-verifications"),
        ("POST", "/api/password-resets"),
        ("PUT", "/api/password-resets"),
    }


def test_a_guest_sees_the_kita_wide_events_and_the_holidays_only(
    admin: TestClient, guest: TestClient
) -> None:
    monkeys = create_group(admin)
    add_event(admin, TRIP)
    add_event(admin, {**PARENTS_EVENING, "title": "Monkeys' parents' evening"}, monkeys)
    # Born on 12 January, so her Birthday is in the week too.
    put_in_group(admin, create_child(admin, dateOfBirth="2022-01-12"), monkeys)
    assert upload(admin, "school", SCHOOL).status_code == 200

    response = guest.get("/api/calendar", params={"from": "2027-01-01", "to": "2027-02-28"})

    assert response.status_code == 200
    calendar = response.json()
    assert [event["event"]["title"] for event in calendar["events"]] == ["Trip to the farm"]
    assert calendar["birthdays"] == []
    assert [holiday["name"] for holiday in calendar["holidays"]] == ["Winterferien Berlin"]
    # Not a Group's Calendar either: that has its Children's Birthdays.
    group_calendar = {"from": "2027-01-01", "to": "2027-01-31", "groupId": str(monkeys)}
    assert guest.get("/api/calendar", params=group_calendar).status_code == 403


def test_guests_get_no_reminders(
    app: FastAPI, guest: TestClient, admin: TestClient, clock: FixedClock, mailer: OutageMailer
) -> None:
    mailer.outbox.clear()
    add_event(admin, {**TRIP, "remindDaysBefore": 0})

    at(clock, "2027-01-11 07:00")
    send_due(app)

    assert [email.to for email in reminders(mailer)] == [ADMIN_EMAIL]


def test_a_guest_in_a_group_is_no_assignee_there(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: OutageMailer
) -> None:
    monkeys = create_group(admin)
    guest_id, _ = onboard(admin, new_client, mailer, GUEST_EMAIL, "guest")
    admin.put(f"/api/staff/{guest_id}/groups", json={"groupIds": [monkeys]})

    assignees = admin.get(f"/api/groups/{monkeys}/assignees").json()

    assert GUEST_EMAIL not in [assignee["email"] for assignee in assignees]
