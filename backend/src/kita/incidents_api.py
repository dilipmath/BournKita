"""HTTP API for the Incident log. Every Staff member reports Incidents and sees those they
reported; Admins see all and add Follow-ups. Incidents are Child data: reporting and Follow-ups
are logged as changes to the Child, and every look at the log as a view of each Child shown."""

from datetime import date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.routing import APIRoute
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.audit_api import about_noted_children, note_changed_fields, note_children
from kita.children import ChildNotFound, ChildSummary, TooLong
from kita.identity import Identity
from kita.identity_api import role_dependency, staff_member_dependency, staff_member_of
from kita.incidents import (
    DescriptionRequired,
    FollowUp,
    HappenedInFuture,
    Incident,
    IncidentDetails,
    IncidentFilter,
    IncidentNotFound,
    Incidents,
    InformedRequired,
    NoteRequired,
)


class IncidentIn(BaseModel):
    model_config = CAMEL_CASE

    happened_on: date
    # None when not known.
    happened_at: time | None = None
    description: str
    informed: str

    def details(self) -> IncidentDetails:
        return IncidentDetails(self.happened_on, self.happened_at, self.description, self.informed)


class IncidentChildOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    first_name: str
    last_name: str

    @classmethod
    def of(cls, child: ChildSummary) -> "IncidentChildOut":
        return cls.model_validate(child)


class FollowUpIn(BaseModel):
    note: str


class FollowUpOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    note: str
    author: str | None
    at: datetime

    @classmethod
    def of(cls, follow_up: FollowUp) -> "FollowUpOut":
        return cls.model_validate(follow_up)


class IncidentOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    child: IncidentChildOut
    happened_on: date
    happened_at: time | None
    description: str
    informed: str
    # The Staff member's email address; None once their account is gone.
    reported_by: str | None
    reported_at: datetime
    follow_ups: list[FollowUpOut]

    @classmethod
    def of(cls, incident: Incident) -> "IncidentOut":
        return cls.model_validate(incident)


_REFUSALS: Refusals = {
    ChildNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    IncidentNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    DescriptionRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "description_required"),
    InformedRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "informed_required"),
    NoteRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "note_required"),
    HappenedInFuture: (status.HTTP_422_UNPROCESSABLE_CONTENT, "in_future"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
}


def incidents_router(
    identity: Identity, incidents: Incidents, audited_route_class: type[APIRoute]
) -> APIRouter:
    """`audited_route_class` comes from audited_route."""
    router = APIRouter(
        dependencies=[Depends(staff_member_dependency(identity))],
        route_class=audited_route_class,
    )
    admin_only = [Depends(role_dependency(identity, "admin"))]

    @router.post("/api/children/{child_id}/incidents", status_code=status.HTTP_201_CREATED)
    def report_incident(child_id: int, incident: IncidentIn, request: Request) -> IncidentOut:
        reporter = staff_member_of(request).email
        with refusals_as_http_errors(_REFUSALS):
            reported = incidents.report(child_id, incident.details(), reporter)
        note_changed_fields(request, ["incidents"])
        return IncidentOut.of(reported)

    @router.get("/api/incidents")
    @about_noted_children
    def incident_log(
        request: Request,
        child_id: Annotated[int | None, Query(alias="childId")] = None,
        group_id: Annotated[int | None, Query(alias="groupId")] = None,
        since: date | None = None,
        until: date | None = None,
    ) -> list[IncidentOut]:
        """The Incidents, newest first: an Admin's of every Child, a Teacher's those they
        reported."""
        staff_member = staff_member_of(request)
        reported_by = None if staff_member.role == "admin" else staff_member.email
        found = incidents.log(IncidentFilter(child_id, group_id, since, until, reported_by))
        note_children(request, sorted({incident.child.id for incident in found}))
        return [IncidentOut.of(incident) for incident in found]

    @router.post(
        "/api/incidents/{incident_id}/follow-ups",
        status_code=status.HTTP_201_CREATED,
        dependencies=admin_only,
    )
    @about_noted_children
    def add_follow_up(incident_id: int, follow_up: FollowUpIn, request: Request) -> FollowUpOut:
        author = staff_member_of(request).email
        with refusals_as_http_errors(_REFUSALS):
            added = incidents.add_follow_up(incident_id, follow_up.note, author)
        note_children(request, [added.child_id])
        note_changed_fields(request, ["incidents"])
        return FollowUpOut.of(added.follow_up)

    return router
