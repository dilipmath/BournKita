"""HTTP API for the emergency list: any Staff member prints it, as a PDF, for one Group or the
whole Kita."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.routing import APIRoute

from kita.api_support import Refusals, refusals_as_http_errors
from kita.audit_api import about_noted_children, note_children
from kita.emergency_list import EmergencyLists
from kita.emergency_list_pdf import Language, emergency_list_pdf
from kita.groups import GroupNotFound
from kita.identity import Identity
from kita.identity_api import staff_member_dependency

_REFUSALS: Refusals = {GroupNotFound: (status.HTTP_404_NOT_FOUND, "not_found")}


def emergency_list_router(
    identity: Identity, emergency_lists: EmergencyLists, audited_route_class: type[APIRoute]
) -> APIRouter:
    """`audited_route_class` comes from audited_route: the list shows Children's Alerts and
    whom to call."""
    router = APIRouter(
        prefix="/api/emergency-list",
        dependencies=[Depends(staff_member_dependency(identity))],
        route_class=audited_route_class,
    )

    @router.get("", response_class=Response)
    @about_noted_children
    def emergency_list(
        request: Request,
        group_id: Annotated[int | None, Query(alias="groupId")] = None,
        language: Language = "de",
    ) -> Response:
        """`groupId`: that Group's list; without it, the whole Kita's."""
        with refusals_as_http_errors(_REFUSALS):
            found = (
                emergency_lists.of_kita()
                if group_id is None
                else emergency_lists.of_group(group_id)
            )
        note_children(request, found.child_ids)
        day = found.day.isoformat()
        return Response(
            emergency_list_pdf(found, language),
            media_type="application/pdf",
            headers={
                # Opened in the browser, from where a tablet prints it.
                "Content-Disposition": f'inline; filename="emergency-list-{day}.pdf"',
                # Health data: kept in no cache.
                "Cache-Control": "no-store",
            },
        )

    return router
