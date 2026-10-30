from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from kita.settings import Settings
from tests.accounts import ADMIN_EMAIL, TEACHER_EMAIL
from tests.children import create_child
from tests.groups import create_group, put_in_group

# The test clock says Monday 4 January 2027.
FALL = {
    "happenedOn": "2027-01-04",
    "happenedAt": "10:15",
    "description": "Fell off the slide, grazed her knee; cooled and plastered.",
    "informed": "Mother, by phone at 10:30",
}


def report(client: TestClient, child_id: int, incident: dict[str, Any] = FALL) -> Any:
    return client.post(f"/api/children/{child_id}/incidents", json=incident)


def incident_log(client: TestClient, **filters: Any) -> list[dict[str, Any]]:
    response = client.get("/api/incidents", params={k: str(v) for k, v in filters.items()})
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()
    return found


def audit(admin: TestClient, action: str) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = admin.get("/api/audit-log", params={"action": action}).json()
    return entries


def test_a_teacher_reports_an_incident_and_the_admin_reviews_it(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)

    reported = report(teacher, lena)

    assert reported.status_code == 201, reported.text
    incident = {
        "id": reported.json()["id"],
        "child": {"id": lena, "firstName": "Lena", "lastName": "Müller"},
        **FALL,
        "happenedAt": "10:15:00",
        "reportedBy": TEACHER_EMAIL,
        "reportedAt": "2027-01-04T08:00:00Z",
        "followUps": [],
    }
    assert reported.json() == incident
    assert incident_log(admin) == [incident]
    assert ["incidents"] in [entry["changedFields"] for entry in audit(admin, "changed")]


def test_date_child_description_and_who_was_informed_are_required(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)

    def refusal(changes: dict[str, Any]) -> Any:
        return report(teacher, lena, {**FALL, **changes}).json()["detail"]

    assert refusal({"description": "  "}) == "description_required"
    assert refusal({"informed": ""}) == "informed_required"
    assert refusal({"happenedOn": "2027-01-05"}) == "in_future"
    assert refusal({"description": "x" * 4001}) == "too_long"
    without_date = {key: value for key, value in FALL.items() if key != "happenedOn"}
    assert report(teacher, lena, without_date).status_code == 422
    assert report(teacher, 999).status_code == 404
    # No time is fine: not everyone looks at the clock.
    assert report(teacher, lena, {**FALL, "happenedAt": None}).status_code == 201


def test_teachers_see_the_incidents_they_reported_and_admins_see_all(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    mine = report(teacher, lena).json()["id"]
    report(admin, lena, {**FALL, "description": "Bumped her head on the table."})

    assert [incident["id"] for incident in incident_log(teacher)] == [mine]
    assert len(incident_log(admin)) == 2


def test_the_admin_filters_by_child_group_and_dates(admin: TestClient) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    put_in_group(admin, lena, monkeys)
    report(admin, lena, {**FALL, "happenedOn": "2026-12-14", "description": "Old one"})
    report(admin, lena, {**FALL, "description": "Lena today"})
    report(admin, mia, {**FALL, "description": "Mia today"})

    def descriptions(**filters: Any) -> list[str]:
        return [incident["description"] for incident in incident_log(admin, **filters)]

    # Newest first.
    assert descriptions() == ["Mia today", "Lena today", "Old one"]
    assert descriptions(childId=lena) == ["Lena today", "Old one"]
    assert descriptions(groupId=monkeys) == ["Lena today", "Old one"]
    assert descriptions(since="2027-01-01", until="2027-01-04") == ["Mia today", "Lena today"]


def test_only_admins_add_follow_ups_and_nobody_changes_an_incident(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    incident = report(teacher, lena).json()["id"]

    added = admin.post(
        f"/api/incidents/{incident}/follow-ups", json={"note": "Parents called back, all fine."}
    )
    refused = teacher.post(f"/api/incidents/{incident}/follow-ups", json={"note": "Me too"})

    assert added.status_code == 201, added.text
    assert refused.status_code == 403
    [follow_up] = incident_log(teacher)[0]["followUps"]
    assert follow_up == {
        "id": added.json()["id"],
        "note": "Parents called back, all fine.",
        "author": ADMIN_EMAIL,
        "at": "2027-01-04T08:00:00Z",
    }
    assert admin.post(f"/api/incidents/{incident}/follow-ups", json={"note": " "}).json() == {
        "detail": "note_required"
    }
    assert admin.post("/api/incidents/999/follow-ups", json={"note": "x"}).status_code == 404
    # A reliable record: no changing or deleting.
    before = incident_log(admin)
    assert admin.put(f"/api/incidents/{incident}", json=FALL).status_code in (404, 405)
    assert admin.delete(f"/api/incidents/{incident}").status_code in (404, 405)
    assert incident_log(admin) == before


def test_viewing_the_log_is_audited_for_each_child_shown(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    report(teacher, lena)
    report(teacher, mia)

    incident_log(admin)

    viewed = audit(admin, "viewed")
    assert sorted(entry["childId"] for entry in viewed if entry["staffEmail"] == ADMIN_EMAIL) == [
        lena,
        mia,
    ]


def test_incidents_are_not_stored_in_plain_text(
    admin: TestClient, teacher: TestClient, settings: Settings
) -> None:
    lena = create_child(admin)
    incident = report(teacher, lena).json()["id"]
    admin.post(f"/api/incidents/{incident}/follow-ups", json={"note": "Doctor saw the knee."})

    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        dump = str(connection.execute(text("SELECT row_to_json(i) FROM incidents i")).all())
        dump += str(
            connection.execute(text("SELECT row_to_json(f) FROM incident_follow_ups f")).all()
        )
    engine.dispose()

    assert "slide" not in dump and "Mother" not in dump and "Doctor" not in dump
