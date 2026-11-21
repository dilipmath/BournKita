from fastapi.testclient import TestClient

from tests.groups import create_group, groups


def colours(client: TestClient) -> dict[str, str]:
    return {group["name"]: group["colour"] for group in groups(client)}


def test_an_admin_chooses_a_groups_colour_and_changes_it(
    admin: TestClient, teacher: TestClient
) -> None:
    created = admin.post("/api/groups", json={"name": "Bees", "icon": "bee", "colour": "yellow"})
    bees = created.json()["id"]

    changed = admin.put(
        f"/api/groups/{bees}", json={"name": "Bees", "icon": "bee", "colour": "teal"}
    )

    assert created.status_code == 201
    assert created.json()["colour"] == "yellow"
    assert changed.json()["colour"] == "teal"
    assert colours(teacher) == {"Bees": "teal"}


def test_groups_created_without_a_colour_get_the_next_in_turn(admin: TestClient) -> None:
    create_group(admin, "Monkeys", "monkey")
    create_group(admin, "Butterflies", "butterfly")
    create_group(admin, "Frogs", "frog")

    assert colours(admin) == {"Monkeys": "orange", "Butterflies": "lilac", "Frogs": "green"}


def test_changing_a_group_without_a_colour_keeps_its_colour(admin: TestClient) -> None:
    created = admin.post("/api/groups", json={"name": "Bees", "icon": "bee", "colour": "rose"})

    admin.put(f"/api/groups/{created.json()['id']}", json={"name": "Busy Bees", "icon": "bee"})

    assert colours(admin) == {"Busy Bees": "rose"}


def test_only_the_kitas_colours_can_be_chosen(admin: TestClient) -> None:
    refused = admin.post("/api/groups", json={"name": "Bees", "icon": "bee", "colour": "neon"})

    assert refused.status_code == 422
    assert groups(admin) == []
