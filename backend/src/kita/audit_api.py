"""HTTP API for the audit log: recorded centrally for every route of an audited router, and
browsed by Admins."""

import json
from collections.abc import Callable, Coroutine, Sequence
from dataclasses import asdict
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.routing import APIRoute
from pydantic import BaseModel
from pydantic.alias_generators import to_camel
from sqlalchemy import Engine

from kita.api_support import CAMEL_CASE
from kita.audit import Audit, AuditAction, AuditEntry, AuditFilter
from kita.children import Children
from kita.db import unit_of_work
from kita.identity import Identity
from kita.identity_api import role_dependency, staff_member_of

# What a successful request on a Child's address did to that Child's data.
_ACTIONS: dict[str, AuditAction] = {
    "GET": "viewed",
    "POST": "created",
    "PUT": "changed",
    "DELETE": "deleted",
}


# How an audited route finds the Children a request is about; set by the markers below.
_Subject = Literal["path", "created_child", "noted_children", "none", "part_of_logged_view"]


# Subjects of routes that record no entry.
_UNRECORDED: tuple[_Subject, ...] = ("none", "part_of_logged_view")


def _marked[Endpoint: Callable[..., Any]](endpoint: Endpoint, subject: _Subject) -> Endpoint:
    endpoint.audit_subject = subject  # type: ignore[attr-defined]
    return endpoint


def not_about_one_child[Endpoint: Callable[..., Any]](endpoint: Endpoint) -> Endpoint:
    """Marks an endpoint of an audited router that shows no Child's data beyond names (e.g. a
    list of names), so it is deliberately not logged. Put it below the route decorator."""
    return _marked(endpoint, "none")


def part_of_logged_view[Endpoint: Callable[..., Any]](endpoint: Endpoint) -> Endpoint:
    """Marks an endpoint that serves a part of a logged view (e.g. a photo of the gallery on a
    Child profile), so one look at the profile is one entry, not one per photo. Put it below the
    route decorator."""
    return _marked(endpoint, "part_of_logged_view")


def creates_child[Endpoint: Callable[..., Any]](endpoint: Endpoint) -> Endpoint:
    """Marks the endpoint that creates a Child profile: the entry is about the `id` in its
    response."""
    return _marked(endpoint, "created_child")


def about_noted_children[Endpoint: Callable[..., Any]](endpoint: Endpoint) -> Endpoint:
    """Marks an endpoint whose Children are not in its address (e.g. a Parent's page, which
    shows all their Children): it must call `note_children`, and gets an entry per Child."""
    return _marked(endpoint, "noted_children")


def note_children(request: Request, child_ids: Sequence[int]) -> None:
    """Called by an `about_noted_children` endpoint to say which Children it showed or changed."""
    request.state.audit_children = list(child_ids)


def note_changed_fields(request: Request, fields: Sequence[str]) -> None:
    """Called by a change endpoint to say which fields it changed (by their Python names), for
    the audit entry. Makes the entry a change whatever the method (e.g. linking a parent with a
    PUT, unlinking with a DELETE); a change of no fields gets no entry."""
    # Named as the API names them, e.g. foodPreferences.
    request.state.audit_changed_fields = [to_camel(field) for field in fields]


def note_deleted_permanently(request: Request) -> None:
    """Called by an endpoint that deletes Children's data for good (a deletion request): each
    entry is a deletion of the field "permanently", with no data of theirs."""
    note_changed_fields(request, ["permanently"])
    request.state.audit_action = "deleted"


def _noted_changed_fields(request: Request) -> list[str] | None:
    fields: list[str] | None = getattr(request.state, "audit_changed_fields", None)
    return fields


class UnauditableRoute(Exception):
    """An audited router has a route the audit log could not attribute to Children."""


def audited_route(audit: Audit, engine: Engine) -> type[APIRoute]:
    """A route class that records an audit entry after every successful request about one
    Child: a router gets audit logging by using it, without each endpoint writing entries.
    The request's work and its entry are one unit of work, saved together or not at all.
    The Child is the `child_id` path parameter, unless a marker (`creates_child`,
    `about_noted_children`, `not_about_one_child`) says otherwise. Routes it cannot attribute to
    Children stop the app from starting, so a new module cannot slip past the log by accident."""

    class AuditedRoute(APIRoute):
        def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
            # Set first: the base class builds the route handler while initialising.
            self.audit_subject: _Subject = getattr(endpoint, "audit_subject", "path")
            super().__init__(path, endpoint, **kwargs)
            _check_auditable(self, self.audit_subject)

        def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
            handle = super().get_route_handler()
            subject = self.audit_subject
            if subject in _UNRECORDED:
                return handle

            async def handle_and_record(request: Request) -> Response:
                async with unit_of_work(engine) as unit:
                    response = await handle(request)
                    if response.status_code < 300:
                        await run_in_threadpool(_record, audit, request, response, subject)
                        # Only now: a change whose entry failed is never saved, and a view
                        # whose entry failed is never answered.
                        await unit.commit()
                return response

            return handle_and_record

    return AuditedRoute


def _check_auditable(route: APIRoute, subject: _Subject) -> None:
    methods = route.methods or set()
    if subject == "part_of_logged_view" and methods != {"GET"}:
        raise UnauditableRoute(f"{route.path}: only a GET can be part of a logged view.")
    if subject in _UNRECORDED:
        return
    if subject == "created_child" and methods != {"POST"}:
        raise UnauditableRoute(f"{route.path}: only a POST can create a Child.")
    if subject == "path" and "{child_id}" not in route.path:
        raise UnauditableRoute(
            f"{' '.join(sorted(methods))} {route.path} names no Child: give it a {{child_id}} "
            "path parameter, or mark it creates_child, about_noted_children or "
            "not_about_one_child."
        )
    for method in methods - set(_ACTIONS):
        raise UnauditableRoute(f"{method} {route.path}: the audit log knows no such action.")


def _record(audit: Audit, request: Request, response: Response, subject: _Subject) -> None:
    if subject == "created_child":
        child_ids = [json.loads(bytes(response.body))["id"]]
    elif subject == "noted_children":
        # Missing means the endpoint forgot to say: fail rather than leave a gap in the log.
        child_ids = request.state.audit_children
    else:
        child_ids = [request.path_params["child_id"]]
    changed_fields = _noted_changed_fields(request)
    if changed_fields == []:
        return  # Saved without changing anything.
    action: AuditAction = getattr(request.state, "audit_action", None) or (
        _ACTIONS[request.method] if changed_fields is None else "changed"
    )
    for child_id in child_ids:
        audit.record(staff_member_of(request).email, action, int(child_id), changed_fields or ())


class AuditEntryOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    at: datetime
    staff_email: str
    action: AuditAction
    child_id: int
    # None once the Child profile is deleted.
    child_name: str | None
    changed_fields: list[str]

    @classmethod
    def of(cls, entry: AuditEntry, child_name: str | None) -> "AuditEntryOut":
        return cls(**asdict(entry), child_name=child_name)


def audit_router(identity: Identity, audit: Audit, children: Children) -> APIRouter:
    router = APIRouter(
        prefix="/api/audit-log", dependencies=[Depends(role_dependency(identity, "admin"))]
    )

    @router.get("")
    def audit_entries(
        child_id: Annotated[int | None, Query(alias="childId")] = None,
        staff_email: Annotated[str | None, Query(alias="staffEmail")] = None,
        action: AuditAction | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        before: int | None = None,
        limit: Annotated[int, Query(ge=1, le=500)] = 100,
    ) -> list[AuditEntryOut]:
        matching = AuditFilter(child_id, staff_email, action, since, until)
        entries = audit.entries(matching, before, limit)
        names = children.names({entry.child_id for entry in entries})
        return [AuditEntryOut.of(entry, names.get(entry.child_id)) for entry in entries]

    return router
