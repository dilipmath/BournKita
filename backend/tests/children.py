"""Helpers for tests that need Child profiles."""

from typing import Any

from fastapi.testclient import TestClient

LENA = {
    "firstName": "Lena",
    "lastName": "Müller",
    "gender": "girl",
    "languages": "Deutsch, Türkisch",
    "foodPreferences": "Vegetarisch",
    "interests": "Malen, Dinosaurier",
    "dateOfBirth": None,
}


def create_child(admin: TestClient, **changes: Any) -> int:
    response = admin.post("/api/children", json={**LENA, **changes})
    assert response.status_code == 201, response.text
    child_id: int = response.json()["id"]
    return child_id


def own_fields(profile: dict[str, Any]) -> dict[str, Any]:
    """The Child's own fields of a profile, without the lists other modules add (Parents,
    contacts)."""
    return {key: profile[key] for key in ("id", *LENA)}
