from typing import Any

from fastapi.testclient import TestClient

from tests.children import create_child
from tests.groups import create_group, put_in_group


def changes(admin: TestClient) -> list[list[str]]:
    entries = admin.get("/api/audit-log", params={"action": "changed"}).json()
    return [entry["changedFields"] for entry in entries]


def test_an_admin_records_a_childs_date_of_birth(admin: TestClient, teacher: TestClient) -> None:
    lena = create_child(admin, dateOfBirth="2022-03-14")
    mia = create_child(admin, firstName="Mia")

    assert teacher.get(f"/api/children/{lena}").json()["dateOfBirth"] == "2022-03-14"
    assert teacher.get(f"/api/children/{mia}").json()["dateOfBirth"] is None
    changed = admin.put(
        f"/api/children/{mia}",
        json={"firstName": "Mia", "lastName": "Müller", "dateOfBirth": "2021-07-02"},
    )
    assert changed.json()["dateOfBirth"] == "2021-07-02"
    assert "dateOfBirth" in changes(admin)[0]


def test_a_date_of_birth_cannot_be_in_the_future(admin: TestClient) -> None:
    # The test clock says 4 January 2027.
    response = admin.post(
        "/api/children",
        json={"firstName": "Lena", "lastName": "Müller", "dateOfBirth": "2027-01-05"},
    )

    assert response.json() == {"detail": "in_future"}


def calendar(client: TestClient, first: str, last: str, group_id: int | None = None) -> Any:
    params = {"from": first, "to": last, **({} if group_id is None else {"groupId": str(group_id)})}
    response = client.get("/api/calendar", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_birthdays_come_from_child_profiles(admin: TestClient, teacher: TestClient) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin, dateOfBirth="2022-01-09")
    mia = create_child(admin, firstName="Mia", dateOfBirth="2021-12-30")
    create_child(admin, firstName="Emil", dateOfBirth="2022-05-01")  # Not in the span.
    create_child(admin, firstName="Ida")  # No date of birth recorded.
    put_in_group(admin, lena, monkeys)

    # Over New Year: one birthday in each year.
    span = calendar(teacher, "2026-12-28", "2027-01-10")

    assert span["birthdays"] == [
        {"childId": mia, "firstName": "Mia", "lastName": "Müller", "on": "2026-12-30"},
        {"childId": lena, "firstName": "Lena", "lastName": "Müller", "on": "2027-01-09"},
    ]
    # Shown as birthdays, not stored as Events.
    assert span["events"] == []
    # A Group's calendar has its own Children's birthdays only.
    assert [
        b["childId"] for b in calendar(teacher, "2026-12-28", "2027-01-10", monkeys)["birthdays"]
    ] == [lena]


def test_a_birthday_on_29_february_is_on_the_28th_in_other_years(admin: TestClient) -> None:
    ida = create_child(admin, firstName="Ida", dateOfBirth="2024-02-29")

    assert calendar(admin, "2027-02-01", "2027-03-07")["birthdays"] == [
        {"childId": ida, "firstName": "Ida", "lastName": "Müller", "on": "2027-02-28"}
    ]
    assert calendar(admin, "2028-02-01", "2028-03-07")["birthdays"][0]["on"] == "2028-02-29"


def test_birthdays_in_the_calendar_are_not_logged(admin: TestClient, teacher: TestClient) -> None:
    create_child(admin, dateOfBirth="2022-01-09")

    calendar(teacher, "2027-01-04", "2027-01-10")

    # Day and name only, like the list of Children.
    assert admin.get("/api/audit-log", params={"action": "viewed"}).json() == []
