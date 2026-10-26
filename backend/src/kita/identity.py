"""Identity & access: Staff member accounts, passwords and sessions."""

import hashlib
import re
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Literal

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from sqlalchemy import (
    CheckConstraint,
    Column,
    Connection,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    Row,
    String,
    Table,
    UniqueConstraint,
    delete,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.exc import IntegrityError

from kita.clock import Clock
from kita.db import metadata
from kita.identity_emails import verification_email
from kita.mail import Mailer
from kita.settings import Settings

Role = Literal["admin", "teacher"]
# invited: email address not verified yet, so no password and no login.
AccountStatus = Literal["invited", "active", "deactivated"]

MIN_PASSWORD_LENGTH = 12
VERIFICATION_LINK_VALIDITY = timedelta(days=7)

users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("email", String(320), nullable=False),
    Column("password_hash", String),
    Column("role", String(20), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("email_verified_at", DateTime(timezone=True)),
    Column("deactivated_at", DateTime(timezone=True)),
    CheckConstraint("role IN ('admin', 'teacher')", name="role"),
    UniqueConstraint("email"),
)

sessions = Table(
    "sessions",
    metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("last_active_at", DateTime(timezone=True), nullable=False),
)

email_verifications = Table(
    "email_verifications",
    metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
)

# An active account has verified its email address and is not deactivated: only it can log in.
_IS_ACTIVE = (users.c.email_verified_at.is_not(None), users.c.deactivated_at.is_(None))
_ACCOUNT_COLUMNS = (
    users.c.id,
    users.c.email,
    users.c.role,
    users.c.email_verified_at,
    users.c.deactivated_at,
)


@dataclass(frozen=True)
class StaffMember:
    email: str
    role: Role


@dataclass(frozen=True)
class StaffAccount:
    id: int
    email: str
    role: Role
    status: AccountStatus


class AccountsAlreadyExist(Exception):
    """The first Admin can only be created while there are no accounts."""


class EmailTaken(Exception):
    """Another account already uses this email address."""


class InvalidEmail(Exception):
    """The text is not shaped like an email address."""


class AccountNotFound(Exception):
    """No account has this ID."""


class LastAdmin(Exception):
    """The change would leave the Kita without an active Admin."""


class OwnAccount(Exception):
    """Admins cannot deactivate their own account; another Admin has to."""


class PasswordTooShort(Exception):
    """Passwords need at least MIN_PASSWORD_LENGTH characters."""


class NotInvited(Exception):
    """Only accounts that have not verified their email address yet get a new link."""


_hasher = PasswordHasher()
# Verified against when the email is unknown, so a wrong email takes as long as a wrong password.
_DUMMY_HASH = _hasher.hash("not a real password")
_EMAIL_SHAPE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalise_email(email: str) -> str:
    return email.strip().lower()


def is_valid_email(email: str) -> bool:
    return _EMAIL_SHAPE.match(normalise_email(email)) is not None


def _valid_email(email: str) -> str:
    if not is_valid_email(email):
        raise InvalidEmail
    return normalise_email(email)


def _token_hash(token: str) -> str:
    # Only the hash is stored, so a database dump cannot be used to take over sessions or accounts.
    return hashlib.sha256(token.encode()).hexdigest()


def _to_account(row: Row[*tuple[Any, ...]]) -> StaffAccount:
    if row.deactivated_at is not None:
        status: AccountStatus = "deactivated"
    else:
        status = "active" if row.email_verified_at is not None else "invited"
    return StaffAccount(row.id, row.email, row.role, status)


class Identity:
    def __init__(
        self,
        engine: Engine,
        clock: Clock,
        mailer: Mailer,
        inactivity_timeout: timedelta,
        public_url: str,
    ) -> None:
        self._engine = engine
        self._clock = clock
        self._mailer = mailer
        self._inactivity_timeout = inactivity_timeout
        self._public_url = public_url.rstrip("/")

    @classmethod
    def from_settings(
        cls, engine: Engine, clock: Clock, mailer: Mailer, settings: Settings
    ) -> "Identity":
        return cls(
            engine,
            clock,
            mailer,
            timedelta(minutes=settings.session_inactivity_minutes),
            settings.public_url,
        )

    @property
    def inactivity_timeout(self) -> timedelta:
        return self._inactivity_timeout

    def create_first_admin(self, email: str, password: str) -> None:
        email = _valid_email(email)
        _check_password(password)
        with self._engine.begin() as connection:
            # Serialises concurrent setup runs, so two first Admins cannot slip in.
            connection.exec_driver_sql("LOCK TABLE users IN EXCLUSIVE MODE")
            if connection.scalar(select(users.c.id).limit(1)) is not None:
                raise AccountsAlreadyExist
            now = self._clock.now()
            connection.execute(
                insert(users).values(
                    email=email,
                    password_hash=_hasher.hash(password),
                    role="admin",
                    created_at=now,
                    # Typed in on the server by whoever runs the setup, so nothing to verify.
                    email_verified_at=now,
                )
            )

    def log_in(self, email: str, password: str) -> tuple[str, StaffMember] | None:
        """Returns a new session token and the Staff member, or None for wrong credentials.
        Invited and deactivated accounts cannot log in."""
        with self._engine.begin() as connection:
            user = connection.execute(
                select(users.c.id, users.c.email, users.c.role, users.c.password_hash).where(
                    users.c.email == normalise_email(email), *_IS_ACTIVE
                )
            ).one_or_none()
            password_hash = user.password_hash if user and user.password_hash else _DUMMY_HASH
            if not _password_matches(password_hash, password) or user is None:
                return None
            if _hasher.check_needs_rehash(password_hash):
                # Hashing parameters got stronger since this password was set.
                connection.execute(
                    update(users)
                    .where(users.c.id == user.id)
                    .values(password_hash=_hasher.hash(password))
                )
            token = secrets.token_urlsafe(32)
            now = self._clock.now()
            # Housekeeping: sessions past their inactivity timeout can never be used again.
            connection.execute(
                delete(sessions).where(sessions.c.last_active_at <= now - self._inactivity_timeout)
            )
            connection.execute(
                insert(sessions).values(
                    token_hash=_token_hash(token),
                    user_id=user.id,
                    created_at=now,
                    last_active_at=now,
                )
            )
            return token, StaffMember(email=user.email, role=user.role)

    def current_staff_member(self, token: str) -> StaffMember | None:
        """The Staff member whose session this is, or None if there is no live session.
        Counts as activity, so the session's inactivity timeout starts again."""
        now = self._clock.now()
        with self._engine.begin() as connection:
            row = connection.execute(
                select(users.c.email, users.c.role)
                .join(sessions, sessions.c.user_id == users.c.id)
                .where(
                    sessions.c.token_hash == _token_hash(token),
                    sessions.c.last_active_at > now - self._inactivity_timeout,
                    *_IS_ACTIVE,
                )
            ).one_or_none()
            if row is None:
                return None
            connection.execute(
                update(sessions)
                .where(sessions.c.token_hash == _token_hash(token))
                .values(last_active_at=now)
            )
            return StaffMember(email=row.email, role=row.role)

    def log_out(self, token: str) -> None:
        with self._engine.begin() as connection:
            connection.execute(delete(sessions).where(sessions.c.token_hash == _token_hash(token)))

    def staff_accounts(self) -> list[StaffAccount]:
        with self._engine.connect() as connection:
            rows = connection.execute(select(*_ACCOUNT_COLUMNS).order_by(users.c.email)).all()
        return [_to_account(row) for row in rows]

    def create_staff_member(self, email: str, role: Role) -> StaffAccount:
        """Creates an invited account and emails a link for choosing a password."""
        email = _valid_email(email)
        try:
            with self._engine.begin() as connection:
                user_id = connection.scalar(
                    insert(users)
                    .values(email=email, role=role, created_at=self._clock.now())
                    .returning(users.c.id)
                )
                assert user_id is not None
                token = self._new_verification_link(connection, user_id)
        except IntegrityError:
            # The unique email constraint, also when two Admins add the same address at once.
            raise EmailTaken from None
        self._send_verification_email(email, token)
        return StaffAccount(user_id, email, role, "invited")

    def send_new_link(self, account_id: int) -> None:
        """Replaces an invited account's verification link, e.g. after it expired."""
        with self._engine.begin() as connection:
            account = self._account(connection, account_id)
            if account.status != "invited":
                raise NotInvited
            token = self._new_verification_link(connection, account_id)
        self._send_verification_email(account.email, token)

    def verify_email(self, token: str, password: str) -> bool:
        """Sets the password and verifies the email address. False for an unknown, used or
        expired link, or a deactivated account."""
        _check_password(password)
        now = self._clock.now()
        with self._engine.begin() as connection:
            user_id = connection.scalar(
                delete(email_verifications)
                .where(
                    email_verifications.c.token_hash == _token_hash(token),
                    email_verifications.c.expires_at > now,
                )
                .returning(email_verifications.c.user_id)
            )
            if user_id is None:
                return False
            verified = connection.execute(
                update(users)
                .where(users.c.id == user_id, users.c.deactivated_at.is_(None))
                .values(password_hash=_hasher.hash(password), email_verified_at=now)
            )
            return verified.rowcount == 1

    def change_role(self, account_id: int, role: Role) -> StaffAccount:
        with self._engine.begin() as connection:
            self._lock_accounts(connection)
            account = self._account(connection, account_id)
            if role != "admin":
                self._ensure_another_active_admin(connection, account)
            connection.execute(update(users).where(users.c.id == account_id).values(role=role))
            return self._account(connection, account_id)

    def set_active(self, account_id: int, active: bool, by: StaffMember) -> StaffAccount:
        """Deactivating ends the account's sessions and voids its verification link at once;
        its history stays. `by` is the Admin making the change."""
        with self._engine.begin() as connection:
            self._lock_accounts(connection)
            account = self._account(connection, account_id)
            if active:
                connection.execute(
                    update(users).where(users.c.id == account_id).values(deactivated_at=None)
                )
            elif account.status != "deactivated":
                if account.email == by.email:
                    raise OwnAccount
                self._ensure_another_active_admin(connection, account)
                connection.execute(
                    update(users)
                    .where(users.c.id == account_id)
                    .values(deactivated_at=self._clock.now())
                )
                connection.execute(delete(sessions).where(sessions.c.user_id == account_id))
                connection.execute(
                    delete(email_verifications).where(email_verifications.c.user_id == account_id)
                )
            return self._account(connection, account_id)

    def _new_verification_link(self, connection: Connection, user_id: int) -> str:
        """Stores a fresh link token for the account, replacing any earlier one."""
        token = secrets.token_urlsafe(32)
        connection.execute(
            delete(email_verifications).where(email_verifications.c.user_id == user_id)
        )
        connection.execute(
            insert(email_verifications).values(
                token_hash=_token_hash(token),
                user_id=user_id,
                expires_at=self._clock.now() + VERIFICATION_LINK_VALIDITY,
            )
        )
        return token

    def _send_verification_email(self, to: str, token: str) -> None:
        link = f"{self._public_url}/verify-email?token={token}"
        self._mailer.send(verification_email(to, link, VERIFICATION_LINK_VALIDITY.days))

    @staticmethod
    def _lock_accounts(connection: Connection) -> None:
        # Two Admins demoting each other at the same moment must not both succeed.
        connection.exec_driver_sql("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE")

    @staticmethod
    def _account(connection: Connection, account_id: int) -> StaffAccount:
        row = connection.execute(
            select(*_ACCOUNT_COLUMNS).where(users.c.id == account_id)
        ).one_or_none()
        if row is None:
            raise AccountNotFound
        return _to_account(row)

    @staticmethod
    def _ensure_another_active_admin(connection: Connection, account: StaffAccount) -> None:
        if account.role != "admin" or account.status != "active":
            return
        other_active_admins = connection.scalar(
            select(func.count()).where(
                users.c.role == "admin", *_IS_ACTIVE, users.c.id != account.id
            )
        )
        if not other_active_admins:
            raise LastAdmin


def _check_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordTooShort


def _password_matches(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerificationError:
        return False
