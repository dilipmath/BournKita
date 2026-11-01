import re

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests.children import create_child
from tests.parents import create_parent

# What a Teacher may change: the day's work (for every Child and Group, so any Teacher can cover),
# Feedback, and their own session. Everything else that changes data (Child profiles, Parents,
# contacts, Alerts, Consents, photos, Groups, Staff accounts, the Archive, Holidays, Follow-ups,
# Data-subject requests) is for Admins only.
TEACHER_CHANGES = {
    ("POST", "/api/children/{child_id}/attendance/{step}"),
    ("POST", "/api/children/{child_id}/absences"),
    ("DELETE", "/api/children/{child_id}/absences/{absence_id}"),
    ("POST", "/api/children/{child_id}/incidents"),
    ("POST", "/api/groups/{group_id}/tasks"),
    ("PUT", "/api/groups/{group_id}/tasks/{task_id}"),
    ("PUT", "/api/groups/{group_id}/tasks/{task_id}/status"),
    ("DELETE", "/api/groups/{group_id}/tasks/{task_id}"),
    ("PUT", "/api/groups/{group_id}/backlog"),
    ("POST", "/api/events"),
    ("PUT", "/api/events/{event_id}"),
    ("DELETE", "/api/events/{event_id}"),
    ("POST", "/api/feedback"),
    ("POST", "/api/session"),
    ("DELETE", "/api/session"),
}

# Used without logging in (and so by nobody's Role): logging in, links from emails, reports.
PUBLIC = {
    ("POST", "/api/password-resets"),
    ("PUT", "/api/password-resets"),
    ("POST", "/api/email-verifications"),
    ("POST", "/api/crash-reports"),
    ("POST", "/api/crash-reports/backups"),
}


def test_a_teacher_cannot_change_anything_but_the_days_work(
    app: FastAPI, admin: TestClient, teacher: TestClient
) -> None:
    # A real Child, so the Child routes reach their Role check instead of answering 404.
    child_id = create_child(admin)
    let_through = []
    # Every route of the API, as it describes itself.
    for template, operations in app.openapi()["paths"].items():
        path = re.sub(r"\{\w+\}", "1", template.replace("{child_id}", str(child_id)))
        for method in sorted(name.upper() for name in operations):
            if method == "GET" or (method, template) in TEACHER_CHANGES | PUBLIC:
                continue
            # The Role is checked before the request is: an empty one will do.
            status = teacher.request(method, path, json={}).status_code
            if status != 403:
                let_through.append(f"{method} {template}: {status}")

    assert let_through == []
    # Nothing changed: the Child is as the Admin made it.
    assert admin.get(f"/api/children/{child_id}").json()["firstName"] == "Lena"


# What only Admins may read: the Staff accounts, the Audit log, the Archive, Feedback, the
# Holidays imported, and a Parent's data export (Data-access request).
ADMIN_READS = [
    "/api/staff",
    "/api/audit-log",
    "/api/archive",
    "/api/feedback",
    "/api/holidays",
    "/api/parents/{parent_id}/export",
]


def test_a_teacher_cannot_read_what_only_admins_may(admin: TestClient, teacher: TestClient) -> None:
    parent_id = create_parent(admin)

    statuses = {
        template: teacher.get(template.replace("{parent_id}", str(parent_id))).status_code
        for template in ADMIN_READS
    }

    assert statuses == dict.fromkeys(ADMIN_READS, 403)
