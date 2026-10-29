from typing import Any

from fastapi.testclient import TestClient

from tests.groups import create_group


def ics(*events: str) -> bytes:
    """An iCal file with these VEVENT bodies, with the CRLF line ends iCal uses."""
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//Holidays//DE"]
    for number, body in enumerate(events):
        lines += ["BEGIN:VEVENT", f"UID:holiday-{number}@test", *body.split("\n"), "END:VEVENT"]
    return ("\r\n".join([*lines, "END:VCALENDAR"]) + "\r\n").encode()


PUBLIC = ics(
    "DTSTART;VALUE=DATE:20270101\nDTEND;VALUE=DATE:20270102\nSUMMARY:Neujahr",
    # A long line folded onto the next, as iCal files do.
    "DTSTART;VALUE=DATE:20270308\nDTEND;VALUE=DATE:20270309\nSUMMARY:Internationaler Frauent\n ag",
)
# DTEND is the day after the last one, as iCal has it.
SCHOOL = ics("DTSTART;VALUE=DATE:20270201\nDTEND;VALUE=DATE:20270207\nSUMMARY:Winterferien Berlin")


def upload(client: TestClient, kind: str, data: bytes, name: str = "holidays.ics") -> Any:
    return client.put(f"/api/holidays/{kind}", files={"file": (name, data, "text/calendar")})


def holidays(client: TestClient, first: str, last: str, group_id: int | None = None) -> Any:
    params = {"from": first, "to": last, **({} if group_id is None else {"groupId": str(group_id)})}
    response = client.get("/api/calendar", params=params)
    assert response.status_code == 200, response.text
    return response.json()["holidays"]


def test_an_admin_imports_public_and_school_holidays(
    admin: TestClient, teacher: TestClient
) -> None:
    monkeys = create_group(admin)

    public = upload(admin, "public", PUBLIC)
    school = upload(admin, "school", SCHOOL)

    assert (public.status_code, public.json()) == (200, {"imported": 2})
    assert school.json() == {"imported": 1}
    # In every Group's Calendar too: holidays are the whole Kita's.
    assert holidays(teacher, "2026-12-28", "2027-03-31", monkeys) == [
        {"kind": "public", "name": "Neujahr", "startsOn": "2027-01-01", "endsOn": "2027-01-01"},
        {
            "kind": "school",
            "name": "Winterferien Berlin",
            "startsOn": "2027-02-01",
            "endsOn": "2027-02-06",
        },
        {
            "kind": "public",
            "name": "Internationaler Frauentag",
            "startsOn": "2027-03-08",
            "endsOn": "2027-03-08",
        },
    ]
    assert holidays(teacher, "2027-02-06", "2027-02-10") == [
        {
            "kind": "school",
            "name": "Winterferien Berlin",
            "startsOn": "2027-02-01",
            "endsOn": "2027-02-06",
        }
    ]


def test_importing_again_replaces_that_kind_of_holidays_only(admin: TestClient) -> None:
    upload(admin, "public", PUBLIC)
    upload(admin, "school", SCHOOL)

    upload(admin, "public", ics("DTSTART;VALUE=DATE:20271225\nSUMMARY:1. Weihnachtstag"))

    assert admin.get("/api/holidays").json() == [
        {"kind": "public", "count": 1, "firstDay": "2027-12-25", "lastDay": "2027-12-25"},
        {"kind": "school", "count": 1, "firstDay": "2027-02-01", "lastDay": "2027-02-06"},
    ]


def test_only_admins_import_holidays(admin: TestClient, teacher: TestClient) -> None:
    assert upload(teacher, "public", PUBLIC).status_code == 403
    assert admin.get("/api/holidays").json() == []


def test_a_file_that_cannot_be_imported_changes_nothing(admin: TestClient) -> None:
    upload(admin, "public", PUBLIC)

    refused = [
        upload(admin, "public", b"Neujahr, 1.1.2027", "holidays.csv"),
        # Repeating entries would need rules to work them out; holiday files list each one.
        upload(
            admin,
            "public",
            ics("DTSTART;VALUE=DATE:20270101\nRRULE:FREQ=YEARLY\nSUMMARY:Neujahr"),
        ),
        upload(admin, "public", ics()),
        upload(admin, "public", b"x" * 1_000_001),
    ]

    assert [response.json()["detail"] for response in refused] == [
        "not_a_calendar",
        "repeating_holidays",
        "no_holidays",
        "file_too_large",
    ]
    assert admin.get("/api/holidays").json()[0]["count"] == 2
    assert (
        admin.put("/api/holidays/religious", files={"file": ("h.ics", PUBLIC)}).status_code == 422
    )


def test_holidays_given_with_times_are_on_the_kitas_days(admin: TestClient) -> None:
    upload(
        admin,
        "public",
        ics(
            # Midnight to midnight: one day, the end not included.
            "DTSTART:20270501T000000\nDTEND:20270502T000000\nSUMMARY:Tag der Arbeit",
            # Midnight at the Kita, written in UTC: 22:00 the evening before.
            "DTSTART:20271002T220000Z\nDTEND:20271003T220000Z\nSUMMARY:Tag der Deutschen Einheit",
            "DTSTART;VALUE=DATE:20271225\nDURATION:P2D\nSUMMARY:Weihnachten",
        ),
    )

    assert [
        (h["name"], h["startsOn"], h["endsOn"]) for h in holidays(admin, "2027-04-30", "2027-07-01")
    ] == [("Tag der Arbeit", "2027-05-01", "2027-05-01")]
    assert [(h["startsOn"], h["endsOn"]) for h in holidays(admin, "2027-10-01", "2027-12-31")] == [
        ("2027-10-03", "2027-10-03"),
        ("2027-12-25", "2027-12-26"),
    ]
