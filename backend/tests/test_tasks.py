from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.accounts import ADMIN_EMAIL, TEACHER_EMAIL, onboard
from tests.fakes import OutageMailer
from tests.groups import create_group

WASH_SMOCKS = {"title": "Wash the painting smocks", "note": "Before Friday"}
# What a Task has besides its title and note, before anyone sets it.
UNPLANNED: dict[str, Any] = {"assignee": None, "dueOn": None, "labels": []}


def add_task(client: TestClient, group_id: int, task: dict[str, Any]) -> int:
    response = client.post(f"/api/groups/{group_id}/tasks", json=task)
    assert response.status_code == 201, response.text
    task_id: int = response.json()["id"]
    return task_id


def board(client: TestClient, group_id: int) -> list[dict[str, Any]]:
    response = client.get(f"/api/groups/{group_id}/tasks")
    assert response.status_code == 200, response.text
    tasks: list[dict[str, Any]] = response.json()
    return tasks


def test_a_teacher_adds_tasks_to_a_groups_board_in_to_do(
    admin: TestClient, teacher: TestClient
) -> None:
    monkeys = create_group(admin)

    smocks = add_task(teacher, monkeys, WASH_SMOCKS)
    plants = add_task(teacher, monkeys, {"title": "Water the plants"})

    assert board(admin, monkeys) == [
        {"id": smocks, **WASH_SMOCKS, "status": "toDo", **UNPLANNED},
        {"id": plants, "title": "Water the plants", "note": "", "status": "toDo", **UNPLANNED},
    ]


def test_a_teacher_edits_moves_and_deletes_tasks(admin: TestClient, teacher: TestClient) -> None:
    monkeys = create_group(admin)
    smocks = add_task(teacher, monkeys, WASH_SMOCKS)
    plants = add_task(teacher, monkeys, {"title": "Water the plants"})

    edited = teacher.put(
        f"/api/groups/{monkeys}/tasks/{smocks}", json={"title": "Wash the smocks", "note": ""}
    )
    moved = teacher.put(f"/api/groups/{monkeys}/tasks/{smocks}/status", json={"status": "doing"})
    deleted = teacher.delete(f"/api/groups/{monkeys}/tasks/{plants}")

    assert (edited.status_code, moved.status_code, deleted.status_code) == (200, 204, 204)
    assert edited.json() == {
        "id": smocks,
        "title": "Wash the smocks",
        "note": "",
        "status": "toDo",
        **UNPLANNED,
    }
    assert board(teacher, monkeys) == [
        {"id": smocks, "title": "Wash the smocks", "note": "", "status": "doing", **UNPLANNED}
    ]


def test_a_board_shows_its_own_groups_tasks_only(admin: TestClient) -> None:
    monkeys = create_group(admin)
    bees = create_group(admin, "Bees", "bee")
    smocks = add_task(admin, monkeys, WASH_SMOCKS)

    through_bees = [
        admin.put(f"/api/groups/{bees}/tasks/{smocks}", json=WASH_SMOCKS),
        admin.put(f"/api/groups/{bees}/tasks/{smocks}/status", json={"status": "done"}),
        admin.delete(f"/api/groups/{bees}/tasks/{smocks}"),
    ]

    assert board(admin, bees) == []
    assert [response.status_code for response in through_bees] == [404, 404, 404]
    assert board(admin, monkeys) == [{"id": smocks, **WASH_SMOCKS, "status": "toDo", **UNPLANNED}]


def test_a_board_needs_an_existing_group_and_a_login(admin: TestClient, client: TestClient) -> None:
    monkeys = create_group(admin)

    assert admin.get("/api/groups/999/tasks").status_code == 404
    assert admin.post("/api/groups/999/tasks", json=WASH_SMOCKS).status_code == 404
    admin.delete("/api/session")
    assert client.get(f"/api/groups/{monkeys}/tasks").status_code == 401


def test_tasks_need_a_title_valid_lengths_and_a_known_column(admin: TestClient) -> None:
    monkeys = create_group(admin)
    smocks = add_task(admin, monkeys, WASH_SMOCKS)

    no_title = admin.post(f"/api/groups/{monkeys}/tasks", json={"title": "  "})
    too_long = admin.post(f"/api/groups/{monkeys}/tasks", json={"title": "x" * 201})
    unknown = admin.put(f"/api/groups/{monkeys}/tasks/{smocks}/status", json={"status": "later"})

    assert no_title.json() == {"detail": "name_required"}
    assert too_long.json() == {"detail": "too_long"}
    assert unknown.status_code == 422


@pytest.fixture
def teacher_in_monkeys(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: OutageMailer
) -> tuple[int, int, TestClient]:
    """A Group, Monkeys, and a Teacher who works in it: (Group ID, account ID, client)."""
    monkeys = create_group(admin)
    account_id, teacher_client = onboard(admin, new_client, mailer)
    chosen = admin.put(f"/api/staff/{account_id}/groups", json={"groupIds": [monkeys]})
    assert chosen.status_code == 200, chosen.text
    return monkeys, account_id, teacher_client


def test_a_task_has_an_assignee_a_due_date_and_labels(
    teacher_in_monkeys: tuple[int, int, TestClient],
) -> None:
    monkeys, teacher_id, teacher = teacher_in_monkeys

    smocks = add_task(
        teacher,
        monkeys,
        {
            **WASH_SMOCKS,
            "assigneeId": teacher_id,
            "dueOn": "2027-01-08",
            "labels": [" Laundry ", "Art", "laundry"],
        },
    )

    assert board(teacher, monkeys) == [
        {
            "id": smocks,
            **WASH_SMOCKS,
            "status": "toDo",
            "assignee": {"id": teacher_id, "email": TEACHER_EMAIL},
            "dueOn": "2027-01-08",
            # Trimmed, and each once, ignoring case.
            "labels": ["Laundry", "Art"],
        }
    ]


def test_only_staff_members_of_the_group_can_be_assigned(
    admin: TestClient, teacher_in_monkeys: tuple[int, int, TestClient]
) -> None:
    monkeys, teacher_id, _ = teacher_in_monkeys
    bees = create_group(admin, "Bees", "bee")
    admin_id = next(a["id"] for a in admin.get("/api/staff").json() if a["email"] == ADMIN_EMAIL)

    not_in_group = admin.post(
        f"/api/groups/{bees}/tasks", json={**WASH_SMOCKS, "assigneeId": teacher_id}
    )
    unknown = admin.post(f"/api/groups/{monkeys}/tasks", json={**WASH_SMOCKS, "assigneeId": 999})
    admin.put(f"/api/staff/{teacher_id}/active", json={"active": False})
    deactivated = admin.post(
        f"/api/groups/{monkeys}/tasks", json={**WASH_SMOCKS, "assigneeId": teacher_id}
    )
    smocks = add_task(admin, monkeys, WASH_SMOCKS)
    changed = admin.put(
        f"/api/groups/{monkeys}/tasks/{smocks}", json={**WASH_SMOCKS, "assigneeId": admin_id}
    )

    assert [r.json() for r in (not_in_group, unknown, deactivated, changed)] == [
        {"detail": "not_in_group"}
    ] * 4


def test_every_staff_member_sees_whom_a_groups_tasks_can_be_assigned_to(
    admin: TestClient, teacher_in_monkeys: tuple[int, int, TestClient]
) -> None:
    monkeys, teacher_id, teacher = teacher_in_monkeys

    response = teacher.get(f"/api/groups/{monkeys}/assignees")

    assert response.status_code == 200, response.text
    assert response.json() == [{"id": teacher_id, "email": TEACHER_EMAIL}]
    assert admin.get("/api/groups/999/assignees").status_code == 404


def test_labels_are_short_and_few(admin: TestClient) -> None:
    monkeys = create_group(admin)

    long_label = admin.post(
        f"/api/groups/{monkeys}/tasks", json={**WASH_SMOCKS, "labels": ["x" * 31]}
    )
    many = admin.post(
        f"/api/groups/{monkeys}/tasks", json={**WASH_SMOCKS, "labels": [f"L{n}" for n in range(6)]}
    )
    add_task(admin, monkeys, {**WASH_SMOCKS, "labels": ["  ", "Garden"]})

    assert (long_label.json(), many.json()) == ({"detail": "too_long"}, {"detail": "too_long"})
    assert board(admin, monkeys)[0]["labels"] == ["Garden"]


def backlog(client: TestClient, group_id: int) -> list[str]:
    """The titles of the Group's To do Tasks, most important first."""
    return [task["title"] for task in board(client, group_id) if task["status"] == "toDo"]


def test_the_backlog_is_in_the_order_staff_choose(admin: TestClient, teacher: TestClient) -> None:
    monkeys = create_group(admin)
    smocks = add_task(teacher, monkeys, {"title": "Wash the smocks"})
    plants = add_task(teacher, monkeys, {"title": "Water the plants"})
    lanterns = add_task(teacher, monkeys, {"title": "Buy lantern paper"})
    # New Tasks join at the end.
    assert backlog(teacher, monkeys) == ["Wash the smocks", "Water the plants", "Buy lantern paper"]

    reordered = teacher.put(
        f"/api/groups/{monkeys}/backlog", json={"taskIds": [lanterns, smocks, plants]}
    )

    assert reordered.status_code == 204, reordered.text
    assert backlog(admin, monkeys) == ["Buy lantern paper", "Wash the smocks", "Water the plants"]


def test_a_task_moved_back_to_to_do_joins_the_end_of_the_backlog(admin: TestClient) -> None:
    monkeys = create_group(admin)
    smocks = add_task(admin, monkeys, {"title": "Wash the smocks"})
    add_task(admin, monkeys, {"title": "Water the plants"})

    admin.put(f"/api/groups/{monkeys}/tasks/{smocks}/status", json={"status": "doing"})
    admin.put(f"/api/groups/{monkeys}/tasks/{smocks}/status", json={"status": "toDo"})

    assert backlog(admin, monkeys) == ["Water the plants", "Wash the smocks"]


def test_a_new_order_must_name_exactly_the_backlogs_tasks(admin: TestClient) -> None:
    monkeys = create_group(admin)
    bees = create_group(admin, "Bees", "bee")
    smocks = add_task(admin, monkeys, {"title": "Wash the smocks"})
    plants = add_task(admin, monkeys, {"title": "Water the plants"})
    done = add_task(admin, monkeys, {"title": "Lantern festival"})
    admin.put(f"/api/groups/{monkeys}/tasks/{done}/status", json={"status": "done"})
    elsewhere = add_task(admin, bees, {"title": "Feed the fish"})

    orders = [[plants], [plants, smocks, done], [plants, smocks, elsewhere], [plants, plants]]
    refused = [
        admin.put(f"/api/groups/{monkeys}/backlog", json={"taskIds": order}) for order in orders
    ]

    # E.g. someone else just added or moved a Task: reload, then try again.
    assert [response.json() for response in refused] == [{"detail": "backlog_changed"}] * 4
    assert backlog(admin, monkeys) == ["Wash the smocks", "Water the plants"]


def test_a_task_keeps_its_assignee_after_they_leave_the_group_until_changed(
    admin: TestClient, teacher_in_monkeys: tuple[int, int, TestClient]
) -> None:
    monkeys, teacher_id, _ = teacher_in_monkeys
    smocks = add_task(admin, monkeys, {**WASH_SMOCKS, "assigneeId": teacher_id})
    admin.put(f"/api/staff/{teacher_id}/groups", json={"groupIds": []})

    # Still theirs, so the Task can be changed without giving it to someone else first.
    retitled = admin.put(
        f"/api/groups/{monkeys}/tasks/{smocks}",
        json={**WASH_SMOCKS, "title": "Wash the smocks", "assigneeId": teacher_id},
    )
    unassigned = admin.put(f"/api/groups/{monkeys}/tasks/{smocks}", json=WASH_SMOCKS)
    given_back = admin.put(
        f"/api/groups/{monkeys}/tasks/{smocks}", json={**WASH_SMOCKS, "assigneeId": teacher_id}
    )

    assert retitled.status_code == 200, retitled.text
    assert retitled.json()["assignee"] == {"id": teacher_id, "email": TEACHER_EMAIL}
    assert unassigned.json()["assignee"] is None
    # But once changed, they can be given it again only if they work in the Group again.
    assert given_back.json() == {"detail": "not_in_group"}


def test_a_reordered_task_moved_away_and_back_joins_the_end(admin: TestClient) -> None:
    monkeys = create_group(admin)
    smocks = add_task(admin, monkeys, {"title": "Wash the smocks"})
    plants = add_task(admin, monkeys, {"title": "Water the plants"})
    lanterns = add_task(admin, monkeys, {"title": "Buy lantern paper"})
    admin.put(f"/api/groups/{monkeys}/backlog", json={"taskIds": [lanterns, plants, smocks]})

    admin.put(f"/api/groups/{monkeys}/tasks/{lanterns}/status", json={"status": "doing"})
    admin.put(f"/api/groups/{monkeys}/tasks/{lanterns}/status", json={"status": "toDo"})

    assert backlog(admin, monkeys) == ["Water the plants", "Wash the smocks", "Buy lantern paper"]
