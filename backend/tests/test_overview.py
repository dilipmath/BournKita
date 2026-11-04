from collections.abc import Callable
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from tests.accounts import log_in, onboard
from tests.children import create_child
from tests.fakes import CapturingMailer, FixedClock
from tests.groups import create_group, put_in_group

# The test clock says Monday 4 January 2027, 09:00 at the Kita.
TODAY = "2027-01-04"


def step(client: TestClient, child_id: int, *steps: str) -> None:
    for each in steps:
        response = client.post(f"/api/children/{child_id}/attendance/{each}")
        assert response.status_code == 204, response.text


def test_the_kita_overview_counts_each_groups_day_and_the_whole_kitas(
    admin: TestClient, teacher: TestClient
) -> None:
    monkeys = create_group(admin, "Monkeys", "monkey")
    create_group(admin, "Bears", "bear")
    lena = create_child(admin, firstName="Lena", dateOfBirth="2022-01-04")
    mia = create_child(admin, firstName="Mia")
    ida = create_child(admin, firstName="Ida")
    emil = create_child(admin, firstName="Emil")
    paul = create_child(admin, firstName="Paul")
    for child in (lena, mia, ida, emil):
        put_in_group(admin, child, monkeys)
    admin.post(
        f"/api/children/{lena}/alerts", json={"kind": "allergy", "name": "Peanuts", "note": ""}
    )
    admin.post(
        f"/api/children/{emil}/alerts", json={"kind": "medical", "name": "Asthma", "note": ""}
    )
    step(teacher, lena, "check-in")
    step(teacher, mia, "check-in", "check-out")
    step(teacher, paul, "check-in")
    teacher.post(
        f"/api/children/{ida}/absences", json={"startsOn": TODAY, "endsOn": TODAY, "reason": "sick"}
    )
    teacher.post(
        f"/api/children/{mia}/incidents",
        json={"happenedOn": TODAY, "description": "Fell over", "informed": "Mother"},
    )

    overview = admin.get("/api/overview")

    assert overview.status_code == 200
    body = overview.json()
    assert body["day"] == TODAY
    assert [
        {k: g[k] for k in ("name", "icon", "expected", "here", "gone", "absent", "notYet")}
        for g in body["groups"]
    ] == [
        {
            "name": "Bears",
            "icon": "bear",
            "expected": 0,
            "here": 0,
            "gone": 0,
            "absent": 0,
            "notYet": 0,
        },
        {
            "name": "Monkeys",
            "icon": "monkey",
            "expected": 4,
            "here": 1,
            "gone": 1,
            "absent": 1,
            "notYet": 1,
        },
    ]
    [bears, monkeys_today] = body["groups"]
    # Emil's Asthma counts only once he is here.
    assert monkeys_today["alertsHere"] == 1
    assert monkeys_today["birthdays"] == [{"id": lena, "firstName": "Lena", "lastName": "Müller"}]
    assert bears["birthdays"] == []
    assert body["kita"] == {
        "stillCheckedIn": 2,
        "withoutGroup": [{"id": paul, "firstName": "Paul", "lastName": "Müller"}],
        "incidentsToday": 1,
    }
    # Counts and names only: no Alert, no Absence reason, no Incident text.
    for word in ("Peanuts", "Asthma", "sick", "Fell over", "Mother"):
        assert word not in overview.text


def test_only_admins_see_the_kita_overview(
    admin: TestClient,
    teacher: TestClient,
    new_client: Callable[[], TestClient],
    mailer: CapturingMailer,
) -> None:
    _, guest = onboard(admin, new_client, mailer, "gast@kita.example", "guest")

    assert teacher.get("/api/overview").status_code == 403
    assert guest.get("/api/overview").status_code == 403


def test_the_kita_overview_counts_by_the_kitas_day(admin: TestClient, clock: FixedClock) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin, dateOfBirth="2022-01-04")
    put_in_group(admin, lena, monkeys)
    # Late in the evening in UTC is already the next day at the Kita.
    clock.now_value = datetime(2027, 1, 3, 23, 30, tzinfo=UTC)
    assert log_in(admin).status_code == 200

    body = admin.get("/api/overview").json()

    assert body["day"] == "2027-01-04"
    assert [child["id"] for child in body["groups"][0]["birthdays"]] == [lena]


def test_the_admins_own_groups_come_first(admin: TestClient) -> None:
    create_group(admin, "Bears", "bear")
    monkeys = create_group(admin, "Monkeys", "monkey")
    [me] = admin.get("/api/staff").json()
    assert (
        admin.put(f"/api/staff/{me['id']}/groups", json={"groupIds": [monkeys]}).status_code == 200
    )

    groups = admin.get("/api/overview").json()["groups"]

    assert [(g["name"], g["mine"]) for g in groups] == [("Monkeys", True), ("Bears", False)]
