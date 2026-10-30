"""Children: Child profiles. Every Staff member may read them; only Admins may change them."""

from dataclasses import asdict, dataclass, replace
from datetime import date, datetime
from typing import Any, Literal, get_args

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Engine,
    Integer,
    Row,
    String,
    Table,
    insert,
    select,
    update,
)

from kita.clock import Clock, today
from kita.db import metadata, transaction

Gender = Literal["girl", "boy", "diverse"]

children = Table(
    "children",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("first_name", String(100), nullable=False),
    Column("last_name", String(100), nullable=False),
    Column("gender", String(20)),
    Column("languages", String(200), nullable=False),
    Column("food_preferences", String(2000), nullable=False),
    Column("interests", String(2000), nullable=False),
    # Known to the Kita, or None.
    Column("date_of_birth", Date),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    # When an Admin deleted the profile, which moved it to the archive; None for current
    # Children.
    Column("archived_at", DateTime(timezone=True), index=True),
    CheckConstraint(f"gender IN {get_args(Gender)}", name="gender"),
)

# Keeps the current Children, not the archived ones: every query for Children in current views
# uses it, so archived Children appear in none.
CURRENT = children.c.archived_at.is_(None)


@dataclass(frozen=True)
class ChildDetails:
    """What an Admin enters for a Child profile."""

    first_name: str
    last_name: str
    # None when not stated.
    gender: Gender | None
    languages: str
    food_preferences: str
    interests: str
    # None when not recorded.
    date_of_birth: date | None


@dataclass(frozen=True)
class ChildProfile(ChildDetails):
    id: int


@dataclass(frozen=True)
class ChildSummary:
    """A Child as the list shows it: the name only."""

    id: int
    first_name: str
    last_name: str


class ChildNotFound(Exception):
    """No current Child profile has this ID (an archived one is not current)."""


class NameRequired(Exception):
    """A Child profile needs a first and a last name."""


class BornInFuture(Exception):
    """A date of birth cannot be after today (at the Kita)."""


class TooLong(Exception):
    """An entry is longer than its column allows."""


_PROFILE_COLUMNS = (
    children.c.id,
    children.c.first_name,
    children.c.last_name,
    children.c.gender,
    children.c.languages,
    children.c.food_preferences,
    children.c.interests,
    children.c.date_of_birth,
)


_TEXT_FIELDS = ("first_name", "last_name", "languages", "food_preferences", "interests")


def _max_length(field: str) -> int:
    column_type = children.c[field].type
    assert isinstance(column_type, String) and column_type.length is not None
    return column_type.length


def _checked(details: ChildDetails) -> ChildDetails:
    """The details with surrounding whitespace removed, and runs of spaces in names made one
    (as the search does); raises NameRequired or TooLong."""
    texts = {field: getattr(details, field).strip() for field in _TEXT_FIELDS}
    for name in ("first_name", "last_name"):
        texts[name] = " ".join(texts[name].split())
    trimmed = replace(details, **texts)
    if not trimmed.first_name or not trimmed.last_name:
        raise NameRequired
    for field in _TEXT_FIELDS:
        if len(getattr(trimmed, field)) > _max_length(field):
            raise TooLong
    return trimmed


def _to_profile(row: Row[*tuple[Any, ...]]) -> ChildProfile:
    return ChildProfile(**row._asdict())


class Children:
    def __init__(self, engine: Engine, clock: Clock) -> None:
        self._engine = engine
        self._clock = clock

    def _checked(self, details: ChildDetails) -> ChildDetails:
        """As _checked, and raises BornInFuture for a date of birth after today."""
        details = _checked(details)
        if details.date_of_birth is not None and details.date_of_birth > today(self._clock):
            raise BornInFuture
        return details

    def create(self, details: ChildDetails) -> ChildProfile:
        details = self._checked(details)
        now = self._clock.now()
        with transaction(self._engine) as connection:
            child_id = connection.scalar(
                insert(children)
                .values(**asdict(details), created_at=now, updated_at=now)
                .returning(children.c.id)
            )
        assert child_id is not None
        return ChildProfile(id=child_id, **asdict(details))

    def summaries(self, search: str = "") -> list[ChildSummary]:
        """All Children, by first name. `search` keeps those whose first, last or full name
        contains it, ignoring case."""
        query = (
            select(children.c.id, children.c.first_name, children.c.last_name)
            .where(CURRENT)
            .order_by(children.c.first_name, children.c.last_name, children.c.id)
        )
        search = " ".join(search.split())
        if search:
            # Either order, since staff may type "Müller Lena" as well as "Lena Müller".
            first_last = children.c.first_name + " " + children.c.last_name
            last_first = children.c.last_name + " " + children.c.first_name
            query = query.where(
                first_last.icontains(search, autoescape=True)
                | last_first.icontains(search, autoescape=True)
            )
        with transaction(self._engine) as connection:
            rows = connection.execute(query).all()
        return [ChildSummary(**row._asdict()) for row in rows]

    def names(self, child_ids: set[int]) -> dict[int, str]:
        """The full names of those of these Children whose profiles still exist, current or
        archived."""
        if not child_ids:
            return {}
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(children.c.id, children.c.first_name, children.c.last_name).where(
                    children.c.id.in_(child_ids)
                )
            ).all()
        return {row.id: f"{row.first_name} {row.last_name}" for row in rows}

    def profile(self, child_id: int) -> ChildProfile:
        with transaction(self._engine) as connection:
            row = connection.execute(
                select(*_PROFILE_COLUMNS).where(children.c.id == child_id, CURRENT)
            ).one_or_none()
        if row is None:
            raise ChildNotFound
        return _to_profile(row)

    def held_profile(self, child_id: int) -> tuple[ChildProfile, datetime | None]:
        """The profile, current or archived, with when it was archived (None: current); for a
        data-subject request. Raises ChildNotFound."""
        with transaction(self._engine) as connection:
            row = connection.execute(
                select(*_PROFILE_COLUMNS, children.c.archived_at).where(children.c.id == child_id)
            ).one_or_none()
        if row is None:
            raise ChildNotFound
        values = row._asdict()
        archived_at = values.pop("archived_at")
        return ChildProfile(**values), archived_at

    def ensure_current(self, child_id: int) -> None:
        """Raises ChildNotFound unless the Child is current (not archived)."""
        with transaction(self._engine) as connection:
            found = connection.scalar(
                select(children.c.id).where(children.c.id == child_id, CURRENT)
            )
        if found is None:
            raise ChildNotFound

    def update(self, child_id: int, details: ChildDetails) -> tuple[ChildProfile, list[str]]:
        """Changes the profile; returns it with the names of the fields that changed."""
        details = self._checked(details)
        with transaction(self._engine) as connection:
            row = connection.execute(
                select(*_PROFILE_COLUMNS)
                .where(children.c.id == child_id, CURRENT)
                .with_for_update()
            ).one_or_none()
            if row is None:
                raise ChildNotFound
            before = asdict(_to_profile(row))
            changed = [field for field, value in asdict(details).items() if before[field] != value]
            connection.execute(
                update(children)
                .where(children.c.id == child_id)
                .values(**asdict(details), updated_at=self._clock.now())
            )
        return ChildProfile(id=child_id, **asdict(details)), changed
