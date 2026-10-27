"""HTTP API for Parents: every Staff member may read them, only Admins may change them. Linking
a Parent to a Child is on the Child's address (see children_api)."""

from dataclasses import asdict

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.routing import APIRoute
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.audit_api import (
    about_noted_children,
    not_about_one_child,
    note_changed_fields,
    note_children,
    part_of_logged_view,
)
from kita.children import ChildSummary, NameRequired, TooLong
from kita.identity import Identity
from kita.identity_api import role_dependency, staff_member_dependency
from kita.parents import Parent, ParentDetails, ParentNotFound, Parents, ParentSummary
from kita.photos import ParentPhoto, Photos, PhotoSize
from kita.photos_api import PHOTO_REFUSALS, photo_response, read_upload


class ParentIn(BaseModel):
    model_config = CAMEL_CASE

    first_name: str
    last_name: str
    address: str = ""
    phone: str = ""
    email: str = ""

    def details(self) -> ParentDetails:
        return ParentDetails(**self.model_dump(by_alias=False))


class ParentOut(ParentIn):
    id: int

    @classmethod
    def of(cls, parent: Parent) -> "ParentOut":
        return cls(**asdict(parent))


class LinkedChildOut(BaseModel):
    """One of a Parent's Children, by name."""

    model_config = CAMEL_CASE

    id: int
    first_name: str
    last_name: str

    @classmethod
    def of(cls, child: ChildSummary) -> "LinkedChildOut":
        return cls.model_validate(child)


class ParentWithChildrenOut(ParentOut):
    children: list[LinkedChildOut]


class ParentSummaryOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    first_name: str
    last_name: str

    @classmethod
    def of(cls, summary: ParentSummary) -> "ParentSummaryOut":
        return cls.model_validate(summary)


_REFUSALS: Refusals = {
    ParentNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    NameRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "name_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
    **PHOTO_REFUSALS,
}


def parents_router(
    identity: Identity, parents: Parents, photos: Photos, audited_route_class: type[APIRoute]
) -> APIRouter:
    """`audited_route_class` comes from audited_route: a Parent's data is their Children's."""
    router = APIRouter(
        prefix="/api/parents",
        dependencies=[Depends(staff_member_dependency(identity))],
        route_class=audited_route_class,
    )
    admin_only = [Depends(role_dependency(identity, "admin"))]

    @router.get("")
    @not_about_one_child
    def list_parents(search: str = "") -> list[ParentSummaryOut]:
        return [ParentSummaryOut.of(summary) for summary in parents.summaries(search)]

    @router.post("", status_code=status.HTTP_201_CREATED, dependencies=admin_only)
    @not_about_one_child  # Linked to no Child yet; linking is audited on the Child.
    def create_parent(parent: ParentIn) -> ParentOut:
        with refusals_as_http_errors(_REFUSALS):
            return ParentOut.of(parents.create(parent.details()))

    @router.get("/{parent_id}")
    @about_noted_children
    def parent_with_children(parent_id: int, request: Request) -> ParentWithChildrenOut:
        with refusals_as_http_errors(_REFUSALS):
            found = parents.parent(parent_id)
        note_children(request, [child.id for child in found.children])
        return ParentWithChildrenOut(
            **ParentOut.of(found.parent).model_dump(by_alias=False),
            children=[LinkedChildOut.of(child) for child in found.children],
        )

    @router.put("/{parent_id}", dependencies=admin_only)
    @about_noted_children
    def update_parent(parent_id: int, parent: ParentIn, request: Request) -> ParentOut:
        with refusals_as_http_errors(_REFUSALS):
            updated = parents.update(parent_id, parent.details())
        note_children(request, updated.child_ids)
        # Named after the parent, e.g. parentAddress, to tell them from the Child's own fields.
        note_changed_fields(request, [f"parent_{field}" for field in updated.changed_fields])
        return ParentOut.of(updated.parent)

    @router.put(
        "/{parent_id}/photo", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only
    )
    @about_noted_children
    async def set_parent_photo(
        parent_id: int, photo: UploadFile, request: Request, background: BackgroundTasks
    ) -> None:
        data = await read_upload(photo)
        with refusals_as_http_errors(_REFUSALS):
            replaced = await run_in_threadpool(
                photos.set_pick_up_photo, ParentPhoto(parent_id), data
            )
            found = await run_in_threadpool(parents.parent, parent_id)
        note_children(request, [child.id for child in found.children])
        note_changed_fields(request, ["parent_photo"])
        background.add_task(photos.delete_files, replaced)

    @router.get("/{parent_id}/photo/{size}")
    @part_of_logged_view
    def parent_photo_file(parent_id: int, size: PhotoSize, request: Request) -> Response:
        with refusals_as_http_errors(_REFUSALS):
            data = photos.pick_up_photo_file(ParentPhoto(parent_id), size)
        return photo_response(data, request)

    @router.delete(
        "/{parent_id}/photo", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only
    )
    @about_noted_children
    def remove_parent_photo(parent_id: int, request: Request, background: BackgroundTasks) -> None:
        with refusals_as_http_errors(_REFUSALS):
            removed = photos.remove_pick_up_photo(ParentPhoto(parent_id))
            found = parents.parent(parent_id)
        note_children(request, [child.id for child in found.children])
        note_changed_fields(request, ["parent_photo"])
        background.add_task(photos.delete_files, removed)

    return router
