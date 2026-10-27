from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient

from tests.accounts import log_in
from tests.children import create_child
from tests.fakes import FixedClock


def give(admin: TestClient, child_id: int, consent: str, on: str) -> Any:
    return admin.post(f"/api/children/{child_id}/consents/{consent}/given", json={"givenOn": on})


def withdraw(admin: TestClient, child_id: int, consent: str, on: str) -> Any:
    return admin.post(
        f"/api/children/{child_id}/consents/{consent}/withdrawn", json={"withdrawnOn": on}
    )


def consents(client: TestClient, child_id: int) -> dict[str, Any]:
    response = client.get(f"/api/children/{child_id}")
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()["consents"]
    return body


def test_teachers_see_the_consents_an_admin_recorded(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)

    response = give(admin, lena, "photo", "2026-09-01")

    assert response.status_code == 204, response.text
    assert consents(teacher, lena) == {
        "photo": [{"givenOn": "2026-09-01", "withdrawnOn": None}],
        "excursion": [],
        "dataProtection": [],
    }


def test_a_withdrawn_consent_can_be_given_again_and_keeps_its_history(admin: TestClient) -> None:
    lena = create_child(admin)
    give(admin, lena, "excursion", "2026-03-01")

    withdrawn = withdraw(admin, lena, "excursion", "2026-06-15")
    given_again = give(admin, lena, "excursion", "2026-09-01")

    assert (withdrawn.status_code, given_again.status_code) == (204, 204)
    assert consents(admin, lena)["excursion"] == [
        {"givenOn": "2026-03-01", "withdrawnOn": "2026-06-15"},
        {"givenOn": "2026-09-01", "withdrawnOn": None},
    ]


def test_a_consent_is_given_or_withdrawn_only_once_at_a_time(admin: TestClient) -> None:
    lena = create_child(admin)

    never_given = withdraw(admin, lena, "photo", "2026-06-15")
    give(admin, lena, "photo", "2026-03-01")
    given_twice = give(admin, lena, "photo", "2026-04-01")

    assert never_given.status_code == 409
    assert never_given.json() == {"detail": "not_given"}
    assert given_twice.status_code == 409
    assert given_twice.json() == {"detail": "already_given"}
    assert consents(admin, lena)["photo"] == [{"givenOn": "2026-03-01", "withdrawnOn": None}]


def test_consent_dates_cannot_lie_in_the_kitas_future(admin: TestClient, clock: FixedClock) -> None:
    lena = create_child(admin)
    # Already 5 January in Germany, though not yet in UTC.
    clock.now_value = datetime(2027, 1, 4, 23, 30, tzinfo=UTC)
    log_in(admin)  # The session ended in the meantime.

    today = give(admin, lena, "photo", "2027-01-05")
    tomorrow = withdraw(admin, lena, "photo", "2027-01-06")

    assert today.status_code == 204
    assert tomorrow.status_code == 422
    assert tomorrow.json() == {"detail": "in_future"}


def test_a_consents_periods_follow_one_another(admin: TestClient) -> None:
    lena = create_child(admin)
    give(admin, lena, "dataProtection", "2026-03-01")

    withdrawn_before_given = withdraw(admin, lena, "dataProtection", "2026-02-28")
    withdraw(admin, lena, "dataProtection", "2026-06-15")
    given_before_withdrawn = give(admin, lena, "dataProtection", "2026-06-14")

    assert [withdrawn_before_given.json(), given_before_withdrawn.json()] == [
        {"detail": "out_of_order"},
        {"detail": "out_of_order"},
    ]
    assert consents(admin, lena)["dataProtection"] == [
        {"givenOn": "2026-03-01", "withdrawnOn": "2026-06-15"}
    ]


def test_only_admins_record_consents_and_the_audit_log_names_them(
    admin: TestClient, teacher: TestClient
) -> None:
    lena = create_child(admin)
    give(admin, lena, "photo", "2026-03-01")
    withdraw(admin, lena, "photo", "2026-06-15")
    give(admin, lena, "dataProtection", "2026-03-01")

    refused = [
        give(teacher, lena, "excursion", "2026-03-01"),
        withdraw(teacher, lena, "dataProtection", "2026-06-15"),
    ]

    assert [response.status_code for response in refused] == [403, 403]
    entries = admin.get("/api/audit-log", params={"action": "changed"}).json()
    assert [entry["changedFields"] for entry in entries] == [
        ["dataProtectionConsent"],
        ["photoConsent"],
        ["photoConsent"],
    ]


def test_consents_of_an_unknown_child_are_not_found(admin: TestClient) -> None:
    assert give(admin, 999, "photo", "2026-03-01").status_code == 404
    assert withdraw(admin, 999, "photo", "2026-03-01").status_code == 404
