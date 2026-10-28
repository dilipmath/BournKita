from typing import Any

from fastapi.testclient import TestClient

from tests.groups import create_group

WASH_SMOCKS = {"title": "Wash the painting smocks", "note": "Before Friday"}


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
        {"id": smocks, **WASH_SMOCKS, "status": "toDo"},
        {"id": plants, "title": "Water the plants", "note": "", "status": "toDo"},
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
    assert edited.json() == {"id": smocks, "title": "Wash the smocks", "note": "", "status": "toDo"}
    assert board(teacher, monkeys) == [
        {"id": smocks, "title": "Wash the smocks", "note": "", "status": "doing"}
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
    assert board(admin, monkeys) == [{"id": smocks, **WASH_SMOCKS, "status": "toDo"}]


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
