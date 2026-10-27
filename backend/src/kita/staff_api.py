"""HTTP API for the Admin-only staff accounts page."""

from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.groups import GroupNotFound, Groups
from kita.identity import (
    AccountNotFound,
    AccountStatus,
    EmailTaken,
    Identity,
    InvalidEmail,
    LastAdmin,
    NotInvited,
    OwnAccount,
    Role,
    StaffAccount,
    StaffMember,
)
from kita.identity_api import role_dependency
from kita.mail import MailNotSent


class NewStaffMember(BaseModel):
    email: str
    role: Role


class RoleChange(BaseModel):
    role: Role


class ActiveChange(BaseModel):
    active: bool


class GroupsChoice(BaseModel):
    model_config = CAMEL_CASE

    group_ids: list[int]


class StaffAccountOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    email: str
    role: Role
    status: AccountStatus
    # The Groups they work in.
    group_ids: list[int]

    @classmethod
    def of(cls, account: StaffAccount, group_ids: list[int]) -> "StaffAccountOut":
        return cls(**asdict(account), group_ids=group_ids)


class CreatedStaffAccountOut(StaffAccountOut):
    email_sent: bool


_REFUSALS: Refusals = {
    AccountNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    EmailTaken: (status.HTTP_409_CONFLICT, "email_taken"),
    InvalidEmail: (status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_email"),
    LastAdmin: (status.HTTP_409_CONFLICT, "last_admin"),
    NotInvited: (status.HTTP_409_CONFLICT, "not_invited"),
    OwnAccount: (status.HTTP_409_CONFLICT, "own_account"),
    MailNotSent: (status.HTTP_503_SERVICE_UNAVAILABLE, "mail_not_sent"),
    GroupNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
}


def staff_router(identity: Identity, groups: Groups) -> APIRouter:
    admin_only = role_dependency(identity, "admin")
    router = APIRouter(prefix="/api/staff", dependencies=[Depends(admin_only)])
    Admin = Annotated[StaffMember, Depends(admin_only)]

    @router.get("")
    def list_staff_accounts() -> list[StaffAccountOut]:
        staff_groups = groups.staff_groups()
        return [
            StaffAccountOut.of(account, staff_groups.get(account.id, []))
            for account in identity.staff_accounts()
        ]

    def out(account: StaffAccount) -> StaffAccountOut:
        return StaffAccountOut.of(account, groups.of_staff_member(account.id))

    @router.post("", status_code=status.HTTP_201_CREATED)
    def create_staff_member(new: NewStaffMember) -> CreatedStaffAccountOut:
        with refusals_as_http_errors(_REFUSALS):
            created = identity.create_staff_member(new.email, new.role)
        return CreatedStaffAccountOut(**asdict(created), group_ids=[])

    @router.put("/{account_id}/role")
    def change_role(account_id: int, change: RoleChange) -> StaffAccountOut:
        with refusals_as_http_errors(_REFUSALS):
            return out(identity.change_role(account_id, change.role))

    @router.put("/{account_id}/active")
    def change_active(account_id: int, change: ActiveChange, admin: Admin) -> StaffAccountOut:
        with refusals_as_http_errors(_REFUSALS):
            return out(identity.set_active(account_id, change.active, by=admin))

    @router.put("/{account_id}/groups")
    def choose_groups(account_id: int, choice: GroupsChoice) -> StaffAccountOut:
        """Says which Groups the Staff member works in."""
        with refusals_as_http_errors(_REFUSALS):
            group_ids = groups.set_staff_groups(account_id, choice.group_ids)
        return StaffAccountOut.of(identity.staff_account(account_id), group_ids)

    @router.post("/{account_id}/invitation", status_code=status.HTTP_204_NO_CONTENT)
    def send_new_link(account_id: int) -> None:
        with refusals_as_http_errors(_REFUSALS):
            identity.send_new_link(account_id)

    return router
