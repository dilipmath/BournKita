"""HTTP API for data-subject requests: only Admins export or delete for good what the Kita holds
about a Parent and their Children."""

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
from fastapi.routing import APIRoute

from kita.api_support import Refusals, refusals_as_http_errors
from kita.audit_api import about_noted_children, note_children, note_deleted_permanently
from kita.children import ChildNotFound
from kita.data_requests import DataRequests
from kita.identity import Identity
from kita.identity_api import role_dependency
from kita.parents import ParentNotFound
from kita.photos import Photos

_REFUSALS: Refusals = {
    ParentNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    # A Child deleted while the export was put together.
    ChildNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
}


def data_requests_router(
    identity: Identity,
    data_requests: DataRequests,
    photos: Photos,
    audited_route_class: type[APIRoute],
) -> APIRouter:
    """`audited_route_class` comes from audited_route: an export shows all the Children's data."""
    router = APIRouter(
        prefix="/api/parents",
        dependencies=[Depends(role_dependency(identity, "admin"))],
        route_class=audited_route_class,
    )

    @router.get("/{parent_id}/export", response_class=Response)
    @about_noted_children
    def export(parent_id: int, request: Request) -> Response:
        with refusals_as_http_errors(_REFUSALS):
            exported = data_requests.export(parent_id)
        note_children(request, exported.child_ids)
        return Response(
            exported.zip_file,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="parent-{parent_id}-data.zip"',
                # Personal and health data: kept in no cache.
                "Cache-Control": "no-store",
            },
        )

    @router.delete("/{parent_id}/data", status_code=status.HTTP_204_NO_CONTENT)
    @about_noted_children
    def delete_permanently(parent_id: int, request: Request, background: BackgroundTasks) -> None:
        """Deletes for good what the Kita holds about the Parent and their Children (a deletion
        request); it cannot be undone. The audit log keeps that it happened, not the data."""
        with refusals_as_http_errors(_REFUSALS):
            deleted = data_requests.delete_permanently(parent_id)
        note_children(request, deleted.child_ids)
        note_deleted_permanently(request)
        # After the response, so only once the deletion and its audit entries are saved.
        background.add_task(photos.delete_files, deleted.photo_files)

    return router
