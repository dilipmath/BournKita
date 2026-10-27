"""HTTP API for the audit log: recorded centrally for every route of an audited router, and
browsed by Admins."""

import json
from collections.abc import Callable, Coroutine, Sequence
from dataclasses import asdict
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.routing import APIRoute
from pydantic import BaseModel
from pydantic.alias_generators import to_camel

from kita.api_support import CAMEL_CASE
from kita.audit import Audit, AuditAction, AuditEntry, AuditFilter
from kita.children import Children
from kita.identity import Identity
from kita.identity_api import role_dependency, staff_member_of

# What a successful request on a Child's address did to that Child's data.
_ACTIONS: dict[str, AuditAction] = {
    "GET": "viewed",
    "POST": "created",
    "PUT": "changed",
    "DELETE": "deleted",
}


def not_about_one_child[Endpoint: Callable[..., Any]](endpoint: Endpoint) -> Endpoint:
    """Marks an endpoint of an audited router that shows no single Child's data (e.g. the list
    of names), so it is deliberately not logged. Put it below the route decorator."""
    endpoint.not_about_one_child = True  # type: ignore[attr-defined]
    return endpoint


def note_changed_fields(request: Request, fields: Sequence[str]) -> None:
    """Called by a change endpoint to say which fields it changed (by their Python names), for
    the audit entry. A change of no fields gets no entry."""
    # Named as the API names them, e.g. foodPreferences.
    request.state.audit_changed_fields = [to_camel(field) for field in fields]


def _noted_changed_fields(request: Request) -> list[str] | None:
    fields: list[str] | None = getattr(request.state, "audit_changed_fields", None)
    return fields


class UnauditableRoute(Exception):
    """An audited router has a route the audit log could not attribute to one Child."""


def audited_route(audit: Audit) -> type[APIRoute]:
    """A route class that records an audit entry after every successful request about one
    Child: a router gets audit logging by using it, without each endpoint writing entries.
    The Child is the `child_id` path parameter or, for a create, the `id` in the response.
    Routes it cannot attribute to one Child stop the app from starting, unless marked with
    `not_about_one_child`, so a new module cannot slip past the log by accident."""

    class AuditedRoute(APIRoute):
        def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
            # Set first: the base class builds the route handler while initialising.
            self.not_about_one_child = getattr(endpoint, "not_about_one_child", False)
            super().__init__(path, endpoint, **kwargs)
            if not self.not_about_one_child:
                _check_auditable(self)

        def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
            handle = super().get_route_handler()
            if self.not_about_one_child:
                return handle

            async def handle_and_record(request: Request) -> Response:
                response = await handle(request)
                if response.status_code < 300:
                    await run_in_threadpool(_record, audit, request, response)
                return response

            return handle_and_record

    return AuditedRoute


def _check_auditable(route: APIRoute) -> None:
    about_one_child = "{child_id}" in route.path
    for method in route.methods or ():
        if method not in _ACTIONS or (not about_one_child and method != "POST"):
            raise UnauditableRoute(
                f"{method} {route.path} names no single Child: give it a {{child_id}} path "
                "parameter, or mark it not_about_one_child."
            )


def _record(audit: Audit, request: Request, response: Response) -> None:
    child_id = request.path_params.get("child_id")
    if child_id is None:
        # A create, which _check_auditable allows only here: the new Child's ID is in the body.
        child_id = json.loads(bytes(response.body))["id"]
    changed_fields = _noted_changed_fields(request)
    if changed_fields == []:
        return  # Saved without changing anything.
    audit.record(
        staff_member_of(request).email,
        _ACTIONS[request.method],
        int(child_id),
        changed_fields or (),
    )


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
