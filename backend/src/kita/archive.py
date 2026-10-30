"""The archive: deleted Child profiles, kept apart from the current Children so a mistake can be
undone, until the retention period ends and they are purged."""

import calendar
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import Connection, Engine, delete, select, update

from kita.children import CURRENT, ChildNotFound, children
from kita.clock import KITA_TIME_ZONE, Clock, today
from kita.db import transaction
from kita.parents import child_parents, parents
from kita.photos import LeftoverFiles, Photos


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
            leftovers = delete_for_good(connection, self._photos, due)
        # Only now: deleted before, a failed purge would keep records whose files are gone.
        self._photos.delete_files(leftovers)

    def _purge_on(self, archived_at: datetime) -> date:
        return _months_after(archived_at.astimezone(KITA_TIME_ZONE).date(), self._retention_months)


def delete_for_good(
    connection: Connection, photos: Photos, child_ids: Sequence[int], parent_ids: Sequence[int] = ()
) -> LeftoverFiles:
    """Deletes these Children for good, current or archived, with all their data, and these
    Parents and the Children's, unless linked to another Child (current or archived). Returns
    the photo files to delete once that is saved."""
    candidates = set(parent_ids) | set(
        connection.scalars(
            select(child_parents.c.parent_id).where(child_parents.c.child_id.in_(child_ids))
        )
    )
    linked_elsewhere = (
        select(child_parents.c.parent_id)
        .where(
            child_parents.c.parent_id == parents.c.id,
            child_parents.c.child_id.not_in(child_ids),
        )
        .exists()
    )
    # Locked, so none is linked to another Child before they go.
    gone_parents = list(
        connection.scalars(
            select(parents.c.id)
            .where(parents.c.id.in_(candidates), ~linked_elsewhere)
            .with_for_update()
        )
    )
    # Found before the records go.
    files = [photos.leftovers_of_child(child_id) for child_id in child_ids]
    files.append(photos.leftovers_of_parents(gone_parents))
    # Their other data goes with them (deleted in cascade).
    connection.execute(delete(parents).where(parents.c.id.in_(gone_parents)))
    connection.execute(delete(children).where(children.c.id.in_(child_ids)))
    return LeftoverFiles(tuple(name for each in files for name in each.names))
