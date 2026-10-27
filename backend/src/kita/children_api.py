"""HTTP API for Child profiles: every Staff member may read them, only Admins may change them."""

from dataclasses import asdict

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
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


_REFUSALS: Refusals = {
    ChildNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    NameRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "name_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
}


def children_router(identity: Identity, children: Children) -> APIRouter:
    router = APIRouter(
        prefix="/api/children", dependencies=[Depends(staff_member_dependency(identity))]
    )
    admin_only = [Depends(role_dependency(identity, "admin"))]

    @router.get("")
    def list_children(search: str = "") -> list[ChildSummaryOut]:
        return [ChildSummaryOut.of(summary) for summary in children.list(search)]

    @router.post("", status_code=status.HTTP_201_CREATED, dependencies=admin_only)
    def create_child(child: ChildIn) -> ChildOut:
        with refusals_as_http_errors(_REFUSALS):
            return ChildOut.of(children.create(child.details()))

    @router.get("/{child_id}")
    def child_profile(child_id: int) -> ChildOut:
        with refusals_as_http_errors(_REFUSALS):
            return ChildOut.of(children.profile(child_id))

    @router.put("/{child_id}", dependencies=admin_only)
    def update_child(child_id: int, child: ChildIn) -> ChildOut:
        with refusals_as_http_errors(_REFUSALS):
            return ChildOut.of(children.update(child_id, child.details()))

    @router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
    def delete_child(child_id: int) -> None:
        with refusals_as_http_errors(_REFUSALS):
            children.delete(child_id)

    return router
