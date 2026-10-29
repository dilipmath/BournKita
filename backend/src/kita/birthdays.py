"""Birthdays: worked out from Child profiles for a span of days, never stored as Events."""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import Engine, select

from kita.children import children
from kita.db import transaction
from kita.groups import child_groups


@dataclass(frozen=True)
class Birthday:
    """A Child's Birthday in a span: who, and the day. The year of birth is not shown."""

    child_id: int
    first_name: str
    last_name: str
    on: date


def _birthday_in(year: int, born: date) -> date:
    # Born on 29 February: the 28th in other years.
    if born.month == 2 and born.day == 29:
        try:
            return date(year, 2, 29)
        except ValueError:
            return date(year, 2, 28)
    return date(year, born.month, born.day)


class Birthdays:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def between(self, first: date, last: date, group_id: int | None) -> list[Birthday]:
        """The Birthdays from `first` to `last` (both included), by day: of the Group's Children,
        or with no Group, of every Child whose date of birth is recorded."""
        query = select(
            children.c.id, children.c.first_name, children.c.last_name, children.c.date_of_birth
        ).where(children.c.date_of_birth.is_not(None))
        if group_id is not None:
            query = query.join(child_groups, child_groups.c.child_id == children.c.id).where(
                child_groups.c.group_id == group_id
            )
        with transaction(self._engine) as connection:
            rows = connection.execute(query).all()
        found = [
            Birthday(row.id, row.first_name, row.last_name, day)
            for row in rows
            for year in range(first.year, last.year + 1)
            # From the first Birthday on.
            if year > row.date_of_birth.year
            and first <= (day := _birthday_in(year, row.date_of_birth)) <= last
        ]
        return sorted(
            found, key=lambda birthday: (birthday.on, birthday.first_name, birthday.child_id)
        )
