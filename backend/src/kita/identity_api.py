"""HTTP API for logging in and out, and the access check other endpoints depend on."""

from collections.abc import Callable
from typing import Annotated, Any, Literal

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Cookie,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from kita.identity import Identity, PasswordTooShort, Role, StaffMember
from kita.mail import MailNotSent
from kita.settings import Settings

SESSION_COOKIE = "kita_session"

SessionToken = Annotated[str | None, Cookie(alias=SESSION_COOKIE)]


class Credentials(BaseModel):
    email: str
    password: str


class PasswordChoice(BaseModel):
    """A password chosen with the token from an emailed link (verification or reset)."""

    token: str
    password: str


class PasswordResetRequest(BaseModel):
    email: str


class Session(BaseModel):
    """Who is logged in, and how long the session survives without activity."""

    model_config = ConfigDict(
        alias_generator=to_camel, validate_by_name=True, serialize_by_alias=True
    )

    email: str
    role: Role
    inactivity_timeout_minutes: int


def staff_member_dependency(
    identity: Identity, guests_allowed: bool = False
) -> Callable[..., StaffMember]:
    """A FastAPI dependency giving the logged-in Staff member; answers 401 when there is none.
    Every endpoint that needs a login depends on this instead of reading the cookie itself.
    The Staff member is also kept as `request.state.staff_member`, e.g. for the audit log.
    Guests are refused (403) unless `guests_allowed`: only what shows no personal data allows
    them, so a new endpoint keeps them out without having to remember to."""

    def current_staff_member(request: Request, token: SessionToken = None) -> StaffMember:
        staff_member = identity.current_staff_member(token) if token else None
        if staff_member is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="not_logged_in")
        if staff_member.role == "guest" and not guests_allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="not_for_guests")
        request.state.staff_member = staff_member
        return staff_member

    return current_staff_member


def staff_member_of(request: Request) -> StaffMember:
    """The logged-in Staff member of a request that passed staff_member_dependency."""
    staff_member: StaffMember = request.state.staff_member
    return staff_member


# The Roles a route can be kept for; Guests are refused everywhere anyway (see
# staff_member_dependency).
StaffRole = Literal["admin", "teacher"]

_ROLE_ONLY: dict[StaffRole, str] = {"admin": "admins_only", "teacher": "teachers_only"}


def role_dependency(identity: Identity, role: StaffRole) -> Callable[..., StaffMember]:
    """Like staff_member_dependency, but also answers 403 unless the Staff member has `role`."""
    current_staff_member = staff_member_dependency(identity)

    def staff_member_with_role(
        staff_member: Annotated[StaffMember, Depends(current_staff_member)],
    ) -> StaffMember:
        if staff_member.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_ROLE_ONLY[role])
        return staff_member

    return staff_member_with_role


def _choose_password(choose: Callable[[str, str], bool], choice: PasswordChoice) -> None:
    """Answers 422 for a too-short password and 400 when the link cannot be used."""
    try:
        chosen = choose(choice.token, choice.password)
    except PasswordTooShort:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail="password_too_short"
        ) from None
    if not chosen:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_link")


def email_verification_router(identity: Identity) -> APIRouter:
    router = APIRouter(prefix="/api/email-verifications")

    @router.post("", status_code=status.HTTP_204_NO_CONTENT)
    def verify_email(choice: PasswordChoice) -> None:
        _choose_password(identity.verify_email, choice)

    return router


def password_reset_router(identity: Identity) -> APIRouter:
    router = APIRouter(prefix="/api/password-resets")

    def request_password_reset(email: str) -> None:
        try:
            identity.request_password_reset(email)
        except MailNotSent:
            pass  # Already filed as a crash report; the Staff member can simply ask again.

    @router.post("", status_code=status.HTTP_202_ACCEPTED)
    def request_reset(request: PasswordResetRequest, background_tasks: BackgroundTasks) -> None:
        # Sent after answering, and the same answer for every email address: neither the
        # response nor its timing tells whether an account exists.
        background_tasks.add_task(request_password_reset, request.email)

    @router.put("", status_code=status.HTTP_204_NO_CONTENT)
    def reset_password(choice: PasswordChoice) -> None:
        _choose_password(identity.reset_password, choice)

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
    # Guests too: they log in like everyone else.
    CurrentStaffMember = Annotated[
        StaffMember, Depends(staff_member_dependency(identity, guests_allowed=True))
    ]

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
            # One answer for unknown email, wrong password and locked account, so accounts
            # cannot be probed.
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
