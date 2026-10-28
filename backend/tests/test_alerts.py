from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from kita.settings import Settings
from tests.accounts import TEACHER_EMAIL
from tests.children import create_child
from tests.contacts import profile
from tests.groups import create_group, put_in_group

PEANUTS = {"kind": "allergy", "name": "Peanuts", "note": "EpiPen in the red bag"}
ASTHMA = {"kind": "medical", "name": "Asthma", "note": ""}


def add_alert(admin: TestClient, child_id: int, alert: dict[str, Any]) -> int:
    response = admin.post(f"/api/children/{child_id}/alerts", json=alert)
    assert response.status_code == 201, response.text
    alert_id: int = response.json()["id"]
    return alert_id


def changes(admin: TestClient) -> list[list[str]]:
    entries = admin.get("/api/audit-log", params={"action": "changed"}).json()
    return [entry["changedFields"] for entry in entries]


def test_teachers_see_the_alerts_an_admin_recorded(admin: TestClient, teacher: TestClient) -> None:
    lena = create_child(admin)
    peanuts = add_alert(admin, lena, PEANUTS)
    asthma = add_alert(admin, lena, ASTHMA)

    seen = profile(teacher, lena)

    assert seen["alerts"] == [{"id": peanuts, **PEANUTS}, {"id": asthma, **ASTHMA}]
    assert changes(admin) == [["alerts"], ["alerts"]]


def test_an_admin_changes_and_removes_alerts(admin: TestClient) -> None:
    lena = create_child(admin)
    peanuts = add_alert(admin, lena, PEANUTS)
    asthma = add_alert(admin, lena, ASTHMA)

    changed = admin.put(
        f"/api/children/{lena}/alerts/{peanuts}", json={**PEANUTS, "name": "Peanuts, hazelnuts"}
    )
    unchanged = admin.put(f"/api/children/{lena}/alerts/{asthma}", json=ASTHMA)
    removed = admin.delete(f"/api/children/{lena}/alerts/{asthma}")

    assert (changed.status_code, unchanged.status_code, removed.status_code) == (200, 200, 204)
    assert changed.json() == {"id": peanuts, **PEANUTS, "name": "Peanuts, hazelnuts"}
    assert profile(admin, lena)["alerts"] == [changed.json()]
    # Saving without a change leaves no entry.
    assert changes(admin) == [["alerts"]] * 4


def test_teachers_cannot_change_alerts(admin: TestClient, teacher: TestClient) -> None:
    lena = create_child(admin)
    peanuts = add_alert(admin, lena, PEANUTS)

    refused = [
        teacher.post(f"/api/children/{lena}/alerts", json=ASTHMA),
        teacher.put(f"/api/children/{lena}/alerts/{peanuts}", json=ASTHMA),
        teacher.delete(f"/api/children/{lena}/alerts/{peanuts}"),
    ]

    assert [response.status_code for response in refused] == [403, 403, 403]
    assert profile(admin, lena)["alerts"] == [{"id": peanuts, **PEANUTS}]


def test_an_alert_belongs_to_its_child_only(admin: TestClient) -> None:
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    peanuts = add_alert(admin, lena, PEANUTS)

    through_mia = [
        admin.put(f"/api/children/{mia}/alerts/{peanuts}", json=ASTHMA),
        admin.delete(f"/api/children/{mia}/alerts/{peanuts}"),
        admin.post("/api/children/999/alerts", json=ASTHMA),
    ]

    assert [response.status_code for response in through_mia] == [404, 404, 404]
    assert profile(admin, lena)["alerts"] == [{"id": peanuts, **PEANUTS}]


def test_alerts_need_a_name_and_valid_lengths(admin: TestClient) -> None:
    lena = create_child(admin)

    no_name = admin.post(f"/api/children/{lena}/alerts", json={**PEANUTS, "name": " "})
    too_long = admin.post(f"/api/children/{lena}/alerts", json={**PEANUTS, "note": "x" * 1001})
    unknown_kind = admin.post(f"/api/children/{lena}/alerts", json={**PEANUTS, "kind": "diet"})

    assert no_name.json() == {"detail": "name_required"}
    assert too_long.json() == {"detail": "too_long"}
    assert unknown_kind.status_code == 422


def test_health_data_is_not_stored_in_plain_text(admin: TestClient, settings: Settings) -> None:
    lena = create_child(admin)
    add_alert(admin, lena, PEANUTS)

    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        dump = str(connection.execute(text("SELECT row_to_json(a) FROM child_alerts a")).all())
    engine.dispose()

    # Not even whether it is an allergy or a medical condition.
    assert "Peanuts" not in dump and "EpiPen" not in dump and "allergy" not in dump


def test_the_group_dashboard_marks_each_childs_alerts(
    admin: TestClient, teacher: TestClient
) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    for child in (lena, mia):
        put_in_group(admin, child, monkeys)
    peanuts = add_alert(admin, lena, PEANUTS)

    response = teacher.get(f"/api/groups/{monkeys}")

    assert response.status_code == 200, response.text
    assert [(child["firstName"], child["alerts"]) for child in response.json()["children"]] == [
        ("Lena", [{"id": peanuts, **PEANUTS}]),
        ("Mia", []),
    ]
    # It showed Lena's health data, so the view is logged for her; Mia's name alone is not.
    viewed = admin.get("/api/audit-log", params={"action": "viewed", "staffEmail": TEACHER_EMAIL})
    assert [entry["childId"] for entry in viewed.json()] == [lena]
