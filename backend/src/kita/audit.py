"""Audit: who viewed or changed which Child's data, and when. Entries are only ever added."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, get_args

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Column,
    DateTime,
    Engine,
    Integer,
    String,
    Table,
    insert,
    select,
    tuple_,
)

from kita.clock import Clock
from kita.db import metadata
from kita.identity import normalise_email

AuditAction = Literal["viewed", "created", "changed", "deleted"]

audit_log = Table(
    "audit_log",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("at", DateTime(timezone=True), nullable=False, index=True),
    # The email address rather than the account's ID: accounts are never deleted, and the
    # entry must say who it was even if the account changes later.
    Column("staff_email", String(320), nullable=False),
    Column("action", String(20), nullable=False),
    # No foreign key: the entry outlives the Child profile it is about.
    Column("child_id", Integer, nullable=False, index=True),
    # Only which fields changed, never their values: the log must not become a second copy of
    # the Children's data.
    Column("changed_fields", ARRAY(String(50)), nullable=False),
    CheckConstraint(f"action IN {get_args(AuditAction)}", name="action"),
)


@dataclass(frozen=True)
class AuditEntry:
    id: int
    at: datetime
    staff_email: str
    action: AuditAction
    child_id: int
    changed_fields: tuple[str, ...]


@dataclass(frozen=True)
class AuditFilter:
    """Which entries to show; None means any."""

    child_id: int | None = None
    staff_email: str | None = None
    action: AuditAction | None = None
    # From `since` (included) until `until` (not included).
    since: datetime | None = None
    until: datetime | None = None


class Audit:
    def __init__(self, engine: Engine, clock: Clock) -> None:
        self._engine = engine
        self._clock = clock

    def record(
        self,
        staff_email: str,
        action: AuditAction,
        child_id: int,
        changed_fields: Sequence[str] = (),
    ) -> None:
        with self._engine.begin() as connection:
            connection.execute(
                insert(audit_log).values(
                    at=self._clock.now(),
                    staff_email=staff_email,
                    action=action,
                    child_id=child_id,
                    changed_fields=list(changed_fields),
                )
            )

    def entries(
        self, matching: AuditFilter, before: int | None = None, limit: int = 100
    ) -> list[AuditEntry]:
        """The newest `limit` entries `matching` the filter; `before` continues after the entry
        with that ID, so the log can be read page by page."""
        query = (
            select(audit_log).order_by(audit_log.c.at.desc(), audit_log.c.id.desc()).limit(limit)
        )
        if matching.child_id is not None:
            query = query.where(audit_log.c.child_id == matching.child_id)
        if matching.staff_email:
            query = query.where(audit_log.c.staff_email == normalise_email(matching.staff_email))
        if matching.action is not None:
            query = query.where(audit_log.c.action == matching.action)
        if matching.since is not None:
            query = query.where(audit_log.c.at >= matching.since)
        if matching.until is not None:
            query = query.where(audit_log.c.at < matching.until)
        if before is not None:
            # Strictly older in the same order as above: earlier, or as early with a lower ID.
            previous = select(audit_log.c.at).where(audit_log.c.id == before).scalar_subquery()
            query = query.where(tuple_(audit_log.c.at, audit_log.c.id) < tuple_(previous, before))
        with self._engine.connect() as connection:
            rows = connection.execute(query).all()
        return [
            AuditEntry(**{**row._asdict(), "changed_fields": tuple(row.changed_fields)})
            for row in rows
        ]
