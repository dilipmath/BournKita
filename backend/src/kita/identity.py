"""Identity & access: Staff member accounts, passwords and sessions."""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Literal

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
    delete,
    insert,
    select,
    update,
)

from kita.clock import Clock
from kita.db import metadata
from kita.settings import Settings

Role = Literal["admin", "teacher"]

users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("email", String(320), nullable=False),
    Column("password_hash", String, nullable=False),
    Column("role", String(20), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
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


@dataclass(frozen=True)
class StaffMember:
    email: str
    role: Role


class AccountsAlreadyExist(Exception):
    """The first Admin can only be created while there are no accounts."""


_hasher = PasswordHasher()
# Verified against when the email is unknown, so a wrong email takes as long as a wrong password.
_DUMMY_HASH = _hasher.hash("not a real password")


def normalise_email(email: str) -> str:
    return email.strip().lower()


def _token_hash(token: str) -> str:
    # Only the hash is stored, so a database dump cannot be used to take over sessions.
    return hashlib.sha256(token.encode()).hexdigest()


class Identity:
    def __init__(self, engine: Engine, clock: Clock, inactivity_timeout: timedelta) -> None:
        self._engine = engine
        self._clock = clock
        self._inactivity_timeout = inactivity_timeout

    @classmethod
    def from_settings(cls, engine: Engine, clock: Clock, settings: Settings) -> "Identity":
        return cls(engine, clock, timedelta(minutes=settings.session_inactivity_minutes))

    @property
    def inactivity_timeout(self) -> timedelta:
        return self._inactivity_timeout

    def create_first_admin(self, email: str, password: str) -> None:
        with self._engine.begin() as connection:
            # Serialises concurrent setup runs, so two first Admins cannot slip in.
            connection.exec_driver_sql("LOCK TABLE users IN EXCLUSIVE MODE")
            if connection.scalar(select(users.c.id).limit(1)) is not None:
                raise AccountsAlreadyExist
            connection.execute(
                insert(users).values(
                    email=normalise_email(email),
                    password_hash=_hasher.hash(password),
                    role="admin",
                    created_at=self._clock.now(),
                )
            )

    def log_in(self, email: str, password: str) -> tuple[str, StaffMember] | None:
        """Returns a new session token and the Staff member, or None for wrong credentials."""
        with self._engine.begin() as connection:
            user = connection.execute(
                select(users.c.id, users.c.email, users.c.role, users.c.password_hash).where(
                    users.c.email == normalise_email(email)
                )
            ).one_or_none()
            if not _password_matches(user.password_hash if user else _DUMMY_HASH, password):
                return None
            if user is None:
                return None
            if _hasher.check_needs_rehash(user.password_hash):
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


def _password_matches(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerificationError:
        return False
