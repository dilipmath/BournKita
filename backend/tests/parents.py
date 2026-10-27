"""Helpers for tests that need Parents."""

from typing import Any

from fastapi.testclient import TestClient

ANNA = {
    "firstName": "Anna",
    "lastName": "Müller",
    "address": "Lindenstraße 12, 10115 Berlin",
    "phone": "+49 30 1234567",
    "email": "anna.mueller@example.org",
}


def create_parent(admin: TestClient, **changes: Any) -> int:
    response = admin.post("/api/parents", json={**ANNA, **changes})
    assert response.status_code == 201, response.text
    parent_id: int = response.json()["id"]
    return parent_id


def link(client: TestClient, child_id: int, parent_id: int) -> int:
    return client.put(f"/api/children/{child_id}/parents/{parent_id}").status_code
