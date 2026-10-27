"""Helpers for tests that need a Child's contacts."""

from typing import Any

from fastapi.testclient import TestClient

OMA = {"name": "Erika Müller", "relationship": "Grandmother", "phone": "+49 30 7654321"}
NACHBAR = {
    "name": "Tom Weber",
    "relationship": "Neighbour",
    "phone": "0171 2223334",
    "note": "Shows his ID card",
}


def add_contact(admin: TestClient, child_id: int, kind: str, contact: dict[str, Any]) -> int:
    response = admin.post(f"/api/children/{child_id}/contacts", json={"kind": kind, **contact})
    assert response.status_code == 201, response.text
    contact_id: int = response.json()["id"]
    return contact_id


def profile(client: TestClient, child_id: int) -> dict[str, Any]:
    response = client.get(f"/api/children/{child_id}")
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body
