"""The archive: deleted Child profiles, kept apart from the current Children so a mistake can be
undone, until the retention period ends and they are purged."""

import calendar
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import Engine, delete, select, update

from kita.children import CURRENT, ChildNotFound, children
from kita.clock import KITA_TIME_ZONE, Clock, today
from kita.db import transaction
from kita.parents import child_parents, parents
from kita.photos import Photos


@dataclass(frozen=True)
class ArchivedChild:
    id: int
    first_name: str
    last_name: str
    archived_at: datetime
    # The Kita's day the purge removes it, with all its data.
    purge_on: date


def _months_after(day: date, months: int) -> date:
    """The same day `months` later; the month's last day if it has no such day (31 March → 30
    April)."""
    month_index = day.month - 1 + months
    year, month = day.year + month_index // 12, month_index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


class Archive:
    def __init__(self, engine: Engine, clock: Clock, photos: Photos, retention_months: int) -> None:
        self._engine = engine
        self._clock = clock
        self._photos = photos
        self._retention_months = retention_months

    def archive(self, child_id: int) -> None:
        """Moves the current Child, with all its data, to the archive; raises ChildNotFound."""
        with transaction(self._engine) as connection:
            archived = connection.scalar(
                update(children)
                .where(children.c.id == child_id, CURRENT)
                .values(archived_at=self._clock.now())
                .returning(children.c.id)
            )
        if archived is None:
            raise ChildNotFound

    def restore(self, child_id: int) -> None:
        """Makes the archived Child current again, with all its data; raises ChildNotFound."""
        with transaction(self._engine) as connection:
            restored = connection.scalar(
                update(children)
                .where(children.c.id == child_id, ~CURRENT)
                .values(archived_at=None)
                .returning(children.c.id)
            )
        if restored is None:
            raise ChildNotFound

    def archived_children(self) -> list[ArchivedChild]:
        """The archived Children, most recently archived first."""
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(
                    children.c.id,
                    children.c.first_name,
                    children.c.last_name,
                    children.c.archived_at,
                )
                .where(~CURRENT)
                .order_by(children.c.archived_at.desc(), children.c.id)
            ).all()
        return [
            ArchivedChild(
                row.id,
                row.first_name,
                row.last_name,
                row.archived_at,
                self._purge_on(row.archived_at),
            )
            for row in rows
        ]

    def purge_due(self) -> None:
        """Deletes, for good, the archived Children whose retention period has ended, with all
        their data and photos, and their Parents who have no other Child (current or
        archived) left."""
        with transaction(self._engine) as connection:
            # Locked: a restore meanwhile waits, then finds the Child gone.
            archived = connection.execute(
                select(children.c.id, children.c.archived_at).where(~CURRENT).with_for_update()
            ).all()
            due = [
                row.id for row in archived if self._purge_on(row.archived_at) <= today(self._clock)
            ]
            if not due:
                return
            # Parents of these Children who are linked to no other.
            parent_ids = list(
                connection.scalars(
                    select(child_parents.c.parent_id)
                    .where(child_parents.c.child_id.in_(due))
                    .except_(
                        select(child_parents.c.parent_id).where(
                            child_parents.c.child_id.not_in(due)
                        )
                    )
                )
            )
            leftovers = [self._photos.leftovers_of_child(child_id) for child_id in due]
            leftovers.append(self._photos.leftovers_of_parents(parent_ids))
            # Their other data goes with them (deleted in cascade).
            # Checked again as they go: a Parent linked to another Child meanwhile stays.
            linked_elsewhere = (
                select(child_parents.c.parent_id)
                .where(
                    child_parents.c.parent_id == parents.c.id,
                    child_parents.c.child_id.not_in(due),
                )
                .exists()
            )
            connection.execute(
                delete(parents).where(parents.c.id.in_(parent_ids), ~linked_elsewhere)
            )
            connection.execute(delete(children).where(children.c.id.in_(due)))
        # Only now: deleted before, a failed purge would keep records whose files are gone.
        for files in leftovers:
            self._photos.delete_files(files)

    def _purge_on(self, archived_at: datetime) -> date:
        return _months_after(archived_at.astimezone(KITA_TIME_ZONE).date(), self._retention_months)
