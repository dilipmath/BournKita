from typing import Any

from fastapi.testclient import TestClient

from tests.groups import create_group

# Monday 11 January 2027 to Sunday 17 January 2027.
WEEK = {"from": "2027-01-11", "to": "2027-01-17"}

PARENTS_EVENING = {
    "title": "Parents' evening",
    "note": "In the big room",
    "startsOn": "2027-01-13",
    "startTime": "18:00",
    "endTime": "20:00",
}
TRIP = {"title": "Trip to the farm", "startsOn": "2027-01-11", "endsOn": "2027-01-12"}


def add_event(client: TestClient, event: dict[str, Any], group_id: int | None = None) -> int:
    response = client.post("/api/events", json={**event, "groupId": group_id})
    assert response.status_code == 201, response.text
    event_id: int = response.json()["id"]
    return event_id


def calendar(
    client: TestClient, span: dict[str, str] = WEEK, group_id: int | None = None
) -> list[dict[str, Any]]:
    params = {**span, **({} if group_id is None else {"groupId": str(group_id)})}
    response = client.get("/api/events", params=params)
    assert response.status_code == 200, response.text
    occurrences: list[dict[str, Any]] = response.json()
    return occurrences


def seen(occurrences: list[dict[str, Any]]) -> list[tuple[str, str, str]]:
    """Each occurrence as (title, first day, last day)."""
    return [(o["event"]["title"], o["startsOn"], o["endsOn"]) for o in occurrences]


def test_staff_add_events_for_a_group_or_the_whole_kita(
    admin: TestClient, teacher: TestClient
) -> None:
    monkeys = create_group(admin)
    evening = add_event(teacher, PARENTS_EVENING)
    trip = add_event(teacher, TRIP, monkeys)

    occurrences = calendar(admin)

    # In order: all-day before timed on the same day.
    assert seen(occurrences) == [
        ("Trip to the farm", "2027-01-11", "2027-01-12"),
        ("Parents' evening", "2027-01-13", "2027-01-13"),
    ]
    assert occurrences[0]["event"] == {
        "id": trip,
        "group": {"id": monkeys, "name": "Monkeys", "icon": "monkey"},
        "title": "Trip to the farm",
        "note": "",
        "startsOn": "2027-01-11",
        "endsOn": "2027-01-12",
        "startTime": None,
        "endTime": None,
        "repeat": "none",
        "repeatEvery": 1,
        "repeatUntil": None,
    }
    assert occurrences[1]["event"]["id"] == evening
    assert occurrences[1]["event"]["group"] is None
    assert (occurrences[1]["event"]["startTime"], occurrences[1]["event"]["endTime"]) == (
        "18:00:00",
        "20:00:00",
    )


def test_a_group_calendar_shows_its_own_and_the_kita_wide_events(admin: TestClient) -> None:
    monkeys = create_group(admin)
    bees = create_group(admin, "Bees", "bee")
    add_event(admin, PARENTS_EVENING)
    add_event(admin, TRIP, monkeys)
    add_event(admin, {"title": "Bee dance", "startsOn": "2027-01-14"}, bees)

    assert [title for title, _, _ in seen(calendar(admin, group_id=monkeys))] == [
        "Trip to the farm",
        "Parents' evening",
    ]
    # The Kita-wide calendar shows everything.
    assert len(calendar(admin)) == 3
    assert admin.get("/api/events", params={**WEEK, "groupId": "999"}).status_code == 404


def test_only_events_within_the_span_are_shown(admin: TestClient) -> None:
    add_event(admin, {"title": "Before", "startsOn": "2027-01-08", "endsOn": "2027-01-10"})
    add_event(admin, {"title": "Into the week", "startsOn": "2027-01-09", "endsOn": "2027-01-11"})
    add_event(admin, {"title": "Out of the week", "startsOn": "2027-01-17", "endsOn": "2027-01-19"})
    add_event(admin, {"title": "After", "startsOn": "2027-01-18"})

    assert [title for title, _, _ in seen(calendar(admin))] == ["Into the week", "Out of the week"]


def starts(occurrences: list[dict[str, Any]]) -> list[str]:
    return [occurrence["startsOn"] for occurrence in occurrences]


def test_an_event_repeats_every_few_days_or_weeks_until_a_date(admin: TestClient) -> None:
    add_event(
        admin,
        {
            "title": "Music",
            "startsOn": "2026-12-28",
            "startTime": "10:00",
            "endTime": "10:45",
            "repeat": "weekly",
            "repeatEvery": 2,
            "repeatUntil": "2027-02-08",
        },
    )
    add_event(
        admin, {"title": "Fruit", "startsOn": "2027-01-10", "repeat": "daily", "repeatEvery": 3}
    )

    january = calendar(admin, {"from": "2027-01-01", "to": "2027-01-31"})
    later = calendar(admin, {"from": "2027-02-01", "to": "2027-03-01"})

    music = [o for o in january if o["event"]["title"] == "Music"]
    assert starts(music) == ["2027-01-11", "2027-01-25"]
    fruit = [o for o in january if o["event"]["title"] == "Fruit"]
    assert starts(fruit) == [
        "2027-01-10",
        "2027-01-13",
        "2027-01-16",
        "2027-01-19",
        "2027-01-22",
        "2027-01-25",
        "2027-01-28",
        "2027-01-31",
    ]
    # Until 8 February: that is the last one.
    assert starts([o for o in later if o["event"]["title"] == "Music"]) == ["2027-02-08"]


def test_an_event_repeats_monthly_or_yearly_on_the_same_day(admin: TestClient) -> None:
    add_event(admin, {"title": "Team meeting", "startsOn": "2027-01-31", "repeat": "monthly"})
    add_event(admin, {"title": "Leap day", "startsOn": "2024-02-29", "repeat": "yearly"})
    add_event(
        admin,
        {"title": "Summer fair", "startsOn": "2025-06-20", "repeat": "yearly", "repeatEvery": 2},
    )

    spring = calendar(admin, {"from": "2027-01-15", "to": "2027-04-15"})
    leap = calendar(admin, {"from": "2028-02-01", "to": "2028-03-01"})
    summer = calendar(admin, {"from": "2027-06-01", "to": "2027-06-30"})

    # No 31 February, nor 31 April: those months have none, as in calendar apps.
    assert seen(spring) == [
        ("Team meeting", "2027-01-31", "2027-01-31"),
        ("Team meeting", "2027-03-31", "2027-03-31"),
    ]
    assert seen(leap) == [("Leap day", "2028-02-29", "2028-02-29")]
    assert calendar(admin, {"from": "2027-02-01", "to": "2027-03-01"}) == []
    assert seen(summer) == [("Summer fair", "2027-06-20", "2027-06-20")]


def test_a_repeating_event_over_several_days_shows_where_it_reaches_into_the_span(
    admin: TestClient,
) -> None:
    add_event(
        admin,
        {
            "title": "Forest week",
            "startsOn": "2026-12-03",
            "endsOn": "2026-12-11",
            "repeat": "monthly",
        },
    )

    assert seen(calendar(admin, {"from": "2027-01-10", "to": "2027-01-16"})) == [
        ("Forest week", "2027-01-03", "2027-01-11")
    ]


def test_staff_change_and_remove_an_event_with_all_its_occurrences(
    admin: TestClient, teacher: TestClient
) -> None:
    monkeys = create_group(admin)
    music = add_event(admin, {"title": "Music", "startsOn": "2027-01-11", "repeat": "weekly"})

    changed = teacher.put(
        f"/api/events/{music}",
        json={"title": "Singing", "startsOn": "2027-01-12", "repeat": "weekly", "groupId": monkeys},
    )

    assert changed.status_code == 200, changed.text
    assert changed.json()["group"]["id"] == monkeys
    january = {"from": "2027-01-01", "to": "2027-01-31"}
    assert seen(calendar(admin, january, monkeys)) == [
        ("Singing", day, day) for day in ("2027-01-12", "2027-01-19", "2027-01-26")
    ]
    assert teacher.delete(f"/api/events/{music}").status_code == 204
    assert calendar(admin, january) == []
    assert teacher.delete(f"/api/events/{music}").status_code == 404
    assert teacher.put(f"/api/events/{music}", json=PARENTS_EVENING).status_code == 404


def test_an_event_needs_a_title_a_valid_time_and_a_valid_repeat(admin: TestClient) -> None:
    def refusal(changes: dict[str, Any]) -> Any:
        return admin.post("/api/events", json={**PARENTS_EVENING, **changes}).json()["detail"]

    assert refusal({"title": " "}) == "name_required"
    assert refusal({"note": "x" * 2001}) == "too_long"
    assert refusal({"endTime": "17:00"}) == "ends_before_start"
    assert refusal({"endTime": None}) == "invalid_times"
    # Timed Events are on one day; for several days, make it all-day.
    assert refusal({"endsOn": "2027-01-14"}) == "invalid_times"
    assert refusal({**TRIP, "startTime": None, "endTime": None, "endsOn": "2027-01-10"}) == (
        "ends_before_start"
    )
    assert refusal({"repeat": "weekly", "repeatEvery": 0}) == "invalid_repeat"
    assert refusal({"repeat": "weekly", "repeatUntil": "2027-01-01"}) == "ends_before_start"
    assert admin.post("/api/events", json={**TRIP, "groupId": 999}).status_code == 404
    assert admin.post("/api/events", json={**TRIP, "repeat": "hourly"}).status_code == 422


def test_a_calendar_shows_at_most_100_days_at_once(admin: TestClient) -> None:
    def detail(span: dict[str, str]) -> Any:
        return admin.get("/api/events", params=span).json()

    assert detail({"from": "2027-01-01", "to": "2027-04-10"}) == []
    assert detail({"from": "2027-01-01", "to": "2027-04-11"}) == {"detail": "span_too_long"}
    assert detail({"from": "2027-01-02", "to": "2027-01-01"}) == {"detail": "ends_before_start"}


def test_the_calendar_needs_a_login(client: TestClient) -> None:
    assert client.get("/api/events", params=WEEK).status_code == 401
    assert client.post("/api/events", json=TRIP).status_code == 401
