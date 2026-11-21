"""Helpers for tests that need Child profiles."""

from itertools import cycle
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


# The Symbols create_child hands out in turn, so that a test's Children can share a Group; each
# test starts again at the first (see reset_symbols).
_IN_TURN = ["apple", "cloud", "drop", "fish", "flower", "heart", "house", "kite", "leaf", "moon"]
_symbols = cycle(_IN_TURN)
# The Symbol each Child got from create_child, by ID.
_symbol_of: dict[int, str] = {}


def reset_symbols() -> None:
    """Starts the Symbols in turn again and forgets the Children: before each test."""
    global _symbols
    _symbols = cycle(_IN_TURN)
    _symbol_of.clear()


def create_child(admin: TestClient, **changes: Any) -> int:
    response = admin.post("/api/children", json={**LENA, "symbol": next(_symbols), **changes})
    assert response.status_code == 201, response.text
    child_id: int = response.json()["id"]
    _symbol_of[child_id] = response.json()["symbol"]
    return child_id


def own_fields(profile: dict[str, Any]) -> dict[str, Any]:
    """The Child's own fields of a profile, without the lists other modules add (Parents,
    contacts)."""
    return {key: profile[key] for key in ("id", *LENA, "symbol")}


def child_fields(child_id: int) -> dict[str, Any]:
    """Lena's fields with the Symbol this Child was created with: a change to the profile that
    leaves the Symbol as it is."""
    return {**LENA, "symbol": _symbol_of[child_id]}
