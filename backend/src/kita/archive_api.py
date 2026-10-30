"""HTTP API for the archive: only Admins see the deleted Child profiles and restore them."""

from datetime import date, datetime

from fastapi import APIRouter, Depends, Request, status
from fastapi.routing import APIRoute
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.archive import Archive, ArchivedChild
from kita.audit_api import not_about_one_child, note_changed_fields
from kita.children import ChildNotFound
from kita.identity import Identity
from kita.identity_api import role_dependency

_REFUSALS: Refusals = {ChildNotFound: (status.HTTP_404_NOT_FOUND, "not_found")}


class ArchivedChildOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    first_name: str
    last_name: str
    archived_at: datetime
    purge_on: date

    @classmethod
    def of(cls, child: ArchivedChild) -> "ArchivedChildOut":
        return cls.model_validate(child)


def archive_router(
    identity: Identity, archive: Archive, audited_route_class: type[APIRoute]
) -> APIRouter:
    """`audited_route_class` comes from audited_route: restoring brings back a Child's data."""
    router = APIRouter(
        prefix="/api/archive",
        dependencies=[Depends(role_dependency(identity, "admin"))],
        route_class=audited_route_class,
    )

    @router.get("")
    @not_about_one_child
    def archived_children() -> list[ArchivedChildOut]:
        return [ArchivedChildOut.of(child) for child in archive.archived_children()]

    @router.post("/{child_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
    def restore(child_id: int, request: Request) -> None:
        with refusals_as_http_errors(_REFUSALS):
            archive.restore(child_id)
        note_changed_fields(request, ["archived"])

    return router
