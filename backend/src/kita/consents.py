"""Consents: what a Child's Parents allowed, and from when to when."""

from dataclasses import dataclass
from datetime import date
from typing import Any, Literal, get_args

from sqlalchemy import (
    CheckConstraint,
    Column,
    Connection,
    Date,
    Engine,
    ForeignKey,
    Integer,
    Row,
    String,
    Table,
    insert,
    select,
    update,
)

from kita.children import ChildNotFound, children
from kita.clock import Clock, today
from kita.db import metadata, transaction

ConsentType = Literal["photo", "excursion", "dataProtection"]
CONSENT_TYPES: tuple[ConsentType, ...] = get_args(ConsentType)

# One row per period: given on a date, and withdrawn on a later one or still given.
child_consents = Table(
    "child_consents",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "child_id",
        Integer,
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("consent", String(20), nullable=False),
    Column("given_on", Date, nullable=False),
    Column("withdrawn_on", Date),
    CheckConstraint(f"consent IN {CONSENT_TYPES}", name="consent"),
)


@dataclass(frozen=True)
class ConsentPeriod:
    given_on: date
    withdrawn_on: date | None


class AlreadyGiven(Exception):
    """The Consent is given and not withdrawn; withdraw it before giving it again."""


class NotGiven(Exception):
    """The Consent is not given, so there is nothing to withdraw."""


class InFuture(Exception):
    """The date is after today at the Kita."""


class OutOfOrder(Exception):
    """The date is before the one it follows: a withdrawal before the giving, or a new
    giving before the last withdrawal."""


class Consents:
    def __init__(self, engine: Engine, clock: Clock) -> None:
        self._engine = engine
        self._clock = clock

    def of_child(self, child_id: int) -> dict[ConsentType, list[ConsentPeriod]]:
        """Every period of each Consent, oldest first; the last one is the current status."""
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(child_consents)
                .where(child_consents.c.child_id == child_id)
                .order_by(child_consents.c.given_on, child_consents.c.id)
            ).all()
        periods: dict[ConsentType, list[ConsentPeriod]] = {consent: [] for consent in CONSENT_TYPES}
        for row in rows:
            periods[row.consent].append(ConsentPeriod(row.given_on, row.withdrawn_on))
        return periods

    def give(self, child_id: int, consent: ConsentType, on: date) -> None:
        self._check_not_in_future(on)
        with transaction(self._engine) as connection:
            current = self._current(connection, child_id, consent)
            if current is not None and current.withdrawn_on is None:
                raise AlreadyGiven
            if current is not None and on < current.withdrawn_on:
                raise OutOfOrder
            connection.execute(
                insert(child_consents).values(child_id=child_id, consent=consent, given_on=on)
            )

    def withdraw(self, child_id: int, consent: ConsentType, on: date) -> None:
        self._check_not_in_future(on)
        with transaction(self._engine) as connection:
            current = self._current(connection, child_id, consent)
            if current is None or current.withdrawn_on is not None:
                raise NotGiven
            if on < current.given_on:
                raise OutOfOrder
            connection.execute(
                update(child_consents)
                .where(child_consents.c.id == current.id)
                .values(withdrawn_on=on)
            )

    def _check_not_in_future(self, on: date) -> None:
        if on > today(self._clock):
            raise InFuture

    @staticmethod
    def _current(
        connection: Connection, child_id: int, consent: ConsentType
    ) -> Row[*tuple[Any, ...]] | None:
        """The Consent's latest period, if any. Locks the Child, so that changes to its
        Consents happen one after the other."""
        locked = connection.scalar(
            select(children.c.id).where(children.c.id == child_id).with_for_update()
        )
        if locked is None:
            raise ChildNotFound
        return connection.execute(
            select(child_consents)
            .where(child_consents.c.child_id == child_id, child_consents.c.consent == consent)
            .order_by(child_consents.c.given_on.desc(), child_consents.c.id.desc())
            .limit(1)
        ).one_or_none()
