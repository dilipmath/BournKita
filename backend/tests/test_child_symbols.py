from fastapi.testclient import TestClient

from tests.children import LENA, create_child
from tests.groups import create_group, put_in_group


def symbol(client: TestClient, child_id: int) -> str:
    found: str = client.get(f"/api/children/{child_id}").json()["symbol"]
    return found


def change_symbol(admin: TestClient, child_id: int, new_symbol: str) -> int:
    profile = admin.get(f"/api/children/{child_id}").json()
    fields = {key: profile[key] for key in (*LENA, "symbol")}
    return admin.put(f"/api/children/{child_id}", json={**fields, "symbol": new_symbol}).status_code


def test_an_admin_gives_a_child_a_symbol_and_changes_it(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin, symbol="kite")

    assert symbol(teacher, lena) == "kite"
    assert change_symbol(admin, lena, "boat") == 200
    assert symbol(teacher, lena) == "boat"


def test_no_two_children_in_a_group_share_a_symbol(admin: TestClient) -> None:
    monkeys = create_group(admin, "Monkeys", "monkey")
    bees = create_group(admin, "Bees", "bee")
    lena = create_child(admin, symbol="kite")
    mia = create_child(admin, firstName="Mia", symbol="boat")
    emil = create_child(admin, firstName="Emil", symbol="star")
    put_in_group(admin, lena, monkeys)
    put_in_group(admin, mia, monkeys)
    put_in_group(admin, emil, bees)

    refused = admin.put(
        f"/api/children/{mia}",
        json={**LENA, "firstName": "Mia", "symbol": "kite"},
    )

    assert refused.status_code == 409
    assert refused.json()["detail"] == "symbol_taken"
    assert symbol(admin, mia) == "boat"
    # Another Group's Child may have it.
    assert change_symbol(admin, emil, "kite") == 200


def test_a_child_cannot_join_a_group_where_their_symbol_is_taken(admin: TestClient) -> None:
    monkeys = create_group(admin, "Monkeys", "monkey")
    lena = create_child(admin, symbol="kite")
    mia = create_child(admin, firstName="Mia", symbol="kite")
    put_in_group(admin, lena, monkeys)

    refused = admin.put(f"/api/children/{mia}/group", json={"groupId": monkeys})

    assert refused.status_code == 409
    assert refused.json()["detail"] == "symbol_taken"
    assert admin.get(f"/api/children/{mia}").json()["group"] is None
    assert change_symbol(admin, mia, "boat") == 200
    assert put_in_group(admin, mia, monkeys) == 204


def test_children_in_no_group_may_share_a_symbol(admin: TestClient) -> None:
    create_child(admin, symbol="kite")
    response = admin.post("/api/children", json={**LENA, "firstName": "Mia", "symbol": "kite"})

    assert response.status_code == 201


def test_only_the_apps_symbols_can_be_chosen(admin: TestClient) -> None:
    response = admin.post("/api/children", json={**LENA, "symbol": "dragon"})

    assert response.status_code == 422
