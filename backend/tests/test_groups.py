from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.accounts import TEACHER_EMAIL, onboard
from tests.children import create_child
from tests.fakes import OutageMailer
from tests.groups import create_group, groups


def test_every_staff_member_sees_the_groups_an_admin_created(
    admin: TestClient, teacher: TestClient
) -> None:
    monkeys = create_group(admin, "Monkeys", "monkey")
    butterflies = create_group(admin, "Butterflies", "butterfly")

    assert groups(teacher) == [
        {"id": butterflies, "name": "Butterflies", "icon": "butterfly", "mine": False},
        {"id": monkeys, "name": "Monkeys", "icon": "monkey", "mine": False},
    ]


def test_an_admin_renames_and_removes_groups(admin: TestClient) -> None:
    monkeys = create_group(admin, "Monkeys", "monkey")
    bees = create_group(admin, "Bees", "bee")

    renamed = admin.put(f"/api/groups/{monkeys}", json={"name": "Little Monkeys", "icon": "fox"})
    removed = admin.delete(f"/api/groups/{bees}")

    assert renamed.status_code == 200, renamed.text
    assert removed.status_code == 204
    assert [(group["name"], group["icon"]) for group in groups(admin)] == [
        ("Little Monkeys", "fox")
    ]
    assert admin.delete(f"/api/groups/{bees}").status_code == 404


def test_group_names_are_required_and_unique(admin: TestClient) -> None:
    monkeys = create_group(admin, "Monkeys")
    bees = create_group(admin, "Bees", "bee")

    refused = [
        admin.post("/api/groups", json={"name": " ", "icon": "bee"}),
        admin.post("/api/groups", json={"name": "monkeys", "icon": "bee"}),
        admin.put(f"/api/groups/{bees}", json={"name": "MONKEYS ", "icon": "bee"}),
        admin.post("/api/groups", json={"name": "Owls", "icon": "unicorn"}),
    ]

    assert [response.json().get("detail") for response in refused[:3]] == [
        "name_required",
        "group_name_taken",
        "group_name_taken",
    ]
    assert refused[3].status_code == 422
    # Keeping its own name, in another case, is no clash.
    assert (
        admin.put(f"/api/groups/{monkeys}", json={"name": "MONKEYS", "icon": "monkey"}).status_code
        == 200
    )


def test_teachers_cannot_change_groups(admin: TestClient, teacher: TestClient) -> None:
    monkeys = create_group(admin)

    refused = [
        teacher.post("/api/groups", json={"name": "Bees", "icon": "bee"}),
        teacher.put(f"/api/groups/{monkeys}", json={"name": "Bees", "icon": "bee"}),
        teacher.delete(f"/api/groups/{monkeys}"),
    ]

    assert [response.status_code for response in refused] == [403, 403, 403]


def put_in_group(admin: TestClient, child_id: int, group_id: int | None) -> int:
    return admin.put(f"/api/children/{child_id}/group", json={"groupId": group_id}).status_code


def dashboard_children(client: TestClient, group_id: int) -> list[str]:
    response = client.get(f"/api/groups/{group_id}")
    assert response.status_code == 200, response.text
    return [f"{child['firstName']} {child['lastName']}" for child in response.json()["children"]]


def test_a_group_dashboard_shows_only_that_groups_children(
    admin: TestClient, teacher: TestClient
) -> None:
    monkeys = create_group(admin, "Monkeys", "monkey")
    bees = create_group(admin, "Bees", "bee")
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    create_child(admin, firstName="Emil")  # In no Group yet.

    assert [put_in_group(admin, lena, monkeys), put_in_group(admin, mia, bees)] == [204, 204]

    assert dashboard_children(teacher, monkeys) == ["Lena Müller"]
    assert dashboard_children(teacher, bees) == ["Mia Müller"]
    assert teacher.get(f"/api/children/{lena}").json()["group"] == {
        "id": monkeys,
        "name": "Monkeys",
        "icon": "monkey",
    }


def test_a_child_is_in_one_group_at_most(admin: TestClient) -> None:
    monkeys = create_group(admin, "Monkeys", "monkey")
    bees = create_group(admin, "Bees", "bee")
    lena = create_child(admin)
    put_in_group(admin, lena, monkeys)

    put_in_group(admin, lena, bees)  # Moved.

    assert (dashboard_children(admin, monkeys), dashboard_children(admin, bees)) == (
        [],
        ["Lena Müller"],
    )
    put_in_group(admin, lena, None)
    assert admin.get(f"/api/children/{lena}").json()["group"] is None
    entries = admin.get("/api/audit-log", params={"action": "changed"}).json()
    assert [entry["changedFields"] for entry in entries] == [["group"]] * 3


def test_removing_a_group_leaves_its_children_in_no_group(admin: TestClient) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    put_in_group(admin, lena, monkeys)

    admin.delete(f"/api/groups/{monkeys}")

    assert admin.get(f"/api/children/{lena}").json()["group"] is None
    # Taken out of it, as if moved by hand.
    entries = admin.get("/api/audit-log", params={"action": "changed"}).json()
    assert [(entry["childId"], entry["changedFields"]) for entry in entries] == [
        (lena, ["group"]),
        (lena, ["group"]),
    ]


def test_only_admins_put_children_in_groups_and_only_in_existing_ones(
    admin: TestClient, teacher: TestClient
) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)

    assert put_in_group(teacher, lena, monkeys) == 403
    assert put_in_group(admin, lena, 999) == 404
    assert put_in_group(admin, 999, monkeys) == 404
    assert admin.get("/api/groups/999").status_code == 404


def test_a_staff_members_own_groups_are_marked_as_theirs(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: OutageMailer
) -> None:
    monkeys = create_group(admin, "Monkeys", "monkey")
    create_group(admin, "Bees", "bee")
    owls = create_group(admin, "Owls", "owl")
    account, teacher = onboard(admin, new_client, mailer)

    # A Staff member covering two Groups works in both.
    assigned = admin.put(f"/api/staff/{account}/groups", json={"groupIds": [owls, monkeys]})

    assert assigned.status_code == 200, assigned.text
    assert [(group["name"], group["mine"]) for group in groups(teacher)] == [
        ("Bees", False),
        ("Monkeys", True),
        ("Owls", True),
    ]
    staff = {account["email"]: account["groupIds"] for account in admin.get("/api/staff").json()}
    assert staff[TEACHER_EMAIL] == [monkeys, owls]
    assert admin.put(f"/api/staff/{account}/groups", json={"groupIds": []}).status_code == 200
    assert not any(group["mine"] for group in groups(teacher))


def test_only_admins_say_who_works_in_which_group(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: OutageMailer
) -> None:
    monkeys = create_group(admin)
    account, teacher = onboard(admin, new_client, mailer)

    by_teacher = teacher.put(f"/api/staff/{account}/groups", json={"groupIds": [monkeys]})
    unknown_group = admin.put(f"/api/staff/{account}/groups", json={"groupIds": [999]})
    unknown_account = admin.put("/api/staff/999/groups", json={"groupIds": [monkeys]})

    assert [by_teacher.status_code, unknown_group.status_code, unknown_account.status_code] == [
        403,
        404,
        404,
    ]
