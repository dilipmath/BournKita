"""HTTP API for logging in and out, and the access check other endpoints depend on."""

from collections.abc import Callable
from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from kita.identity import Identity, PasswordTooShort, Role, StaffMember
from kita.settings import Settings

SESSION_COOKIE = "kita_session"

SessionToken = Annotated[str | None, Cookie(alias=SESSION_COOKIE)]


class Credentials(BaseModel):
    email: str
    password: str


class EmailVerification(BaseModel):
    token: str
    password: str


class Session(BaseModel):
    """Who is logged in, and how long the session survives without activity."""

    model_config = ConfigDict(
        alias_generator=to_camel, validate_by_name=True, serialize_by_alias=True
    )

    email: str
    role: Role
    inactivity_timeout_minutes: int


def staff_member_dependency(identity: Identity) -> Callable[[str | None], StaffMember]:
    """A FastAPI dependency giving the logged-in Staff member; answers 401 when there is none.
    Every endpoint that needs a login depends on this instead of reading the cookie itself."""

    def current_staff_member(token: SessionToken = None) -> StaffMember:
        staff_member = identity.current_staff_member(token) if token else None
        if staff_member is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not_logged_in")
        return staff_member

    return current_staff_member


_ROLE_ONLY: dict[Role, str] = {"admin": "admins_only", "teacher": "teachers_only"}


def role_dependency(identity: Identity, role: Role) -> Callable[[str | None], StaffMember]:
    """Like staff_member_dependency, but also answers 403 unless the Staff member has `role`."""
    current_staff_member = staff_member_dependency(identity)

    def staff_member_with_role(token: SessionToken = None) -> StaffMember:
        staff_member = current_staff_member(token)
        if staff_member.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ROLE_ONLY[role])
        return staff_member

    return staff_member_with_role


def email_verification_router(identity: Identity) -> APIRouter:
    router = APIRouter(prefix="/api/email-verifications")

    @router.post("", status_code=status.HTTP_204_NO_CONTENT)
    def verify_email(verification: EmailVerification) -> None:
        try:
            verified = identity.verify_email(verification.token, verification.password)
        except PasswordTooShort:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, detail="password_too_short"
            ) from None
        if not verified:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_link")

    return router


def identity_router(identity: Identity, settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api/session")
    cookie_options: dict[str, Any] = {
        "httponly": True,
        "secure": settings.session_cookie_secure,
        "samesite": "strict",
        "path": "/api",
    }
    timeout_minutes = int(identity.inactivity_timeout.total_seconds() // 60)
    CurrentStaffMember = Annotated[StaffMember, Depends(staff_member_dependency(identity))]

    def session_of(staff_member: StaffMember) -> Session:
        return Session(
            email=staff_member.email,
            role=staff_member.role,
            inactivity_timeout_minutes=timeout_minutes,
        )

    @router.post("")
    def log_in(
        credentials: Credentials, response: Response, previous_token: SessionToken = None
    ) -> Session:
        result = identity.log_in(credentials.email, credentials.password)
        if result is None:
            # One answer for unknown email and wrong password, so accounts cannot be probed.
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")
        if previous_token:
            identity.log_out(previous_token)
        token, staff_member = result
        response.set_cookie(SESSION_COOKIE, token, **cookie_options)
        return session_of(staff_member)

    @router.get("")
    def current_session(staff_member: CurrentStaffMember) -> Session:
        return session_of(staff_member)

    @router.delete("", status_code=status.HTTP_204_NO_CONTENT)
    def log_out(response: Response, token: SessionToken = None) -> None:
        if token:
            identity.log_out(token)
        response.delete_cookie(SESSION_COOKIE, **cookie_options)

    return router
