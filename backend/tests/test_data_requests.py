import json
import zipfile
from io import BytesIO
from typing import Any

from fastapi.testclient import TestClient

from tests.children import create_child
from tests.contacts import OMA, add_contact
from tests.fakes import FixedClock, MemoryFileStore
from tests.groups import create_group, put_in_group
from tests.parents import ANNA, create_parent, link
from tests.photos import give_photo_consent, jpeg, size_of, upload
from tests.test_incidents import FALL, incident_log, report


def export(client: TestClient, parent_id: int) -> tuple[dict[str, Any], dict[str, bytes]]:
    """The export's data.json, and every file in it by name."""
    response = client.get(f"/api/parents/{parent_id}/export")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(BytesIO(response.content)) as archive:
        files = {name: archive.read(name) for name in archive.namelist()}
    data: dict[str, Any] = json.loads(files["data.json"])
    return data, files


def test_the_export_holds_the_parent_and_all_their_children_archived_ones_too(
    admin: TestClient,
) -> None:
    anna = create_parent(admin)
    lena = create_child(admin, firstName="Lena", dateOfBirth="2022-03-14")
    tim = create_child(admin, firstName="Tim")
    create_child(admin, firstName="Mia")  # Not Anna's.
    link(admin, lena, anna)
    link(admin, tim, anna)
    admin.delete(f"/api/children/{tim}")

    data, _ = export(admin, anna)

    assert data["exportedAt"] == "2027-01-04T08:00:00Z"
    assert {key: data["parent"][key] for key in ANNA} == ANNA
    assert [(child["firstName"], child["archivedAt"]) for child in data["children"]] == [
        ("Lena", None),
        ("Tim", "2027-01-04T08:00:00Z"),
    ]
    assert data["children"][0]["dateOfBirth"] == "2022-03-14"
    assert data["children"][0]["interests"] == "Malen, Dinosaurier"


def test_the_export_covers_every_kind_of_data_and_the_photo_files(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    anna = create_parent(admin)
    jan = create_parent(admin, firstName="Jan")
    lena = create_child(admin)
    put_in_group(admin, lena, create_group(admin))
    link(admin, lena, anna)
    link(admin, lena, jan)
    admin.put(f"/api/children/{lena}/parents/{jan}", json={"mayPickUp": False})
    assert upload(admin, f"/api/parents/{anna}/photo", jpeg(), "PUT").is_success
    oma = add_contact(admin, lena, "pickUp", OMA)
    upload(admin, f"/api/children/{lena}/contacts/{oma}/photo", jpeg(), "PUT")
    admin.post(f"/api/children/{lena}/alerts", json={"kind": "allergy", "name": "Peanuts"})
    give_photo_consent(admin, lena)
    photo = upload(admin, f"/api/children/{lena}/photos", jpeg()).json()["id"]
    # Withdrawn, so no longer shown; but the Kita still holds the photo.
    admin.post(f"/api/children/{lena}/consents/photo/withdrawn", json={"withdrawnOn": "2027-01-04"})
    teacher.post(f"/api/children/{lena}/attendance/check-in")
    teacher.post(
        f"/api/children/{lena}/absences", json={"startsOn": "2027-01-11", "reason": "sick"}
    )
    incident = report(teacher, lena).json()["id"]
    admin.post(f"/api/incidents/{incident}/follow-ups", json={"note": "Parents called back."})

    data, files = export(admin, anna)

    child = data["children"][0]
    assert child["group"] == "Monkeys"
    assert [(p["firstName"], p["mayPickUp"]) for p in child["parents"]] == [
        ("Anna", True),
        ("Jan", False),
    ]
    assert child["contacts"] == [
        {**OMA, "id": oma, "kind": "pickUp", "note": "", "photo": f"photos/contact-{oma}.jpg"}
    ]
    assert [(a["kind"], a["name"]) for a in child["alerts"]] == [("allergy", "Peanuts")]
    assert child["consents"]["photo"] == [{"givenOn": "2026-09-01", "withdrawnOn": "2027-01-04"}]
    assert child["photos"] == [
        {"id": photo, "uploadedAt": "2027-01-04T08:00:00Z", "file": f"photos/child-{photo}.jpg"}
    ]
    assert child["attendance"] == [
        {"on": "2027-01-04", "checkedInAt": "2027-01-04T08:00:00Z", "checkedOutAt": None}
    ]
    assert [(a["startsOn"], a["endsOn"], a["reason"]) for a in child["absences"]] == [
        ("2027-01-11", "2027-01-11", "sick")
    ]
    assert [i["description"] for i in child["incidents"]] == [FALL["description"]]
    assert [f["note"] for f in child["incidents"][0]["followUps"]] == ["Parents called back."]
    assert data["parent"]["photo"] == f"photos/parent-{anna}.jpg"
    # The photos as JPEG files, as large as the Kita keeps them.
    for name in (
        f"photos/child-{photo}.jpg",
        f"photos/contact-{oma}.jpg",
        f"photos/parent-{anna}.jpg",
    ):
        assert size_of(files[name]) == (1200, 900)


def delete_permanently(admin: TestClient, parent_id: int) -> int:
    return admin.delete(f"/api/parents/{parent_id}/data").status_code


def test_deleting_permanently_leaves_nothing_of_the_parent_and_their_children(
    admin: TestClient, file_store: MemoryFileStore
) -> None:
    anna = create_parent(admin)
    lena = create_child(admin, firstName="Lena")
    tim = create_child(admin, firstName="Tim")
    mia = create_child(admin, firstName="Mia", lastName="Schmidt")
    # Jan is only Lena's other Parent; Petra also has Mia, who is not Anna's.
    jan = create_parent(admin, firstName="Jan")
    petra = create_parent(admin, firstName="Petra")
    for child, parent in ((lena, anna), (tim, anna), (lena, jan), (lena, petra), (mia, petra)):
        link(admin, child, parent)
    give_photo_consent(admin, mia)
    mias_photo = upload(admin, f"/api/children/{mia}/photos", jpeg()).json()["id"]
    mias_files = set(file_store.files)
    upload(admin, f"/api/parents/{anna}/photo", jpeg(), "PUT")
    give_photo_consent(admin, lena)
    upload(admin, f"/api/children/{lena}/photos", jpeg())
    report(admin, lena)
    admin.delete(f"/api/children/{tim}")

    assert delete_permanently(admin, anna) == 204

    assert admin.get(f"/api/parents/{anna}").status_code == 404
    assert [child["firstName"] for child in admin.get("/api/children").json()] == ["Mia"]
    assert admin.get("/api/archive").json() == []
    assert admin.post(f"/api/archive/{tim}/restore").status_code == 404
    assert incident_log(admin) == []
    # A Parent left with no Child goes too; one who still has a Child stays.
    assert admin.get(f"/api/parents/{jan}").status_code == 404
    petras = admin.get(f"/api/parents/{petra}").json()["children"]
    assert [child["id"] for child in petras] == [mia]
    # Only Mia's photo files are left.
    assert set(file_store.files) == mias_files
    assert admin.get(f"/api/children/{mia}/photos/{mias_photo}/full").status_code == 200
    assert delete_permanently(admin, anna) == 404


def test_the_audit_log_records_the_export_and_the_deletion_without_personal_data(
    admin: TestClient,
) -> None:
    anna = create_parent(admin)
    lena = create_child(admin)
    link(admin, lena, anna)

    export(admin, anna)
    delete_permanently(admin, anna)

    entries = admin.get("/api/audit-log", params={"childId": str(lena)}).json()
    assert [(entry["action"], entry["changedFields"]) for entry in entries[:2]] == [
        ("deleted", ["permanently"]),
        ("viewed", []),
    ]
    # Nothing of theirs is left in it: no names, nor anything else they were.
    log = json.dumps(admin.get("/api/audit-log").json())
    for held in ("Lena", "Müller", "Anna", "Lindenstraße", "anna.mueller"):
        assert held not in log


def test_only_admins_export_and_delete_permanently(admin: TestClient, teacher: TestClient) -> None:
    anna = create_parent(admin)

    assert teacher.get(f"/api/parents/{anna}/export").status_code == 403
    assert teacher.delete(f"/api/parents/{anna}/data").status_code == 403
    assert admin.get("/api/parents/999/export").status_code == 404
    assert admin.get(f"/api/parents/{anna}").status_code == 200
