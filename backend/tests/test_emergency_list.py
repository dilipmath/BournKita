from collections.abc import Callable
from io import BytesIO
from typing import Any

from fastapi.testclient import TestClient
from pypdf import PdfReader

from tests.accounts import TEACHER_EMAIL
from tests.children import create_child
from tests.contacts import NACHBAR, OMA, add_contact
from tests.fakes import FixedClock
from tests.groups import create_group, put_in_group
from tests.parents import ANNA, create_parent, link
from tests.test_alerts import ASTHMA, PEANUTS, add_alert
from tests.test_attendance import add_absence, at, attendance


def emergency_list(client: TestClient, **params: Any) -> str:
    """The emergency list's text, as printed: words with one space between them, wherever the
    PDF breaks its lines."""
    response = client.get("/api/emergency-list", params=params)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    pages = PdfReader(BytesIO(response.content)).pages
    return " ".join(" ".join(page.extract_text().split()) for page in pages)


def test_a_groups_list_has_the_children_here_now_with_whom_to_call_and_their_alerts(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    monkeys = create_group(admin)
    lena = create_child(admin, firstName="Lena")
    gone = create_child(admin, firstName="Gone")
    absent = create_child(admin, firstName="Absent")
    for child in (lena, gone, absent):
        put_in_group(admin, child, monkeys)
    put_in_group(admin, create_child(admin, firstName="Notyet"), monkeys)
    add_alert(admin, lena, PEANUTS)
    add_alert(admin, lena, ASTHMA)
    add_contact(admin, lena, "emergency", OMA)
    add_contact(admin, lena, "pickUp", NACHBAR)
    assert link(admin, lena, create_parent(admin)) == 204
    at(clock, "2027-01-04 08:12")
    attendance(teacher, lena, "check-in")
    attendance(teacher, gone, "check-in")
    attendance(teacher, gone, "check-out")
    add_absence(teacher, absent, {"startsOn": "2027-01-04", "reason": "sick"})

    text = emergency_list(teacher, groupId=monkeys, language="en")

    assert "Lena Müller" in text
    assert "Here since 08:12" in text
    assert "Peanuts: EpiPen in the red bag" in text
    assert "Asthma" in text
    assert f"{OMA['name']} ({OMA['relationship']}) {OMA['phone']}" in text
    assert f"{ANNA['firstName']} {ANNA['lastName']} (Parent) {ANNA['phone']}" in text
    assert NACHBAR["name"] not in text  # A Pick-up person only.
    for elsewhere in ("Gone", "Absent", "Notyet"):
        assert elsewhere not in text
    assert "Monkeys" in text
    assert "1 Child here" in text


def test_the_whole_kitas_list_has_every_group_and_the_children_in_none(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    monkeys = create_group(admin, "Monkeys", "monkey")
    create_group(admin, "Bees", "bee")
    lena = create_child(admin, firstName="Lena")
    put_in_group(admin, lena, monkeys)
    max_ = create_child(admin, firstName="Max", lastName="Schmidt")
    at(clock, "2027-01-04 08:00")
    attendance(teacher, lena, "check-in")
    at(clock, "2027-01-04 08:20")
    attendance(teacher, max_, "check-in")

    text = emergency_list(teacher, language="de")

    assert "Notfallliste: Ganze Kita" in text
    assert "Gedruckt Montag, 4. Januar 2027, 08:20 Uhr · 2 Kinder da" in text
    # Groups by name, those with nobody here too; then the Children in no Group.
    assert text.index("Bees · 0 Kinder da") < text.index("Monkeys · 1 Kind da")
    assert text.index("Lena Müller") < text.index("Keine Gruppe · 1 Kind da")
    assert text.index("Keine Gruppe") < text.index("Max Schmidt Da seit 08:20")
    assert "Gerade ist kein Kind eingecheckt." in text


def test_printing_the_list_is_logged_for_each_child_on_it(
    admin: TestClient, teacher: TestClient, clock: FixedClock
) -> None:
    lena = create_child(admin, firstName="Lena")
    create_child(admin, firstName="Max")  # Not here, so not on the list.
    at(clock, "2027-01-04 08:00")
    attendance(teacher, lena, "check-in")

    emergency_list(teacher)

    viewed = admin.get("/api/audit-log", params={"action": "viewed"}).json()
    assert [(entry["childId"], entry["staffEmail"]) for entry in viewed] == [
        (lena, TEACHER_EMAIL)
    ]


def test_only_staff_members_print_the_list_and_it_is_kept_in_no_cache(
    admin: TestClient, new_client: Callable[[], TestClient]
) -> None:
    printed = admin.get("/api/emergency-list")

    assert printed.headers["cache-control"] == "no-store"
    assert new_client().get("/api/emergency-list").status_code == 401
    assert admin.get("/api/emergency-list", params={"groupId": 999}).status_code == 404
    assert admin.get("/api/emergency-list", params={"language": "fr"}).status_code == 422
