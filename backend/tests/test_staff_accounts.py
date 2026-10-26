from collections.abc import Callable
from datetime import timedelta

from fastapi.testclient import TestClient

from tests.accounts import ADMIN_EMAIL, PASSWORD, log_in, verification_token
from tests.fakes import CapturingMailer, FixedClock

TEACHER_EMAIL = "erzieherin@kita.example"


def invite(admin: TestClient, email: str = TEACHER_EMAIL, role: str = "teacher") -> int:
    response = admin.post("/api/staff", json={"email": email, "role": role})
    assert response.status_code == 201, response.text
    account_id: int = response.json()["id"]
    return account_id


def onboard(
    admin: TestClient,
    new_client: Callable[[], TestClient],
    mailer: CapturingMailer,
    email: str = TEACHER_EMAIL,
    role: str = "teacher",
) -> tuple[int, TestClient]:
    """Invites a Staff member, verifies their email and logs them in."""
    account_id = invite(admin, email, role)
    staff_member = new_client()
    verified = staff_member.post(
        "/api/email-verifications",
        json={"token": verification_token(mailer, email), "password": PASSWORD},
    )
    assert verified.status_code == 204
    assert log_in(staff_member, email).status_code == 200
    return account_id, staff_member


def test_new_staff_member_verifies_their_email_by_choosing_a_password_then_logs_in(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    response = admin.post(
        "/api/staff", json={"email": "Erzieherin@Kita.example", "role": "teacher"}
    )
    assert response.status_code == 201
    token = verification_token(mailer, TEACHER_EMAIL)

    teacher = new_client()
    verified = teacher.post("/api/email-verifications", json={"token": token, "password": PASSWORD})

    assert verified.status_code == 204
    assert log_in(teacher, TEACHER_EMAIL).json()["role"] == "teacher"


def test_admin_page_lists_every_login_with_role_and_status(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    onboard(admin, new_client, mailer)
    invite(admin, "neu@kita.example")
    gone_id, _ = onboard(admin, new_client, mailer, "weg@kita.example")
    admin.put(f"/api/staff/{gone_id}/active", json={"active": False})

    accounts = admin.get("/api/staff").json()

    assert [(a["email"], a["role"], a["status"]) for a in accounts] == [
        ("erzieherin@kita.example", "teacher", "active"),
        ("leitung@kita.example", "admin", "active"),
        ("neu@kita.example", "teacher", "invited"),
        ("weg@kita.example", "teacher", "deactivated"),
    ]


def test_unverified_accounts_cannot_log_in(
    admin: TestClient, new_client: Callable[[], TestClient]
) -> None:
    invite(admin)

    assert log_in(new_client(), TEACHER_EMAIL).status_code == 401


def test_a_verification_link_works_once_and_only_for_seven_days(
    admin: TestClient,
    new_client: Callable[[], TestClient],
    mailer: CapturingMailer,
    clock: FixedClock,
) -> None:
    invite(admin)
    invite(admin, "spaet@kita.example")
    client = new_client()
    used = verification_token(mailer, TEACHER_EMAIL)
    expired = verification_token(mailer, "spaet@kita.example")

    client.post("/api/email-verifications", json={"token": used, "password": PASSWORD})
    reused = client.post(
        "/api/email-verifications", json={"token": used, "password": "another long password"}
    )
    clock.now_value += timedelta(days=7)
    too_late = client.post(
        "/api/email-verifications", json={"token": expired, "password": PASSWORD}
    )

    for response in (reused, too_late):
        assert response.status_code == 400
        assert response.json() == {"detail": "invalid_link"}
    assert log_in(client, TEACHER_EMAIL, "another long password").status_code == 401
    assert log_in(client, "spaet@kita.example").status_code == 401


def test_the_chosen_password_needs_twelve_characters(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    invite(admin)
    client = new_client()

    response = client.post(
        "/api/email-verifications",
        json={"token": verification_token(mailer, TEACHER_EMAIL), "password": "too short"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "password_too_short"}
    assert log_in(client, TEACHER_EMAIL, "too short").status_code == 401


def test_an_email_address_can_only_have_one_account(admin: TestClient) -> None:
    invite(admin)

    response = admin.post("/api/staff", json={"email": " ERZIEHERIN@kita.example", "role": "admin"})

    assert response.status_code == 409
    assert response.json() == {"detail": "email_taken"}


def test_admin_can_make_a_teacher_an_admin(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    account_id, teacher = onboard(admin, new_client, mailer)

    response = admin.put(f"/api/staff/{account_id}/role", json={"role": "admin"})

    assert response.json()["role"] == "admin"
    assert teacher.get("/api/staff").status_code == 200


def test_deactivating_an_account_ends_its_sessions_and_logins_until_reactivated(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    account_id, teacher = onboard(admin, new_client, mailer)

    response = admin.put(f"/api/staff/{account_id}/active", json={"active": False})

    assert response.json()["status"] == "deactivated"
    assert teacher.get("/api/session").status_code == 401
    assert log_in(teacher, TEACHER_EMAIL).status_code == 401

    admin.put(f"/api/staff/{account_id}/active", json={"active": True})

    assert log_in(teacher, TEACHER_EMAIL).status_code == 200


def test_the_last_active_admin_cannot_be_demoted(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    # Deactivating is covered too: only an active Admin can deactivate anyone, and Admins cannot
    # deactivate themselves, so an active Admin always remains.
    [me] = admin.get("/api/staff").json()

    demoted = admin.put(f"/api/staff/{me['id']}/role", json={"role": "teacher"})

    assert demoted.status_code == 409
    assert demoted.json() == {"detail": "last_admin"}
    assert admin.get("/api/session").json()["role"] == "admin"

    onboard(admin, new_client, mailer, "zweite-leitung@kita.example", role="admin")

    assert admin.put(f"/api/staff/{me['id']}/role", json={"role": "teacher"}).status_code == 200


def test_an_invited_admin_does_not_count_as_another_active_admin(admin: TestClient) -> None:
    [me] = admin.get("/api/staff").json()
    invite(admin, "eingeladen@kita.example", role="admin")

    response = admin.put(f"/api/staff/{me['id']}/role", json={"role": "teacher"})

    assert response.json() == {"detail": "last_admin"}


def test_teachers_cannot_reach_the_staff_accounts_api(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    account_id, teacher = onboard(admin, new_client, mailer)

    responses = [
        teacher.get("/api/staff"),
        teacher.post("/api/staff", json={"email": "x@kita.example", "role": "admin"}),
        teacher.put(f"/api/staff/{account_id}/role", json={"role": "admin"}),
        teacher.put(f"/api/staff/{account_id}/active", json={"active": False}),
    ]

    for response in responses:
        assert response.status_code == 403
        assert response.json() == {"detail": "admins_only"}
    assert teacher.get("/api/session").json()["role"] == "teacher"


def test_the_staff_accounts_api_needs_a_login(new_client: Callable[[], TestClient]) -> None:
    assert new_client().get("/api/staff").status_code == 401


def test_changing_an_unknown_account_is_not_found(admin: TestClient) -> None:
    assert admin.put("/api/staff/999/role", json={"role": "admin"}).status_code == 404


def test_an_admin_can_send_an_invited_staff_member_a_new_link(
    admin: TestClient,
    new_client: Callable[[], TestClient],
    mailer: CapturingMailer,
    clock: FixedClock,
) -> None:
    account_id = invite(admin)
    old_link = verification_token(mailer, TEACHER_EMAIL)
    clock.now_value += timedelta(days=8)
    log_in(admin)

    response = admin.post(f"/api/staff/{account_id}/invitation")

    assert response.status_code == 204
    new_link = verification_token(mailer, TEACHER_EMAIL)
    client = new_client()
    old = client.post("/api/email-verifications", json={"token": old_link, "password": PASSWORD})
    new = client.post("/api/email-verifications", json={"token": new_link, "password": PASSWORD})
    assert (old.status_code, new.status_code) == (400, 204)
    assert log_in(client, TEACHER_EMAIL).status_code == 200


def test_only_invited_accounts_get_a_new_link(admin: TestClient) -> None:
    [me] = admin.get("/api/staff").json()

    response = admin.post(f"/api/staff/{me['id']}/invitation")

    assert response.status_code == 409
    assert response.json() == {"detail": "not_invited"}


def test_staff_members_need_a_valid_email_address(admin: TestClient) -> None:
    for email in ("not an email", "anna@", "@kita.example", "anna mueller@kita.example"):
        response = admin.post("/api/staff", json={"email": email, "role": "teacher"})

        assert response.status_code == 422
        assert response.json() == {"detail": "invalid_email"}


def test_an_admin_cannot_deactivate_their_own_account(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    onboard(admin, new_client, mailer, "zweite-leitung@kita.example", role="admin")
    me = next(a for a in admin.get("/api/staff").json() if a["email"] == ADMIN_EMAIL)

    response = admin.put(f"/api/staff/{me['id']}/active", json={"active": False})

    assert response.status_code == 409
    assert response.json() == {"detail": "own_account"}
    assert admin.get("/api/session").status_code == 200


def test_deactivating_an_invited_account_voids_its_link_even_after_reactivation(
    admin: TestClient, new_client: Callable[[], TestClient], mailer: CapturingMailer
) -> None:
    account_id = invite(admin)
    old_link = verification_token(mailer, TEACHER_EMAIL)

    admin.put(f"/api/staff/{account_id}/active", json={"active": False})
    admin.put(f"/api/staff/{account_id}/active", json={"active": True})

    response = new_client().post(
        "/api/email-verifications", json={"token": old_link, "password": PASSWORD}
    )
    assert response.status_code == 400
    assert admin.post(f"/api/staff/{account_id}/invitation").status_code == 204
