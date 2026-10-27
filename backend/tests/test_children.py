from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

from tests.children import LENA, create_child, own_fields


def test_an_admin_creates_a_child_profile_and_reads_it_back(admin: TestClient) -> None:
    response = admin.post("/api/children", json=LENA)

    assert response.status_code == 201
    child_id = response.json()["id"]
    assert response.json() == {"id": child_id, **LENA}
    assert own_fields(admin.get(f"/api/children/{child_id}").json()) == {"id": child_id, **LENA}


def test_a_teacher_views_a_child_profile_but_cannot_create_one(
    admin: TestClient, teacher: TestClient
) -> None:
    child_id = create_child(admin)

    viewed = teacher.get(f"/api/children/{child_id}")
    created = teacher.post("/api/children", json=LENA)

    assert own_fields(viewed.json()) == {"id": child_id, **LENA}
    assert created.status_code == 403
    assert created.json() == {"detail": "admins_only"}


def test_child_profiles_need_a_login(
    admin: TestClient, new_client: Callable[[], TestClient]
) -> None:
    child_id = create_child(admin)

    assert new_client().get(f"/api/children/{child_id}").status_code == 401


def test_an_admin_edits_a_child_profile(admin: TestClient) -> None:
    child_id = create_child(admin)
    changed = {**LENA, "lastName": "Müller-Yılmaz", "gender": None, "interests": "Fußball"}

    response = admin.put(f"/api/children/{child_id}", json=changed)

    assert response.status_code == 200
    assert own_fields(admin.get(f"/api/children/{child_id}").json()) == {"id": child_id, **changed}


def test_a_teacher_cannot_edit_a_child_profile(admin: TestClient, teacher: TestClient) -> None:
    child_id = create_child(admin)

    response = teacher.put(f"/api/children/{child_id}", json={**LENA, "firstName": "Lea"})

    assert response.status_code == 403
    assert admin.get(f"/api/children/{child_id}").json()["firstName"] == "Lena"


def test_editing_a_missing_child_profile_is_not_found(admin: TestClient) -> None:
    assert admin.put("/api/children/999", json=LENA).status_code == 404


def test_an_admin_deletes_a_child_profile(admin: TestClient) -> None:
    child_id = create_child(admin)

    response = admin.delete(f"/api/children/{child_id}")

    assert response.status_code == 204
    assert admin.get(f"/api/children/{child_id}").status_code == 404
    assert admin.delete(f"/api/children/{child_id}").status_code == 404


def test_a_teacher_cannot_delete_a_child_profile(admin: TestClient, teacher: TestClient) -> None:
    child_id = create_child(admin)

    response = teacher.delete(f"/api/children/{child_id}")

    assert response.status_code == 403
    assert admin.get(f"/api/children/{child_id}").status_code == 200


def names(response: Any) -> list[str]:
    return [f"{child['firstName']} {child['lastName']}" for child in response.json()]


def test_every_staff_member_lists_the_children_by_first_name(
    admin: TestClient, teacher: TestClient
) -> None:
    create_child(admin, firstName="Mia", lastName="Schmidt")
    create_child(admin, firstName="Lena", lastName="Weber")
    create_child(admin, firstName="Lena", lastName="Becker")

    response = teacher.get("/api/children")

    assert response.status_code == 200
    assert names(response) == ["Lena Becker", "Lena Weber", "Mia Schmidt"]
    # The list shows names only; the rest of the profile is on its own page.
    assert set(response.json()[0]) == {"id", "firstName", "lastName"}


def test_the_list_is_searched_by_first_last_or_full_name_ignoring_case(admin: TestClient) -> None:
    create_child(admin, firstName="Lena", lastName="Müller")
    create_child(admin, firstName="Mia", lastName="Lenz")
    create_child(admin, firstName="Jonas", lastName="Weber")

    def search(text: str) -> list[str]:
        return names(admin.get("/api/children", params={"search": text}))

    assert search("len") == ["Lena Müller", "Mia Lenz"]
    assert search("MÜLLER") == ["Lena Müller"]
    assert search("  lena mü ") == ["Lena Müller"]
    assert search("müller lena") == ["Lena Müller"]
    assert search("%") == []


def test_a_child_profile_needs_a_first_and_last_name(admin: TestClient) -> None:
    for blank in ({"firstName": "  "}, {"lastName": ""}):
        response = admin.post("/api/children", json={**LENA, **blank})

        assert response.status_code == 422
        assert response.json() == {"detail": "name_required"}


def test_names_and_texts_are_stored_trimmed(admin: TestClient) -> None:
    child_id = create_child(
        admin, firstName=" Lena  Marie ", lastName="Müller\n", languages=" Deutsch "
    )

    profile = admin.get(f"/api/children/{child_id}").json()

    assert (profile["firstName"], profile["lastName"], profile["languages"]) == (
        "Lena Marie",
        "Müller",
        "Deutsch",
    )


def test_overlong_entries_are_refused(admin: TestClient) -> None:
    response = admin.post("/api/children", json={**LENA, "interests": "x" * 2001})

    assert response.status_code == 422
    assert response.json() == {"detail": "too_long"}
