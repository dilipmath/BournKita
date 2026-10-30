from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from kita.app import create_app
from kita.settings import Settings
from tests.accounts import create_admin, log_in
from tests.children import create_child
from tests.contacts import OMA, add_contact
from tests.fakes import FixedClock, MemoryFileStore, OutageMailer
from tests.groups import create_group, put_in_group
from tests.parents import create_parent, link
from tests.photos import give_photo_consent, jpeg, upload
from tests.test_emergency_list import emergency_list
from tests.test_incidents import incident_log, report
from tests.test_reminders import at


def archive(admin: TestClient) -> list[dict[str, Any]]:
    response = admin.get("/api/archive")
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()
    return found


def child_names(client: TestClient) -> list[str]:
    return [child["firstName"] for child in client.get("/api/children").json()]


def test_a_deleted_child_goes_to_the_archive_and_an_admin_restores_it(admin: TestClient) -> None:
    lena = create_child(admin, firstName="Lena")
    create_child(admin, firstName="Mia")

    assert admin.delete(f"/api/children/{lena}").status_code == 204

    assert child_names(admin) == ["Mia"]
    assert admin.get(f"/api/children/{lena}").status_code == 404
    # Archived at 09:00 at the Kita on 4 January 2027; purged 12 months later.
    assert archive(admin) == [
        {
            "id": lena,
            "firstName": "Lena",
            "lastName": "Müller",
            "archivedAt": "2027-01-04T08:00:00Z",
            "purgeOn": "2028-01-04",
        }
    ]

    assert admin.post(f"/api/archive/{lena}/restore").status_code == 204

    assert child_names(admin) == ["Lena", "Mia"]
    assert admin.get(f"/api/children/{lena}").json()["firstName"] == "Lena"
    assert archive(admin) == []


def test_an_archived_child_is_in_no_current_view(admin: TestClient, teacher: TestClient) -> None:
    monkeys = create_group(admin)
    # Born on 4 January: the test clock's day is her Birthday.
    lena = create_child(admin, firstName="Lena", dateOfBirth="2022-01-04")
    mia = create_child(admin, firstName="Mia", lastName="Schmidt")
    anna = create_parent(admin)
    for child in (lena, mia):
        put_in_group(admin, child, monkeys)
        link(admin, child, anna)
    assert teacher.post(f"/api/children/{lena}/attendance/check-in").status_code == 204
    assert report(teacher, lena).status_code == 201

    admin.delete(f"/api/children/{lena}")

    today = teacher.get(f"/api/groups/{monkeys}").json()
    assert [child["id"] for child in today["children"]] == [mia]
    calendar = teacher.get("/api/calendar", params={"from": "2027-01-01", "to": "2027-01-31"})
    assert calendar.json()["birthdays"] == []
    parent_page = teacher.get(f"/api/parents/{anna}").json()
    assert [child["id"] for child in parent_page["children"]] == [mia]
    assert incident_log(admin) == []
    # She was checked in, but is on no emergency list any more.
    assert "Lena" not in emergency_list(teacher)


def test_an_archived_childs_data_cannot_be_reached_or_changed(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    give_photo_consent(admin, lena)
    photo = upload(admin, f"/api/children/{lena}/photos", jpeg()).json()["id"]
    oma = add_contact(admin, lena, "pickUp", OMA)
    assert upload(admin, f"/api/children/{lena}/contacts/{oma}/photo", jpeg(), "PUT").is_success
    anna = create_parent(admin)
    monkeys = create_group(admin)
    incident = report(admin, lena).json()["id"]

    admin.delete(f"/api/children/{lena}")

    refused = [
        admin.put(f"/api/children/{lena}", json={"firstName": "Lena", "lastName": "Weber"}),
        admin.get(f"/api/children/{lena}/photos/{photo}/full"),
        admin.get(f"/api/children/{lena}/contacts/{oma}/photo/full"),
        admin.post(f"/api/children/{lena}/alerts", json={"kind": "allergy", "name": "Peanuts"}),
        admin.post(f"/api/children/{lena}/contacts", json={"kind": "emergency", **OMA}),
        admin.put(f"/api/children/{lena}/parents/{anna}"),
        admin.put(f"/api/children/{lena}/group", json={"groupId": monkeys}),
        admin.post(
            f"/api/children/{lena}/consents/photo/withdrawn", json={"withdrawnOn": "2027-01-04"}
        ),
        teacher.post(f"/api/children/{lena}/attendance/check-in"),
        teacher.post(
            f"/api/children/{lena}/absences",
            json={"startsOn": "2027-01-05", "reason": "sick"},
        ),
        report(teacher, lena),
        admin.post(f"/api/incidents/{incident}/follow-ups", json={"note": "Called back"}),
    ]
    assert [response.status_code for response in refused] == [404] * len(refused)


def test_a_restored_child_has_all_its_data_back(admin: TestClient, teacher: TestClient) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    put_in_group(admin, lena, monkeys)
    link(admin, lena, create_parent(admin))
    add_contact(admin, lena, "emergency", OMA)
    admin.post(f"/api/children/{lena}/alerts", json={"kind": "allergy", "name": "Peanuts"})
    give_photo_consent(admin, lena)
    photo = upload(admin, f"/api/children/{lena}/photos", jpeg()).json()["id"]
    before = teacher.get(f"/api/children/{lena}").json()

    admin.delete(f"/api/children/{lena}")
    admin.post(f"/api/archive/{lena}/restore")

    assert teacher.get(f"/api/children/{lena}").json() == before
    assert teacher.get(f"/api/children/{lena}/photos/{photo}/full").status_code == 200
    assert [child["id"] for child in teacher.get(f"/api/groups/{monkeys}").json()["children"]] == [
        lena
    ]


def test_only_admins_see_the_archive_and_restore(admin: TestClient, teacher: TestClient) -> None:
    lena = create_child(admin)
    admin.delete(f"/api/children/{lena}")

    assert teacher.get("/api/archive").status_code == 403
    assert teacher.post(f"/api/archive/{lena}/restore").status_code == 403
    assert admin.get(f"/api/children/{lena}").status_code == 404


def test_only_archived_children_are_restored(admin: TestClient) -> None:
    lena = create_child(admin)

    assert admin.post(f"/api/archive/{lena}/restore").status_code == 404
    assert admin.post("/api/archive/999/restore").status_code == 404


def test_deleting_and_restoring_go_into_the_audit_log(admin: TestClient) -> None:
    lena = create_child(admin)

    admin.delete(f"/api/children/{lena}")
    admin.post(f"/api/archive/{lena}/restore")

    entries = admin.get("/api/audit-log", params={"childId": str(lena)}).json()
    assert [(entry["action"], entry["changedFields"]) for entry in entries[:2]] == [
        ("changed", ["archived"]),
        ("deleted", []),
    ]
    # Named while archived and after: the profile still exists.
    assert entries[0]["childName"] == "Lena Müller"


def purge_due(app: FastAPI) -> None:
    app.state.archive.purge_due()


def later(clock: FixedClock, admin: TestClient, kita_time: str) -> None:
    """Sets the clock to that time at the Kita, and logs the Admin in again: the session ended
    meanwhile."""
    at(clock, kita_time)
    assert log_in(admin).status_code == 200


def test_archived_children_are_purged_with_their_data_when_the_retention_period_ends(
    app: FastAPI, admin: TestClient, clock: FixedClock, file_store: MemoryFileStore
) -> None:
    lena = create_child(admin, firstName="Lena")
    tim = create_child(admin, firstName="Tim")
    mia = create_child(admin, firstName="Mia")
    # Lena's own Parent, and one she shares with her brother Tim, who stays.
    lenas_father = create_parent(admin, firstName="Jan")
    shared = create_parent(admin, firstName="Anna")
    link(admin, lena, lenas_father)
    link(admin, lena, shared)
    link(admin, tim, shared)
    assert upload(admin, f"/api/parents/{lenas_father}/photo", jpeg(), "PUT").is_success
    give_photo_consent(admin, lena)
    upload(admin, f"/api/children/{lena}/photos", jpeg())
    oma = add_contact(admin, lena, "pickUp", OMA)
    upload(admin, f"/api/children/{lena}/contacts/{oma}/photo", jpeg(), "PUT")
    assert report(admin, lena).status_code == 201
    admin.delete(f"/api/children/{lena}")
    later(clock, admin, "2027-03-01 10:00")
    admin.delete(f"/api/children/{mia}")

    # Archived on 4 January 2027: kept for 12 months, up to and including 3 January 2028.
    later(clock, admin, "2028-01-03 08:00")
    purge_due(app)
    assert [child["firstName"] for child in archive(admin)] == ["Mia", "Lena"]

    later(clock, admin, "2028-01-04 08:00")
    purge_due(app)

    assert [child["firstName"] for child in archive(admin)] == ["Mia"]
    assert admin.post(f"/api/archive/{lena}/restore").status_code == 404
    assert child_names(admin) == ["Tim"]
    # A Parent with no Child left goes too; one who still has a Child stays.
    assert admin.get(f"/api/parents/{lenas_father}").status_code == 404
    assert admin.get(f"/api/parents/{shared}").status_code == 200
    # Not a file of her photos, her Pick-up person's or her father's is left.
    assert file_store.files == {}


def test_the_retention_period_is_set_in_the_settings(
    settings: Settings, clock: FixedClock, file_store: MemoryFileStore
) -> None:
    six_months = settings.model_copy(update={"archive_retention_months": 6})
    app = create_app(six_months, clock=clock, mailer=OutageMailer(), file_store=file_store)
    with TestClient(app, base_url="https://testserver") as admin:
        assert create_admin(six_months) == 0
        assert log_in(admin).status_code == 200
        lena = create_child(admin)
        admin.delete(f"/api/children/{lena}")

        assert archive(admin)[0]["purgeOn"] == "2027-07-04"
        later(clock, admin, "2027-07-04 08:00")
        purge_due(app)
        assert archive(admin) == []
