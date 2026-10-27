from collections.abc import Callable, Iterator
from datetime import timedelta

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from kita.audit import Audit
from kita.audit_api import UnauditableRoute, audited_route, not_about_one_child
from kita.settings import Settings
from tests.accounts import ADMIN_EMAIL, TEACHER_EMAIL
from tests.children import LENA, create_child
from tests.fakes import FixedClock


def test_viewing_a_child_profile_creates_an_audit_entry(
    admin: TestClient, teacher: TestClient
) -> None:
    child_id = create_child(admin)

    teacher.get(f"/api/children/{child_id}")

    response = admin.get("/api/audit-log")
    assert response.status_code == 200
    viewed = response.json()[0]
    assert viewed == {
        "id": viewed["id"],
        "at": "2027-01-04T08:00:00Z",
        "staffEmail": TEACHER_EMAIL,
        "action": "viewed",
        "childId": child_id,
        "childName": f"{LENA['firstName']} {LENA['lastName']}",
        "changedFields": [],
    }


def test_changing_a_child_profile_records_which_fields_changed_but_not_their_values(
    admin: TestClient,
) -> None:
    child_id = create_child(admin)

    admin.put(f"/api/children/{child_id}", json={**LENA, "interests": "Fußball", "gender": None})

    [changed, created] = admin.get("/api/audit-log").json()
    assert (changed["action"], changed["staffEmail"]) == ("changed", ADMIN_EMAIL)
    assert changed["changedFields"] == ["gender", "interests"]
    assert "Fußball" not in str(changed)
    assert (created["action"], created["childId"]) == ("created", child_id)


def test_deleting_a_child_profile_is_recorded_and_the_entries_outlive_it(
    admin: TestClient,
) -> None:
    child_id = create_child(admin)
    admin.get(f"/api/children/{child_id}")

    admin.delete(f"/api/children/{child_id}")

    entries = admin.get("/api/audit-log").json()
    assert [entry["action"] for entry in entries] == ["deleted", "viewed", "created"]
    # The name is gone with the profile; the entries keep the Child's number.
    assert {(entry["childId"], entry["childName"]) for entry in entries} == {(child_id, None)}


def test_teachers_cannot_read_the_audit_log(teacher: TestClient) -> None:
    response = teacher.get("/api/audit-log")

    assert response.status_code == 403
    assert response.json() == {"detail": "admins_only"}


def test_refused_requests_and_the_list_of_names_create_no_entries(
    admin: TestClient, teacher: TestClient
) -> None:
    child_id = create_child(admin)

    teacher.put(f"/api/children/{child_id}", json={**LENA, "firstName": "Lea"})
    teacher.delete(f"/api/children/{child_id}")
    admin.get("/api/children/999")
    teacher.get("/api/children")

    assert [entry["action"] for entry in admin.get("/api/audit-log").json()] == ["created"]


def test_an_admin_filters_the_audit_log_by_child_staff_member_action_and_time(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    clock.now_value += timedelta(minutes=10)
    teacher.get(f"/api/children/{lena}")
    teacher.get(f"/api/children/{mia}")
    clock.now_value += timedelta(minutes=10)
    admin.get(f"/api/children/{lena}")

    def actions(**filters: str | int) -> list[tuple[str, int, str]]:
        response = admin.get("/api/audit-log", params=filters)
        assert response.status_code == 200, response.text
        return [(e["action"], e["childId"], e["staffEmail"]) for e in response.json()]

    assert actions(childId=lena) == [
        ("viewed", lena, ADMIN_EMAIL),
        ("viewed", lena, TEACHER_EMAIL),
        ("created", lena, ADMIN_EMAIL),
    ]
    assert actions(staffEmail="Erzieherin@Kita.example") == [
        ("viewed", mia, TEACHER_EMAIL),
        ("viewed", lena, TEACHER_EMAIL),
    ]
    assert actions(action="created") == [
        ("created", mia, ADMIN_EMAIL),
        ("created", lena, ADMIN_EMAIL),
    ]
    # Steps of minutes, not days: a longer pause would end the sessions.
    second_step = clock.now_value - timedelta(minutes=10)
    assert actions(
        since=second_step.isoformat(), until=(second_step + timedelta(minutes=1)).isoformat()
    ) == [
        ("viewed", mia, TEACHER_EMAIL),
        ("viewed", lena, TEACHER_EMAIL),
    ]


def test_the_audit_log_comes_in_pages_of_the_newest_entries(
    admin: TestClient, clock: FixedClock
) -> None:
    child_id = create_child(admin)
    for _ in range(4):
        clock.now_value += timedelta(minutes=1)
        admin.get(f"/api/children/{child_id}")

    first_page = admin.get("/api/audit-log", params={"limit": 2}).json()
    next_page = admin.get(
        "/api/audit-log", params={"limit": 2, "before": first_page[-1]["id"]}
    ).json()
    last_page = admin.get(
        "/api/audit-log", params={"limit": 2, "before": next_page[-1]["id"]}
    ).json()

    pages = [first_page, next_page, last_page]
    assert [[entry["action"] for entry in page] for page in pages] == [
        ["viewed", "viewed"],
        ["viewed", "viewed"],
        ["created"],
    ]


def test_saving_a_child_profile_unchanged_creates_no_entry(admin: TestClient) -> None:
    child_id = create_child(admin)

    admin.put(f"/api/children/{child_id}", json=LENA)

    assert [entry["action"] for entry in admin.get("/api/audit-log").json()] == ["created"]


def test_an_audited_router_refuses_routes_it_cannot_attribute_to_one_child(
    settings: Settings, clock: FixedClock
) -> None:
    # A later module that shows many Children at once must decide about logging, not forget it.
    engine = create_engine(settings.database_url)
    router = APIRouter(route_class=audited_route(Audit(engine, clock), engine))

    def today() -> None: ...
    def patch_child(child_id: int) -> None: ...
    def names() -> None: ...

    with pytest.raises(UnauditableRoute, match="GET /today"):
        router.add_api_route("/today", today, methods=["GET"])
    with pytest.raises(UnauditableRoute, match="POST /notes"):
        # A create of anything but a Child must say what it is about, not pass for one.
        router.add_api_route("/notes", today, methods=["POST"])
    with pytest.raises(UnauditableRoute, match="PATCH"):
        router.add_api_route("/{child_id}", patch_child, methods=["PATCH"])
    router.add_api_route("/names", not_about_one_child(names), methods=["GET"])


@pytest.fixture
def audit_log_down(settings: Settings) -> Iterator[Callable[[bool], None]]:
    """Switches writing audit entries off (True) and on again (False) in the database, as a full
    disk or a lost connection would."""
    engine = create_engine(settings.database_url)

    def set_down(down: bool) -> None:
        with engine.begin() as connection:
            if down:
                connection.exec_driver_sql(
                    "CREATE FUNCTION refuse_audit_entry() RETURNS trigger AS "
                    "$$ BEGIN RAISE EXCEPTION 'audit log unavailable'; END $$ LANGUAGE plpgsql"
                )
                connection.exec_driver_sql(
                    "CREATE TRIGGER refuse_audit_entry BEFORE INSERT ON audit_log "
                    "FOR EACH ROW EXECUTE FUNCTION refuse_audit_entry()"
                )
            else:
                connection.exec_driver_sql("DROP TRIGGER IF EXISTS refuse_audit_entry ON audit_log")
                connection.exec_driver_sql("DROP FUNCTION IF EXISTS refuse_audit_entry()")

    yield set_down
    set_down(False)
    engine.dispose()


def test_a_change_whose_audit_entry_cannot_be_written_is_not_saved(
    admin: TestClient, audit_log_down: Callable[[bool], None]
) -> None:
    child_id = create_child(admin)
    audit_log_down(True)

    changed = admin.put(f"/api/children/{child_id}", json={**LENA, "interests": "Fußball"})
    deleted = admin.delete(f"/api/children/{child_id}")
    created = admin.post("/api/children", json={**LENA, "firstName": "Mia"})
    viewed = admin.get(f"/api/children/{child_id}")

    assert [r.status_code for r in (changed, deleted, created, viewed)] == [500, 500, 500, 500]
    audit_log_down(False)
    assert admin.get(f"/api/children/{child_id}").json()["interests"] == LENA["interests"]
    assert [child["firstName"] for child in admin.get("/api/children").json()] == ["Lena"]
    assert [entry["action"] for entry in admin.get("/api/audit-log").json()] == [
        "viewed",
        "created",
    ]
