import io
from typing import Any

from fastapi.testclient import TestClient
from PIL import Image

from tests.children import create_child
from tests.contacts import NACHBAR, add_contact
from tests.fakes import MemoryFileStore
from tests.photos import give_photo_consent, jpeg, size_of, upload


def photos(client: TestClient, child_id: int) -> list[dict[str, Any]]:
    response = client.get(f"/api/children/{child_id}")
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()["photos"]
    return found


def test_teachers_see_photos_an_admin_uploaded_with_quick_thumbnails(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    give_photo_consent(admin, lena)

    uploaded = upload(admin, f"/api/children/{lena}/photos", jpeg(1200, 900))

    assert uploaded.status_code == 201, uploaded.text
    photo = uploaded.json()["id"]
    assert photos(teacher, lena) == [{"id": photo, "uploadedAt": "2027-01-04T08:00:00Z"}]
    thumbnail = teacher.get(f"/api/children/{lena}/photos/{photo}/thumbnail")
    full = teacher.get(f"/api/children/{lena}/photos/{photo}/full")
    assert (thumbnail.headers["content-type"], full.headers["content-type"]) == (
        "image/jpeg",
        "image/jpeg",
    )
    assert size_of(thumbnail.content) == (320, 240)
    assert size_of(full.content) == (1200, 900)


def test_without_photo_consent_no_photo_is_uploaded(admin: TestClient) -> None:
    lena = create_child(admin)

    refused = upload(admin, f"/api/children/{lena}/photos", jpeg())

    assert refused.status_code == 409
    assert refused.json() == {"detail": "no_photo_consent"}


def test_withdrawing_photo_consent_hides_the_photos_at_once(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    give_photo_consent(admin, lena)
    photo = upload(admin, f"/api/children/{lena}/photos", jpeg()).json()["id"]

    admin.post(f"/api/children/{lena}/consents/photo/withdrawn", json={"withdrawnOn": "2027-01-04"})

    assert photos(teacher, lena) == []
    hidden = [
        teacher.get(f"/api/children/{lena}/photos/{photo}/{size}").status_code
        for size in ("thumbnail", "full")
    ]
    assert hidden == [404, 404]
    # Given again, the Kita may show them again.
    admin.post(f"/api/children/{lena}/consents/photo/given", json={"givenOn": "2027-01-04"})
    assert [found["id"] for found in photos(teacher, lena)] == [photo]


def test_photos_lose_their_camera_metadata_and_are_stored_encrypted(
    admin: TestClient, file_store: MemoryFileStore
) -> None:
    lena = create_child(admin)
    give_photo_consent(admin, lena)
    # 0x010E: a description, as some cameras write the owner's name there.
    original = jpeg(tag_010E="Garden of Rosenweg 12")
    assert b"Rosenweg" in original

    photo = upload(admin, f"/api/children/{lena}/photos", original).json()["id"]

    full = admin.get(f"/api/children/{lena}/photos/{photo}/full").content
    with Image.open(io.BytesIO(full)) as image:
        assert dict(image.getexif()) == {}
    assert b"Rosenweg" not in full
    assert file_store.files
    for stored in file_store.files.values():
        assert not stored.startswith(b"\xff\xd8")  # No JPEG a backup could show.
        assert b"JFIF" not in stored


def test_only_admins_upload_photos_and_only_photos(admin: TestClient, teacher: TestClient) -> None:
    lena = create_child(admin)
    give_photo_consent(admin, lena)
    url = f"/api/children/{lena}/photos"

    by_teacher = upload(teacher, url, jpeg())
    not_a_photo = upload(admin, url, b"%PDF-1.7 a letter to the parents")
    too_large = upload(admin, url, jpeg() + b"\0" * 20_000_000)

    assert by_teacher.status_code == 403
    assert (not_a_photo.status_code, not_a_photo.json()) == (422, {"detail": "not_an_image"})
    assert (too_large.status_code, too_large.json()) == (413, {"detail": "too_large"})
    assert photos(admin, lena) == []


def test_an_admin_deletes_a_photo_and_its_files(
    admin: TestClient, teacher: TestClient, file_store: MemoryFileStore
) -> None:
    lena = create_child(admin)
    give_photo_consent(admin, lena)
    first = upload(admin, f"/api/children/{lena}/photos", jpeg()).json()["id"]
    second = upload(admin, f"/api/children/{lena}/photos", jpeg()).json()["id"]

    by_teacher = teacher.delete(f"/api/children/{lena}/photos/{first}")
    deleted = admin.delete(f"/api/children/{lena}/photos/{first}")

    assert (by_teacher.status_code, deleted.status_code) == (403, 204)
    assert [photo["id"] for photo in photos(admin, lena)] == [second]
    assert admin.get(f"/api/children/{lena}/photos/{first}/full").status_code == 404
    assert len(file_store.files) == 2  # The second photo's thumbnail and full size.
    entries = admin.get("/api/audit-log", params={"action": "changed"}).json()
    assert [entry["changedFields"] for entry in entries][:3] == [["photos"]] * 3


def test_deleting_a_child_deletes_their_and_their_contacts_photo_files(
    admin: TestClient, file_store: MemoryFileStore
) -> None:
    lena = create_child(admin)
    give_photo_consent(admin, lena)
    upload(admin, f"/api/children/{lena}/photos", jpeg())
    tom = add_contact(admin, lena, "pickUp", NACHBAR)
    upload(admin, f"/api/children/{lena}/contacts/{tom}/photo", jpeg(), method="PUT")

    assert admin.delete(f"/api/children/{lena}").status_code == 204

    assert file_store.files == {}


def test_a_tablet_keeps_photos_but_asks_each_time_whether_it_may_still_show_them(
    admin: TestClient,
) -> None:
    lena = create_child(admin)
    give_photo_consent(admin, lena)
    photo = upload(admin, f"/api/children/{lena}/photos", jpeg()).json()["id"]
    url = f"/api/children/{lena}/photos/{photo}/thumbnail"

    first = admin.get(url)
    again = admin.get(url, headers={"If-None-Match": first.headers["etag"]})
    admin.post(f"/api/children/{lena}/consents/photo/withdrawn", json={"withdrawnOn": "2027-01-04"})
    after_withdrawal = admin.get(url, headers={"If-None-Match": first.headers["etag"]})

    assert first.headers["cache-control"] == "private, no-cache"
    assert (again.status_code, again.content) == (304, b"")
    assert after_withdrawal.status_code == 404


def test_photos_with_too_many_pixels_are_refused_before_they_are_decoded(
    admin: TestClient,
) -> None:
    lena = create_child(admin)
    give_photo_consent(admin, lena)
    # 64 million pixels in a few kilobytes, as a file meant to exhaust memory might be.
    buffer = io.BytesIO()
    Image.new("1", (8000, 8000)).save(buffer, "PNG")

    refused = upload(admin, f"/api/children/{lena}/photos", buffer.getvalue())

    assert (refused.status_code, refused.json()) == (413, {"detail": "too_large"})
