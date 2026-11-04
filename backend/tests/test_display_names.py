from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

from tests.accounts import PASSWORD, TEACHER_EMAIL, log_in, onboard, verification_token
from tests.fakes import CapturingMailer


def listed(admin: TestClient, email: str) -> dict[str, Any]:
    accounts: list[dict[str, Any]] = admin.get("/api/staff").json()
    [account] = [a for a in accounts if a["email"] == email]
    return account


def test_a_display_name_given_when_inviting_shows_in_the_list_and_greets_the_staff_member(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    created = admin.post(
        "/api/staff", json={"email": TEACHER_EMAIL, "role": "teacher", "displayName": "Aylin"}
    )
    assert created.status_code == 201
    assert created.json()["displayName"] == "Aylin"

    teacher = new_client()

    teacher.post(
        "/api/email-verifications",
        json={"token": verification_token(mailer, TEACHER_EMAIL), "password": PASSWORD},
    )

    assert log_in(teacher, TEACHER_EMAIL).json()["displayName"] == "Aylin"
    assert teacher.get("/api/session").json()["displayName"] == "Aylin"
    assert listed(admin, TEACHER_EMAIL)["displayName"] == "Aylin"


def test_without_a_display_name_the_session_has_none(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    _, teacher = onboard(admin, new_client, mailer)

    assert teacher.get("/api/session").json()["displayName"] is None
    assert listed(admin, TEACHER_EMAIL)["displayName"] is None


def test_an_admin_changes_and_clears_a_display_name(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    account_id, teacher = onboard(admin, new_client, mailer)

    changed = admin.put(f"/api/staff/{account_id}/display-name", json={"displayName": "  Aylin  "})
    assert changed.status_code == 200
    assert changed.json()["displayName"] == "Aylin"
    assert teacher.get("/api/session").json()["displayName"] == "Aylin"

    cleared = admin.put(f"/api/staff/{account_id}/display-name", json={"displayName": " "})
    assert cleared.json()["displayName"] is None


def test_display_names_have_at_most_50_characters(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    account_id, _ = onboard(admin, new_client, mailer)

    assert (
        admin.put(
            f"/api/staff/{account_id}/display-name", json={"displayName": "A" * 50}
        ).status_code
        == 200
    )
    too_long = admin.put(f"/api/staff/{account_id}/display-name", json={"displayName": "A" * 51})
    assert too_long.status_code == 422
    assert too_long.json()["detail"] == "display_name_too_long"
    invited = admin.post(
        "/api/staff", json={"email": "neu@kita.example", "role": "teacher", "displayName": "B" * 51}
    )
    assert invited.status_code == 422
    assert invited.json()["detail"] == "display_name_too_long"


def test_teachers_cannot_change_display_names(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    account_id, teacher = onboard(admin, new_client, mailer)

    refused = teacher.put(f"/api/staff/{account_id}/display-name", json={"displayName": "Boss"})

    assert refused.status_code == 403
    assert listed(admin, TEACHER_EMAIL)["displayName"] is None
