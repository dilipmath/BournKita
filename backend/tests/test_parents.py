from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from kita.settings import Settings
from tests.children import create_child
from tests.parents import ANNA, create_parent, link


def parents_on_profile(client: TestClient, child_id: int) -> list[dict[str, Any]]:
    parents: list[dict[str, Any]] = client.get(f"/api/children/{child_id}").json()["parents"]
    return parents


def test_siblings_share_one_parent_record_that_teachers_can_read(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    max_ = create_child(admin, firstName="Max")
    anna = create_parent(admin)

    assert [link(admin, lena, anna), link(admin, max_, anna)] == [204, 204]

    for child_id in (lena, max_):
        assert parents_on_profile(teacher, child_id) == [
            {"id": anna, **ANNA, "mayPickUp": True, "photoId": None}
        ]
    parent = teacher.get(f"/api/parents/{anna}").json()
    assert parent["children"] == [
        {"id": lena, "firstName": "Lena", "lastName": "Müller"},
        {"id": max_, "firstName": "Max", "lastName": "Müller"},
    ]


def test_contact_details_are_not_stored_in_plain_text(
    admin: TestClient, settings: Settings
) -> None:
    create_parent(admin)

    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        dump = str(connection.execute(text("SELECT row_to_json(p) FROM parents p")).all())
    engine.dispose()

    assert "Anna" in dump  # names stay searchable
    for secret in ("Lindenstraße", "Berlin", "1234567", "anna.mueller@example.org"):
        assert secret not in dump


def audit_entries(admin: TestClient) -> list[tuple[str, int, list[str]]]:
    return [
        (entry["action"], entry["childId"], entry["changedFields"])
        for entry in admin.get("/api/audit-log").json()
    ]


def test_teachers_can_neither_create_edit_nor_link_parents(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    anna = create_parent(admin)

    refused = [
        teacher.post("/api/parents", json=ANNA),
        teacher.put(f"/api/parents/{anna}", json={**ANNA, "phone": "0"}),
        teacher.put(f"/api/children/{lena}/parents/{anna}"),
        teacher.delete(f"/api/children/{lena}/parents/{anna}"),
    ]

    assert [response.status_code for response in refused] == [403, 403, 403, 403]
    assert parents_on_profile(admin, lena) == []


def test_editing_a_parent_changes_it_for_all_their_children_and_logs_each(
    admin: TestClient,
) -> None:
    lena = create_child(admin)
    max_ = create_child(admin, firstName="Max")
    anna = create_parent(admin)
    link(admin, lena, anna)
    link(admin, max_, anna)

    response = admin.put(f"/api/parents/{anna}", json={**ANNA, "address": "Neue Straße 1"})

    assert response.status_code == 200
    for child_id in (lena, max_):
        assert parents_on_profile(admin, child_id)[0]["address"] == "Neue Straße 1"
    changes = [entry for entry in audit_entries(admin) if entry[2] == ["parentAddress"]]
    assert sorted(changes) == sorted(
        [("changed", lena, ["parentAddress"]), ("changed", max_, ["parentAddress"])]
    )


def test_linking_and_unlinking_are_logged_as_changes_of_the_child(admin: TestClient) -> None:
    lena = create_child(admin)
    anna = create_parent(admin)

    link(admin, lena, anna)
    link(admin, lena, anna)  # already linked: nothing changes
    unlinked = admin.delete(f"/api/children/{lena}/parents/{anna}")

    assert unlinked.status_code == 204
    assert parents_on_profile(admin, lena) == []
    assert admin.get(f"/api/parents/{anna}").json()["children"] == []
    # Both times, the Parent also became, then stopped being, a Pick-up person.
    assert [entry for entry in audit_entries(admin) if entry[0] == "changed"] == [
        ("changed", lena, ["parents", "pickUpPersons"]),
        ("changed", lena, ["parents", "pickUpPersons"]),
    ]


def test_opening_a_parent_logs_a_view_of_each_of_their_children(admin: TestClient) -> None:
    lena = create_child(admin)
    max_ = create_child(admin, firstName="Max")
    anna = create_parent(admin)
    link(admin, lena, anna)
    link(admin, max_, anna)

    admin.get(f"/api/parents/{anna}")

    views = [entry[:2] for entry in audit_entries(admin) if entry[0] == "viewed"]
    assert sorted(views) == sorted([("viewed", lena), ("viewed", max_)])


def test_deleting_a_child_keeps_the_parent_for_the_siblings(admin: TestClient) -> None:
    lena = create_child(admin)
    max_ = create_child(admin, firstName="Max")
    anna = create_parent(admin)
    link(admin, lena, anna)
    link(admin, max_, anna)

    admin.delete(f"/api/children/{lena}")

    assert [child["id"] for child in admin.get(f"/api/parents/{anna}").json()["children"]] == [max_]


def test_parents_need_names_valid_lengths_and_existing_children(admin: TestClient) -> None:
    lena = create_child(admin)
    anna = create_parent(admin)

    no_name = admin.post("/api/parents", json={**ANNA, "lastName": " "})
    too_long = admin.post("/api/parents", json={**ANNA, "address": "x" * 501})

    assert (no_name.status_code, no_name.json()) == (422, {"detail": "name_required"})
    assert (too_long.status_code, too_long.json()) == (422, {"detail": "too_long"})
    assert link(admin, 999, anna) == 404
    assert link(admin, lena, 999) == 404
    assert admin.get("/api/parents/999").status_code == 404


def test_admins_find_parents_by_name_to_link_siblings(admin: TestClient) -> None:
    create_parent(admin)
    create_parent(admin, firstName="Jonas", lastName="Weber")

    found = admin.get("/api/parents", params={"search": "müller anna"}).json()

    assert [(parent["firstName"], parent["lastName"]) for parent in found] == [("Anna", "Müller")]
    assert set(found[0]) == {"id", "firstName", "lastName"}


def test_an_encrypted_value_copied_to_another_parent_does_not_read_back_there(
    admin: TestClient, settings: Settings
) -> None:
    anna = create_parent(admin)
    jonas = create_parent(admin, firstName="Jonas", address="Am Markt 1")

    engine = create_engine(settings.database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE parents SET address = (SELECT address FROM parents WHERE id = :anna) WHERE id = :jonas"
            ),
            {"anna": anna, "jonas": jonas},
        )
    engine.dispose()

    # Someone with database access cannot move one family's details onto another's record.
    assert admin.get(f"/api/parents/{jonas}").status_code == 500
    assert admin.get(f"/api/parents/{anna}").json()["address"] == ANNA["address"]
