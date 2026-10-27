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
from kita.contacts import Contact, ContactDetails, ContactKind, ContactNotFound, Contacts
from kita.identity import Identity
from kita.identity_api import role_dependency, staff_member_dependency
from kita.parents import LinkedParent, ParentNotFound, Parents
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


class LinkedParentOut(ParentOut):
    may_pick_up: bool

    @classmethod
    def of_link(cls, linked: LinkedParent) -> "LinkedParentOut":
        return cls(**asdict(linked.parent), may_pick_up=linked.may_pick_up)


class ParentLinkIn(BaseModel):
    model_config = CAMEL_CASE

    # None leaves it as it is (a new link may pick up).
    may_pick_up: bool | None = None


class ContactIn(BaseModel):
    model_config = CAMEL_CASE

    kind: ContactKind
    name: str
    relationship: str = ""
    phone: str = ""
    note: str = ""

    def details(self) -> ContactDetails:
        return ContactDetails(**self.model_dump(by_alias=False))


class ContactOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    name: str
    relationship: str
    phone: str
    note: str

    @classmethod
    def of(cls, contact: Contact) -> "ContactOut":
        return cls.model_validate(contact)


class ChildProfileOut(ChildOut):
    """The whole profile, as its page shows it."""

    parents: list[LinkedParentOut]
    emergency_contacts: list[ContactOut]
    pick_up_persons: list[ContactOut]


# The profile field each kind of contact is listed in, naming it in the audit log.
_CONTACT_FIELDS: dict[ContactKind, str] = {
    "emergency": "emergency_contacts",
    "pickUp": "pick_up_persons",
}


_REFUSALS: Refusals = {
    ChildNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    NameRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "name_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
    ParentNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    ContactNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
}


def children_router(
    identity: Identity,
    children: Children,
    parents: Parents,
    contacts: Contacts,
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
        its_contacts = contacts.of_child(child_id)

        def of_kind(kind: ContactKind) -> list[ContactOut]:
            return [ContactOut.of(contact) for contact in its_contacts if contact.kind == kind]

        return ChildProfileOut(
            **profile.model_dump(by_alias=False),
            parents=[LinkedParentOut.of_link(linked) for linked in parents.of_child(child_id)],
            emergency_contacts=of_kind("emergency"),
            pick_up_persons=of_kind("pickUp"),
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
    def link_parent(
        child_id: int, parent_id: int, request: Request, link: ParentLinkIn | None = None
    ) -> None:
        """Links the Parent; the body may also say whether they may pick up."""
        may_pick_up = (link or ParentLinkIn()).may_pick_up
        with refusals_as_http_errors(_REFUSALS):
            change = parents.link(child_id, parent_id, may_pick_up)
        if change == "linked":
            # A new link also adds a Pick-up person, unless the Admin said otherwise.
            fields = ["parents"] if may_pick_up is False else ["parents", "pick_up_persons"]
        else:
            fields = ["pick_up_persons"] if change == "pick_up_changed" else []
        note_changed_fields(request, fields)

    @router.post(
        "/{child_id}/contacts", status_code=status.HTTP_201_CREATED, dependencies=admin_only
    )
    def add_contact(child_id: int, contact: ContactIn, request: Request) -> ContactOut:
        with refusals_as_http_errors(_REFUSALS):
            added = contacts.add(child_id, contact.details())
        note_changed_fields(request, [_CONTACT_FIELDS[added.kind]])
        return ContactOut.of(added)

    @router.put("/{child_id}/contacts/{contact_id}", dependencies=admin_only)
    def update_contact(
        child_id: int, contact_id: int, contact: ContactIn, request: Request
    ) -> ContactOut:
        with refusals_as_http_errors(_REFUSALS):
            updated = contacts.update(child_id, contact_id, contact.details())
        # Moved to the other list, it changed both.
        kinds = {updated.previous_kind, updated.contact.kind} if updated.changed else set()
        note_changed_fields(request, sorted(_CONTACT_FIELDS[kind] for kind in kinds))
        return ContactOut.of(updated.contact)

    @router.delete(
        "/{child_id}/contacts/{contact_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=admin_only,
    )
    def remove_contact(child_id: int, contact_id: int, request: Request) -> None:
        with refusals_as_http_errors(_REFUSALS):
            kind = contacts.remove(child_id, contact_id)
        note_changed_fields(request, [_CONTACT_FIELDS[kind]])

    @router.delete(
        "/{child_id}/parents/{parent_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=admin_only,
    )
    def unlink_parent(child_id: int, parent_id: int, request: Request) -> None:
        with refusals_as_http_errors(_REFUSALS):
            could_pick_up = parents.unlink(child_id, parent_id)
        if could_pick_up is None:
            note_changed_fields(request, [])
        else:
            note_changed_fields(
                request, ["parents", "pick_up_persons"] if could_pick_up else ["parents"]
            )

    @router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
    def delete_child(child_id: int) -> None:
        with refusals_as_http_errors(_REFUSALS):
            children.delete(child_id)

    return router
