"""Identity & access: Staff member accounts, passwords and sessions."""

import hashlib
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
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
    case,
    delete,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.exc import IntegrityError

from kita.clock import Clock
from kita.db import metadata
from kita.identity_emails import password_reset_email, verification_email
from kita.mail import Mailer, MailNotSent
from kita.settings import Settings

Role = Literal["admin", "teacher"]
# invited: email address not verified yet, so no password and no login.
AccountStatus = Literal["invited", "active", "deactivated"]

MIN_PASSWORD_LENGTH = 12
VERIFICATION_LINK_VALIDITY = timedelta(days=7)
PASSWORD_RESET_LINK_VALIDITY = timedelta(hours=1)
# This many failed logins in a row lock an account for LOCKOUT_PERIOD.
MAX_FAILED_LOGINS = 5
LOCKOUT_PERIOD = timedelta(minutes=15)
# At most one password reset email per account this often.
RESET_EMAIL_INTERVAL = timedelta(minutes=1)

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
    Column("failed_logins", Integer, nullable=False, server_default="0"),
    Column("locked_until", DateTime(timezone=True)),
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

password_resets = Table(
    "password_resets",
    metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
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


@dataclass(frozen=True)
class CreatedStaffAccount(StaffAccount):
    # False when the verification email could not be sent; an Admin can send a new link later.
    email_sent: bool


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
        Invited and deactivated accounts cannot log in. After MAX_FAILED_LOGINS failed logins
        in a row the account is locked: even the right password gives None until
        LOCKOUT_PERIOD has passed."""
        now = self._clock.now()
        with self._engine.begin() as connection:
            user = connection.execute(
                select(
                    users.c.id,
                    users.c.email,
                    users.c.role,
                    users.c.password_hash,
                    users.c.locked_until,
                )
                .where(users.c.email == normalise_email(email), *_IS_ACTIVE)
                # Parallel logins to one account take turns, so a burst of guesses cannot all
                # pass the lock check before the first failure is counted.
                .with_for_update()
            ).one_or_none()
            password_hash = user.password_hash if user and user.password_hash else _DUMMY_HASH
            # Checked even when locked or unknown: every refusal takes as long as any other.
            matches = _password_matches(password_hash, password)
            if user is None or (user.locked_until is not None and user.locked_until > now):
                return None
            if not matches:
                self._count_failed_login(connection, user.id, now)
                return None
            values: dict[str, Any] = {"failed_logins": 0, "locked_until": None}
            if _hasher.check_needs_rehash(password_hash):
                # Hashing parameters got stronger since this password was set.
                values["password_hash"] = _hasher.hash(password)
            connection.execute(update(users).where(users.c.id == user.id).values(**values))
            token = secrets.token_urlsafe(32)
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

    def staff_account(self, account_id: int) -> StaffAccount:
        with self._engine.connect() as connection:
            return self._account(connection, account_id)

    def create_staff_member(self, email: str, role: Role) -> "CreatedStaffAccount":
        """Creates an invited account and emails a link for choosing a password. If the email
        cannot be sent, the account still exists and an Admin can send a new link later."""
        email = _valid_email(email)
        try:
            with self._engine.begin() as connection:
                user_id = connection.scalar(
                    insert(users)
                    .values(email=email, role=role, created_at=self._clock.now())
                    .returning(users.c.id)
                )
                assert user_id is not None
                token = self._store_link(
                    connection, email_verifications, user_id, VERIFICATION_LINK_VALIDITY
                )
        except IntegrityError:
            # The unique email constraint, also when two Admins add the same address at once.
            raise EmailTaken from None
        try:
            self._send_verification_email(email, token)
            email_sent = True
        except MailNotSent:
            email_sent = False
        return CreatedStaffAccount(user_id, email, role, "invited", email_sent)

    def send_new_link(self, account_id: int) -> None:
        """Replaces an invited account's verification link, e.g. after it expired.
        Raises MailNotSent if the email cannot be sent."""
        with self._engine.begin() as connection:
            account = self._account(connection, account_id)
            if account.status != "invited":
                raise NotInvited
            token = self._store_link(
                connection, email_verifications, account_id, VERIFICATION_LINK_VALIDITY
            )
            # Sent before the new link is committed: if sending fails, the transaction rolls
            # back and the previous link, possibly still valid, keeps working.
            self._send_verification_email(account.email, token)

    def verify_email(self, token: str, password: str) -> bool:
        """Sets the password and verifies the email address. False for an unknown, used or
        expired link, or a deactivated account."""
        _check_password(password)
        with self._engine.begin() as connection:
            user_id = self._use_link(connection, email_verifications, token)
            if user_id is None:
                return False
            verified = connection.execute(
                update(users)
                .where(users.c.id == user_id, users.c.deactivated_at.is_(None))
                .values(password_hash=_hasher.hash(password), email_verified_at=self._clock.now())
            )
            return verified.rowcount == 1

    def request_password_reset(self, email: str) -> None:
        """Emails an active account a password reset link, replacing any earlier one. Does
        nothing for unknown emails, accounts that cannot log in, or when the last link went out
        less than RESET_EMAIL_INTERVAL ago. Raises MailNotSent if the email cannot be sent."""
        email = normalise_email(email)
        now = self._clock.now()
        with self._engine.begin() as connection:
            # Housekeeping: expired links can never be used again.
            connection.execute(delete(password_resets).where(password_resets.c.expires_at <= now))
            user_id = connection.scalar(
                select(users.c.id).where(users.c.email == email, *_IS_ACTIVE).with_for_update()
            )
            if user_id is None:
                return
            just_sent = connection.scalar(
                select(password_resets.c.user_id).where(
                    password_resets.c.user_id == user_id,
                    password_resets.c.expires_at
                    > now + PASSWORD_RESET_LINK_VALIDITY - RESET_EMAIL_INTERVAL,
                )
            )
            if just_sent is not None:
                # Repeated requests must not flood the Staff member's mailbox.
                return
            token = self._store_link(
                connection, password_resets, user_id, PASSWORD_RESET_LINK_VALIDITY
            )
            # Sent before the link is committed, so a link that never arrived is not stored.
            link = f"{self._public_url}/reset-password?token={token}"
            valid_minutes = int(PASSWORD_RESET_LINK_VALIDITY.total_seconds() // 60)
            self._mailer.send(password_reset_email(email, link, valid_minutes))

    def reset_password(self, token: str, password: str) -> bool:
        """Sets a new password from a password reset link. False for an unknown, used or
        expired link, or an account that cannot log in."""
        _check_password(password)
        with self._engine.begin() as connection:
            user_id = self._use_link(connection, password_resets, token)
            if user_id is None:
                return False
            reset = connection.execute(
                update(users)
                .where(users.c.id == user_id, *_IS_ACTIVE)
                # Also ends a Lockout: having the email account shows who this is.
                .values(password_hash=_hasher.hash(password), failed_logins=0, locked_until=None)
            )
            if reset.rowcount != 1:
                return False
            # Whoever knew the old password may still be logged in somewhere.
            connection.execute(delete(sessions).where(sessions.c.user_id == user_id))
            return True

    def change_role(self, account_id: int, role: Role) -> StaffAccount:
        with self._engine.begin() as connection:
            self._lock_accounts(connection)
            account = self._account(connection, account_id)
            if role != "admin":
                self._ensure_another_active_admin(connection, account)
            connection.execute(update(users).where(users.c.id == account_id).values(role=role))
            return self._account(connection, account_id)

    def set_active(self, account_id: int, active: bool, by: StaffMember) -> StaffAccount:
        """Deactivating ends the account's sessions and voids its verification and password
        reset links at once; its history stays. `by` is the Admin making the change."""
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
                connection.execute(
                    delete(password_resets).where(password_resets.c.user_id == account_id)
                )
            return self._account(connection, account_id)

    @staticmethod
    def _count_failed_login(connection: Connection, user_id: int, now: datetime) -> None:
        reaches_limit = users.c.failed_logins + 1 >= MAX_FAILED_LOGINS
        connection.execute(
            update(users)
            .where(users.c.id == user_id)
            .values(
                # Counting starts again once the lock is over.
                failed_logins=case((reaches_limit, 0), else_=users.c.failed_logins + 1),
                locked_until=case(
                    (reaches_limit, now + LOCKOUT_PERIOD), else_=users.c.locked_until
                ),
            )
        )

    def _store_link(
        self, connection: Connection, links: Table, user_id: int, validity: timedelta
    ) -> str:
        """Stores a fresh link token for the account in `links`, replacing any earlier one."""
        token = secrets.token_urlsafe(32)
        connection.execute(delete(links).where(links.c.user_id == user_id))
        connection.execute(
            insert(links).values(
                token_hash=_token_hash(token),
                user_id=user_id,
                expires_at=self._clock.now() + validity,
            )
        )
        return token

    def _use_link(self, connection: Connection, links: Table, token: str) -> int | None:
        """Uses up a link from `links`: the ID of its account, or None for an unknown, used or
        expired link. Deleting it in one statement means two requests cannot both use it."""
        user_id: int | None = connection.scalar(
            delete(links)
            .where(links.c.token_hash == _token_hash(token), links.c.expires_at > self._clock.now())
            .returning(links.c.user_id)
        )
        return user_id

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
