
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from kita.settings import Settings
from tests.children import create_child
from tests.contacts import NACHBAR, OMA, add_contact, profile
from tests.parents import ANNA, create_parent, link


def changes(admin: TestClient) -> list[list[str]]:
    entries = admin.get("/api/audit-log", params={"action": "changed"}).json()
    return [entry["changedFields"] for entry in entries]


def test_teachers_see_a_childs_emergency_contacts_and_pick_up_persons(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    oma = add_contact(admin, lena, "emergency", OMA)
    tom = add_contact(admin, lena, "pickUp", NACHBAR)

    seen = profile(teacher, lena)

    assert seen["emergencyContacts"] == [{"id": oma, **OMA, "note": "", "photoId": None}]
    assert seen["pickUpPersons"] == [{"id": tom, **NACHBAR, "photoId": None}]
    assert changes(admin) == [["pickUpPersons"], ["emergencyContacts"]]


def test_parents_may_pick_up_unless_an_admin_says_otherwise(admin: TestClient) -> None:
    lena = create_child(admin)
    anna = create_parent(admin)
    link(admin, lena, anna)

    assert profile(admin, lena)["parents"] == [
        {"id": anna, **ANNA, "mayPickUp": True, "photoId": None}
    ]
    response = admin.put(f"/api/children/{lena}/parents/{anna}", json={"mayPickUp": False})

    assert response.status_code == 204
    assert profile(admin, lena)["parents"][0]["mayPickUp"] is False
    # A new link adds a Pick-up person too, unless the Admin says otherwise.
    assert changes(admin) == [["pickUpPersons"], ["parents", "pickUpPersons"]]


def test_an_admin_changes_and_removes_contacts(admin: TestClient) -> None:
    lena = create_child(admin)
    oma = add_contact(admin, lena, "emergency", OMA)
    tom = add_contact(admin, lena, "pickUp", NACHBAR)

    changed = admin.put(
        f"/api/children/{lena}/contacts/{oma}",
        json={"kind": "emergency", **OMA, "phone": "030 999"},
    )
    removed = admin.delete(f"/api/children/{lena}/contacts/{tom}")

    assert (changed.status_code, removed.status_code) == (200, 204)
    seen = profile(admin, lena)
    assert [contact["phone"] for contact in seen["emergencyContacts"]] == ["030 999"]
    assert seen["pickUpPersons"] == []
    assert changes(admin)[:2] == [["pickUpPersons"], ["emergencyContacts"]]


def test_teachers_cannot_change_contacts(admin: TestClient, teacher: TestClient) -> None:
    lena = create_child(admin)
    oma = add_contact(admin, lena, "emergency", OMA)
    anna = create_parent(admin)
    link(admin, lena, anna)

    refused = [
        teacher.post(f"/api/children/{lena}/contacts", json={"kind": "emergency", **OMA}),
        teacher.put(f"/api/children/{lena}/contacts/{oma}", json={"kind": "emergency", **OMA}),
        teacher.delete(f"/api/children/{lena}/contacts/{oma}"),
        teacher.put(f"/api/children/{lena}/parents/{anna}", json={"mayPickUp": False}),
    ]

    assert [response.status_code for response in refused] == [403, 403, 403, 403]


def test_a_contact_belongs_to_its_child_only(admin: TestClient) -> None:
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    oma = add_contact(admin, lena, "emergency", OMA)

    through_mia = [
        admin.put(f"/api/children/{mia}/contacts/{oma}", json={"kind": "emergency", **OMA}),
        admin.delete(f"/api/children/{mia}/contacts/{oma}"),
    ]

    assert [response.status_code for response in through_mia] == [404, 404]
    assert len(profile(admin, lena)["emergencyContacts"]) == 1


def test_contacts_need_a_name_and_valid_lengths(admin: TestClient) -> None:
    lena = create_child(admin)

    no_name = admin.post(
        f"/api/children/{lena}/contacts", json={"kind": "emergency", **OMA, "name": " "}
    )
    too_long = admin.post(
        f"/api/children/{lena}/contacts", json={"kind": "pickUp", **NACHBAR, "note": "x" * 1001}
    )

    assert no_name.json() == {"detail": "name_required"}
    assert too_long.json() == {"detail": "too_long"}


def test_phone_numbers_and_notes_are_not_stored_in_plain_text(
    admin: TestClient, settings: Settings
) -> None:
    lena = create_child(admin)
    add_contact(admin, lena, "pickUp", NACHBAR)

    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        dump = str(connection.execute(text("SELECT row_to_json(c) FROM child_contacts c")).all())
    engine.dispose()

    assert "Tom Weber" in dump
    assert "2223334" not in dump and "ID card" not in dump


def test_linking_a_parent_again_keeps_whether_they_may_pick_up(admin: TestClient) -> None:
    lena = create_child(admin)
    anna = create_parent(admin)
    link(admin, lena, anna)
    admin.put(f"/api/children/{lena}/parents/{anna}", json={"mayPickUp": False})

    link(admin, lena, anna)  # e.g. picked again in "Add Parent": no body

    assert profile(admin, lena)["parents"][0]["mayPickUp"] is False


def test_moving_a_contact_to_the_other_list_is_logged_for_both(admin: TestClient) -> None:
    lena = create_child(admin)
    oma = add_contact(admin, lena, "emergency", OMA)

    admin.put(f"/api/children/{lena}/contacts/{oma}", json={"kind": "pickUp", **OMA})

    seen = profile(admin, lena)
    assert (seen["emergencyContacts"], len(seen["pickUpPersons"])) == ([], 1)
    assert sorted(changes(admin)[0]) == ["emergencyContacts", "pickUpPersons"]
