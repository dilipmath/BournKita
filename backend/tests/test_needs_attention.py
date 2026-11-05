from datetime import time

import pytest
from fastapi.testclient import TestClient

from kita.settings import Settings
from tests.accounts import TEACHER_EMAIL, log_in
from tests.children import create_child
from tests.fakes import FixedClock
from tests.groups import create_group, put_in_group
from tests.test_attendance import at


@pytest.fixture
def settings(settings: Settings) -> Settings:
    """The Kita closes at 16:30 in these tests."""
    return settings.model_copy(update={"closes_at": time(16, 30)})


def still_here(admin: TestClient) -> list[dict[str, object]]:
    late: list[dict[str, object]] = admin.get("/api/overview").json()["kita"][
        "stillHereAfterClosing"
    ]
    return late


def test_children_still_checked_in_after_closing_time_need_attention(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin)
    mia = create_child(admin, firstName="Mia")
    paul = create_child(admin, firstName="Paul")
    put_in_group(admin, lena, monkeys)
    put_in_group(admin, mia, monkeys)
    at(clock, "2027-01-04 08:00")
    for child in (lena, mia, paul):
        teacher.post(f"/api/children/{child}/attendance/check-in")
    at(clock, "2027-01-04 15:00")
    # Hours later: a new login, as on the tablet.
    assert log_in(teacher, TEACHER_EMAIL).status_code == 200
    teacher.post(f"/api/children/{mia}/attendance/check-out")
    assert log_in(admin).status_code == 200

    # Before closing: nobody is late yet.
    assert still_here(admin) == []

    at(clock, "2027-01-04 16:45")
    assert log_in(admin).status_code == 200
    assert still_here(admin) == [
        {"id": lena, "firstName": "Lena", "lastName": "Müller", "groupId": monkeys},
        {"id": paul, "firstName": "Paul", "lastName": "Müller", "groupId": None},
    ]
    assert admin.get("/api/overview").json()["kita"]["closesAt"] == "16:30"


def test_an_empty_closing_time_in_env_means_none() -> None:
    # compose passes an unset KITA_CLOSES_AT as "".
    assert Settings(closes_at="").closes_at is None  # type: ignore[arg-type]
    assert Settings(closes_at="16:30").closes_at == time(16, 30)  # type: ignore[arg-type]
