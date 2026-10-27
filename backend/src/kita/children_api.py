"""HTTP API for Child profiles: every Staff member may read them, only Admins may change them."""

from dataclasses import asdict

from fastapi import APIRouter, Depends, Request, status
from fastapi.routing import APIRoute
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.audit_api import creates_child, not_about_one_child, note_changed_fields
from kita.children import (
    ChildDetails,
    ChildNotFound,
    ChildProfile,
    Children,
    ChildSummary,
    Gender,
    NameRequired,
    TooLong,
)
from kita.identity import Identity
from kita.identity_api import role_dependency, staff_member_dependency
from kita.parents import ParentNotFound, Parents
from kita.parents_api import ParentOut


class ChildSummaryOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    first_name: str
    last_name: str

    @classmethod
    def of(cls, summary: ChildSummary) -> "ChildSummaryOut":
        return cls.model_validate(summary)


class ChildIn(BaseModel):
    model_config = CAMEL_CASE

    first_name: str
    last_name: str
    gender: Gender | None = None
    languages: str = ""
    food_preferences: str = ""
    interests: str = ""

    def details(self) -> ChildDetails:
        return ChildDetails(**self.model_dump(by_alias=False))


class ChildOut(ChildIn):
    id: int

    @classmethod
    def of(cls, profile: ChildProfile) -> "ChildOut":
        return cls(**asdict(profile))


class ChildProfileOut(ChildOut):
    """The whole profile, as its page shows it."""

    parents: list[ParentOut]


_REFUSALS: Refusals = {
    ChildNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    NameRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "name_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
    ParentNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
}


def children_router(
    identity: Identity,
    children: Children,
    parents: Parents,
    audited_route_class: type[APIRoute],
) -> APIRouter:
    """`audited_route_class` comes from audited_route."""
    router = APIRouter(
        prefix="/api/children",
        dependencies=[Depends(staff_member_dependency(identity))],
        # Every view and change of a Child's data goes into the audit log.
        route_class=audited_route_class,
    )
    admin_only = [Depends(role_dependency(identity, "admin"))]

    @router.get("")
    @not_about_one_child
    def list_children(search: str = "") -> list[ChildSummaryOut]:
        return [ChildSummaryOut.of(summary) for summary in children.summaries(search)]

    @router.post("", status_code=status.HTTP_201_CREATED, dependencies=admin_only)
    @creates_child
    def create_child(child: ChildIn) -> ChildOut:
        with refusals_as_http_errors(_REFUSALS):
            return ChildOut.of(children.create(child.details()))

    @router.get("/{child_id}")
    def child_profile(child_id: int) -> ChildProfileOut:
        with refusals_as_http_errors(_REFUSALS):
            profile = ChildOut.of(children.profile(child_id))
        return ChildProfileOut(
            **profile.model_dump(by_alias=False),
            parents=[ParentOut.of(parent) for parent in parents.of_child(child_id)],
        )

    @router.put("/{child_id}", dependencies=admin_only)
    def update_child(child_id: int, child: ChildIn, request: Request) -> ChildOut:
        with refusals_as_http_errors(_REFUSALS):
            profile, changed = children.update(child_id, child.details())
        note_changed_fields(request, changed)
        return ChildOut.of(profile)

    @router.put(
        "/{child_id}/parents/{parent_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=admin_only,
    )
    def link_parent(child_id: int, parent_id: int, request: Request) -> None:
        with refusals_as_http_errors(_REFUSALS):
            linked = parents.link(child_id, parent_id)
        note_changed_fields(request, ["parents"] if linked else [])

    @router.delete(
        "/{child_id}/parents/{parent_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=admin_only,
    )
    def unlink_parent(child_id: int, parent_id: int, request: Request) -> None:
        with refusals_as_http_errors(_REFUSALS):
            unlinked = parents.unlink(child_id, parent_id)
        note_changed_fields(request, ["parents"] if unlinked else [])

    @router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
    def delete_child(child_id: int) -> None:
        with refusals_as_http_errors(_REFUSALS):
            children.delete(child_id)

    return router
