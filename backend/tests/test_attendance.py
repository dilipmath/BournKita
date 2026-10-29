from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from kita.settings import Settings
from tests.accounts import ADMIN_EMAIL, TEACHER_EMAIL, log_in
from tests.children import create_child
from tests.fakes import FixedClock
from tests.groups import create_group, put_in_group


def at(clock: FixedClock, kita_time: str) -> None:
    """Sets the clock to a time at the Kita, e.g. "2027-01-04 08:12"."""
    local = datetime.fromisoformat(kita_time).replace(tzinfo=ZoneInfo("Europe/Berlin"))
    clock.now_value = local.astimezone(UTC)


def back_after_a_while(admin: TestClient, teacher: TestClient) -> None:
    """Logs both in again after the clock jumped hours: their sessions ended without activity."""
    assert log_in(admin, ADMIN_EMAIL).status_code == 200
    assert log_in(teacher, TEACHER_EMAIL).status_code == 200


def attendance(client: TestClient, child_id: int, step: str) -> Any:
    return client.post(f"/api/children/{child_id}/attendance/{step}")


def today(client: TestClient, group_id: int) -> Any:
    response = client.get(f"/api/groups/{group_id}")
    assert response.status_code == 200, response.text
    return response.json()


def child_today(client: TestClient, group_id: int, child_id: int) -> dict[str, Any]:
    found: dict[str, Any] = next(
        c for c in today(client, group_id)["children"] if c["id"] == child_id
    )
    return found


def changes(admin: TestClient) -> list[list[str]]:
    entries = admin.get("/api/audit-log", params={"action": "changed"}).json()
    return [entry["changedFields"] for entry in entries]


def test_a_teacher_checks_a_child_in_and_out(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    put_in_group(admin, lena, monkeys)
    assert child_today(teacher, monkeys, lena)["attendance"] is None

    at(clock, "2027-01-04 08:12")
    checked_in = attendance(teacher, lena, "check-in")
    at(clock, "2027-01-04 15:30")
    back_after_a_while(admin, teacher)
    checked_out = attendance(teacher, lena, "check-out")

    assert (checked_in.status_code, checked_out.status_code) == (204, 204)
    assert child_today(teacher, monkeys, lena)["attendance"] == {
        "checkedInAt": "2027-01-04T07:12:00Z",
        "checkedOutAt": "2027-01-04T14:30:00Z",
    }
    assert [fields for fields in changes(admin) if "attendance" in fields] == [["attendance"]] * 2


def test_each_day_starts_afresh(admin: TestClient, teacher: TestClient, clock: FixedClock) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    put_in_group(admin, lena, monkeys)
    at(clock, "2027-01-04 08:00")
    attendance(teacher, lena, "check-in")  # And never checked out.

    at(clock, "2027-01-05 08:00")
    back_after_a_while(admin, teacher)

    assert child_today(teacher, monkeys, lena)["attendance"] is None
    assert attendance(teacher, lena, "check-in").status_code == 204


def test_check_in_and_out_go_in_order_once_a_day(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    lena = create_child(admin)
    at(clock, "2027-01-04 08:00")

    out_first = attendance(teacher, lena, "check-out")
    attendance(teacher, lena, "check-in")
    in_twice = attendance(teacher, lena, "check-in")
    attendance(teacher, lena, "check-out")
    out_twice = attendance(teacher, lena, "check-out")

    assert [r.json()["detail"] for r in (out_first, in_twice, out_twice)] == [
        "not_checked_in",
        "already_checked_in",
        "already_checked_out",
    ]
    assert attendance(teacher, 999, "check-in").status_code == 404


def test_a_mistaken_tap_is_undone_step_by_step(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    put_in_group(admin, lena, monkeys)
    at(clock, "2027-01-04 08:00")
    attendance(teacher, lena, "check-in")
    attendance(teacher, lena, "check-out")

    attendance(teacher, lena, "undo")
    assert child_today(teacher, monkeys, lena)["attendance"]["checkedOutAt"] is None
    attendance(teacher, lena, "undo")
    assert child_today(teacher, monkeys, lena)["attendance"] is None
    assert attendance(teacher, lena, "undo").json() == {"detail": "not_checked_in"}


def add_absence(client: TestClient, child_id: int, absence: dict[str, Any]) -> Any:
    return client.post(f"/api/children/{child_id}/absences", json=absence)


def test_a_teacher_records_an_absence_for_some_days(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    put_in_group(admin, lena, monkeys)
    at(clock, "2027-01-04 09:00")

    added = add_absence(
        teacher, lena, {"startsOn": "2027-01-04", "endsOn": "2027-01-06", "reason": "sick"}
    )

    assert added.status_code == 201, added.text
    absence = {
        "id": added.json()["id"],
        "startsOn": "2027-01-04",
        "endsOn": "2027-01-06",
        "reason": "sick",
    }
    assert added.json() == absence
    assert child_today(teacher, monkeys, lena)["absence"] == absence
    assert "absences" in changes(admin)[0]
    # Absent, so not checked in by mistake.
    assert attendance(teacher, lena, "check-in").json() == {"detail": "absent_today"}
    at(clock, "2027-01-07 09:00")
    back_after_a_while(admin, teacher)
    assert child_today(teacher, monkeys, lena)["absence"] is None


def test_an_absence_is_one_day_unless_said_and_can_be_removed(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    put_in_group(admin, lena, monkeys)
    at(clock, "2027-01-04 09:00")

    holiday = add_absence(teacher, lena, {"startsOn": "2027-01-04", "reason": "holiday"}).json()
    removed = teacher.delete(f"/api/children/{lena}/absences/{holiday['id']}")

    assert holiday["endsOn"] == "2027-01-04"
    assert removed.status_code == 204
    assert child_today(teacher, monkeys, lena)["absence"] is None
    assert teacher.delete(f"/api/children/{lena}/absences/{holiday['id']}").status_code == 404


def test_absences_do_not_overlap_nor_contradict_today(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    at(clock, "2027-01-04 09:00")
    add_absence(
        teacher, lena, {"startsOn": "2027-01-11", "endsOn": "2027-01-15", "reason": "holiday"}
    )
    attendance(teacher, mia, "check-in")

    refusals = [
        add_absence(
            teacher, lena, {"startsOn": "2027-01-15", "endsOn": "2027-01-18", "reason": "sick"}
        ),
        add_absence(
            teacher, lena, {"startsOn": "2027-01-20", "endsOn": "2027-01-19", "reason": "sick"}
        ),
        # Mia is here today.
        add_absence(teacher, mia, {"startsOn": "2027-01-04", "reason": "sick"}),
        add_absence(teacher, lena, {"startsOn": "2027-01-20", "reason": "bored"}),
    ]

    assert [r.status_code for r in refusals] == [409, 422, 409, 422]
    assert [r.json()["detail"] for r in refusals[:3]] == [
        "overlapping_absence",
        "ends_before_start",
        "present_then",
    ]


def test_the_reason_of_an_absence_is_not_stored_in_plain_text(
    admin: TestClient, teacher: TestClient, settings: Settings
) -> None:
    lena = create_child(admin)
    add_absence(teacher, lena, {"startsOn": "2027-01-04", "reason": "sick"})

    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        dump = str(connection.execute(text("SELECT row_to_json(a) FROM absences a")).all())
    engine.dispose()

    assert "sick" not in dump


def test_the_today_view_says_which_day_and_whose_birthday_it_is(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin, dateOfBirth="2022-01-04")
    mia = create_child(admin, firstName="Mia", dateOfBirth="2022-01-05")
    for child in (lena, mia):
        put_in_group(admin, child, monkeys)
    # Late in the evening in UTC is already the next day at the Kita.
    clock.now_value = datetime(2027, 1, 3, 23, 30, tzinfo=UTC)

    view = today(teacher, monkeys)

    assert view["day"] == "2027-01-04"
    assert [(c["firstName"], c["birthdayToday"]) for c in view["children"]] == [
        ("Lena", True),
        ("Mia", False),
    ]


def test_a_childs_coming_absences_are_on_their_profile(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    lena = create_child(admin)
    at(clock, "2027-01-04 09:00")
    add_absence(teacher, lena, {"startsOn": "2026-12-21", "endsOn": "2026-12-23", "reason": "sick"})
    next_week = add_absence(
        teacher, lena, {"startsOn": "2027-01-11", "endsOn": "2027-01-15", "reason": "holiday"}
    ).json()

    profile = teacher.get(f"/api/children/{lena}").json()

    # Past ones are over; the coming ones can be seen, and removed.
    assert profile["absences"] == [next_week]


def test_an_absence_cannot_cover_a_day_the_child_was_here(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    lena = create_child(admin)
    at(clock, "2027-01-04 09:00")
    attendance(teacher, lena, "check-in")
    at(clock, "2027-01-05 09:00")
    back_after_a_while(admin, teacher)

    refused = add_absence(
        teacher, lena, {"startsOn": "2027-01-04", "endsOn": "2027-01-06", "reason": "sick"}
    )

    assert refused.json() == {"detail": "present_then"}
