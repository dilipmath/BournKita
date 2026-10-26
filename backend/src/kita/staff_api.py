"""HTTP API for the Admin-only staff accounts page."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

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


class StaffAccountOut(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        # Read attributes by their Python names too (email_sent), not only by alias.
        validate_by_name=True,
        serialize_by_alias=True,
        from_attributes=True,
    )

    id: int
    email: str
    role: Role
    status: AccountStatus

    @classmethod
    def of(cls, account: StaffAccount) -> "StaffAccountOut":
        return cls.model_validate(account)


class CreatedStaffAccountOut(StaffAccountOut):
    email_sent: bool


# Each rule an account change can break, with the error code the API answers.
_REFUSALS: dict[type[Exception], tuple[int, str]] = {
    AccountNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    EmailTaken: (status.HTTP_409_CONFLICT, "email_taken"),
    InvalidEmail: (status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_email"),
    LastAdmin: (status.HTTP_409_CONFLICT, "last_admin"),
    NotInvited: (status.HTTP_409_CONFLICT, "not_invited"),
    OwnAccount: (status.HTTP_409_CONFLICT, "own_account"),
    MailNotSent: (status.HTTP_503_SERVICE_UNAVAILABLE, "mail_not_sent"),
}


@contextmanager
def _refusals_as_http_errors() -> Iterator[None]:
    try:
        yield
    except tuple(_REFUSALS) as error:
        status_code, detail = _REFUSALS[type(error)]
        raise HTTPException(status_code, detail=detail) from None


def staff_router(identity: Identity) -> APIRouter:
    admin_only = role_dependency(identity, "admin")
    router = APIRouter(prefix="/api/staff", dependencies=[Depends(admin_only)])
    Admin = Annotated[StaffMember, Depends(admin_only)]

    @router.get("")
    def list_staff_accounts() -> list[StaffAccountOut]:
        return [StaffAccountOut.of(account) for account in identity.staff_accounts()]

    @router.post("", status_code=status.HTTP_201_CREATED)
    def create_staff_member(new: NewStaffMember) -> CreatedStaffAccountOut:
        with _refusals_as_http_errors():
            return CreatedStaffAccountOut.model_validate(
                identity.create_staff_member(new.email, new.role)
            )

    @router.put("/{account_id}/role")
    def change_role(account_id: int, change: RoleChange) -> StaffAccountOut:
        with _refusals_as_http_errors():
            return StaffAccountOut.of(identity.change_role(account_id, change.role))

    @router.put("/{account_id}/active")
    def change_active(account_id: int, change: ActiveChange, admin: Admin) -> StaffAccountOut:
        with _refusals_as_http_errors():
            return StaffAccountOut.of(identity.set_active(account_id, change.active, by=admin))

    @router.post("/{account_id}/invitation", status_code=status.HTTP_204_NO_CONTENT)
    def send_new_link(account_id: int) -> None:
        with _refusals_as_http_errors():
            identity.send_new_link(account_id)

    return router
