from typing import Any

from fastapi.testclient import TestClient

from tests.children import create_child
from tests.contacts import NACHBAR, add_contact, profile
from tests.fakes import MemoryFileStore
from tests.parents import create_parent, link
from tests.photos import jpeg, size_of, upload


def test_teachers_see_the_photo_of_a_pick_up_person(
    admin: TestClient, teacher: TestClient, file_store: MemoryFileStore
) -> None:
    # Without the Child's photo Consent: it covers the Child's photos, not adults'.
    lena = create_child(admin)
    tom = add_contact(admin, lena, "pickUp", NACHBAR)
    url = f"/api/children/{lena}/contacts/{tom}/photo"

    first = upload(admin, url, jpeg(), method="PUT")
    replaced = upload(admin, url, jpeg(600, 800), method="PUT")

    assert (first.status_code, replaced.status_code) == (204, 204)
    assert profile(teacher, lena)["pickUpPersons"][0]["photoId"] is not None
    assert size_of(teacher.get(f"{url}/thumbnail").content) == (240, 320)
    assert len(file_store.files) == 2  # The first photo's files are gone.


def test_an_admin_removes_a_pick_up_persons_photo(
    admin: TestClient, teacher: TestClient, file_store: MemoryFileStore
) -> None:
    lena = create_child(admin)
    tom = add_contact(admin, lena, "pickUp", NACHBAR)
    url = f"/api/children/{lena}/contacts/{tom}/photo"
    upload(admin, url, jpeg(), method="PUT")

    by_teacher = teacher.delete(url)
    removed = admin.delete(url)

    assert (by_teacher.status_code, removed.status_code) == (403, 204)
    assert profile(admin, lena)["pickUpPersons"][0]["photoId"] is None
    assert admin.get(f"{url}/thumbnail").status_code == 404
    assert file_store.files == {}


def test_removing_a_contact_removes_their_photo(
    admin: TestClient, file_store: MemoryFileStore
) -> None:
    lena = create_child(admin)
    tom = add_contact(admin, lena, "pickUp", NACHBAR)
    upload(admin, f"/api/children/{lena}/contacts/{tom}/photo", jpeg(), method="PUT")

    admin.delete(f"/api/children/{lena}/contacts/{tom}")

    assert file_store.files == {}


def test_a_parents_photo_shows_for_each_of_their_children(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    anna = create_parent(admin)
    link(admin, lena, anna)
    link(admin, mia, anna)

    uploaded = upload(admin, f"/api/parents/{anna}/photo", jpeg(), method="PUT")

    assert uploaded.status_code == 204, uploaded.text
    seen: list[dict[str, Any]] = [profile(teacher, child)["parents"][0] for child in (lena, mia)]
    assert seen[0]["photoId"] is not None
    assert seen[0]["photoId"] == seen[1]["photoId"]
    assert teacher.get(f"/api/parents/{anna}/photo/full").status_code == 200
    entries = admin.get("/api/audit-log", params={"action": "changed"}).json()
    assert [(entry["childId"], entry["changedFields"]) for entry in entries][:2] == [
        (mia, ["parentPhoto"]),
        (lena, ["parentPhoto"]),
    ]


def test_contact_photos_belong_to_their_child_only(admin: TestClient) -> None:
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    tom = add_contact(admin, lena, "pickUp", NACHBAR)
    upload(admin, f"/api/children/{lena}/contacts/{tom}/photo", jpeg(), method="PUT")

    through_mia = [
        admin.get(f"/api/children/{mia}/contacts/{tom}/photo/thumbnail"),
        upload(admin, f"/api/children/{mia}/contacts/{tom}/photo", jpeg(), method="PUT"),
        admin.delete(f"/api/children/{mia}/contacts/{tom}/photo"),
    ]

    assert [response.status_code for response in through_mia] == [404, 404, 404]
