"""Helpers for tests that need Groups."""

from typing import Any

from fastapi.testclient import TestClient


def create_group(admin: TestClient, name: str = "Monkeys", icon: str = "monkey") -> int:
    response = admin.post("/api/groups", json={"name": name, "icon": icon})
    assert response.status_code == 201, response.text
    group_id: int = response.json()["id"]
    return group_id


def groups(client: TestClient) -> list[dict[str, Any]]:
    response = client.get("/api/groups")
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()
    return found


def put_in_group(admin: TestClient, child_id: int, group_id: int | None) -> int:
    return admin.put(f"/api/children/{child_id}/group", json={"groupId": group_id}).status_code
