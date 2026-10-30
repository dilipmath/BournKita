"""Tasks: the work a Group's team keeps on its Task board, each in one column (To do, Doing or
Done). The To do Tasks are the Group's Backlog, in an order its Staff choose: the first is the
most important. Admins and Teachers may work on every Group's board."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal, get_args

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Column,
    Connection,
    Date,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    Row,
    String,
    Table,
    delete,
    func,
    insert,
    select,
    update,
)

from kita.children import NameRequired, TooLong
from kita.clock import Clock
from kita.db import metadata, transaction
from kita.groups import GroupNotFound, group_staff, groups
from kita.identity import users

# The Task board's columns, in order.
TaskStatus = Literal["toDo", "doing", "done"]

_MAX_TITLE_LENGTH = 200
_MAX_NOTE_LENGTH = 2000
_MAX_LABEL_LENGTH = 30
_MAX_LABELS = 5

tasks = Table(
    "tasks",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "group_id",
        Integer,
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("title", String(_MAX_TITLE_LENGTH), nullable=False),
    Column("note", String(_MAX_NOTE_LENGTH), nullable=False),
    Column("status", String(10), nullable=False),
    # Orders the Group's Tasks; among the To do ones, it is their place in the Backlog.
    Column("position", Integer, nullable=False),
    Column("assignee_id", Integer, ForeignKey("users.id", ondelete="SET NULL")),
    Column("due_on", Date),
    Column("labels", ARRAY(String(_MAX_LABEL_LENGTH)), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    CheckConstraint(f"status IN {get_args(TaskStatus)}", name="status"),
)


@dataclass(frozen=True)
class TaskDetails:
    """What a Staff member enters for a Task: a title and, optionally, a note, who does it (a
    Staff member of the Group), when it is due and a few labels (e.g. "Garden")."""

    title: str
    note: str
    assignee_id: int | None = None
    due_on: date | None = None
    labels: tuple[str, ...] = ()


@dataclass(frozen=True)
class Assignee:
    """A Staff member a Task can be given to, by their Staff account."""

    id: int
    email: str


@dataclass(frozen=True)
class Task:
    id: int
    title: str
    note: str
    status: TaskStatus
    assignee: Assignee | None
    due_on: date | None
    labels: tuple[str, ...]


class TaskNotFound(Exception):
    """The Group's board has no Task with this ID."""


class NotInGroup(Exception):
    """A Task can be given only to an active Staff member who works in its Group."""


class BacklogChanged(Exception):
    """The order given is not of exactly the Backlog's Tasks, e.g. because someone else just
    added or moved one."""


def _checked_labels(labels: Sequence[str]) -> tuple[str, ...]:
    """Trimmed, blanks left out, each once (ignoring case, keeping the first spelling)."""
    kept: dict[str, str] = {}
    for label in labels:
        label = " ".join(label.split())
        if label:
            kept.setdefault(label.casefold(), label)
    if len(kept) > _MAX_LABELS or any(len(label) > _MAX_LABEL_LENGTH for label in kept.values()):
        raise TooLong
    return tuple(kept.values())


def _checked(details: TaskDetails) -> TaskDetails:
    title = " ".join(details.title.split())
    note = details.note.strip()
    if not title:
        raise NameRequired
    if len(title) > _MAX_TITLE_LENGTH or len(note) > _MAX_NOTE_LENGTH:
        raise TooLong
    return TaskDetails(
        title, note, details.assignee_id, details.due_on, _checked_labels(details.labels)
    )


def _assignable_in(group_id: int) -> Any:
    """The active Staff members who work in the Group: whom its Tasks can be given to. Not
    Guests, who only read the Calendar."""
    return (
        select(users.c.id, users.c.email)
        .join(group_staff, group_staff.c.user_id == users.c.id)
        .where(
            group_staff.c.group_id == group_id,
            users.c.deactivated_at.is_(None),
            users.c.role != "guest",
        )
    )


def _lock_group(connection: Connection, group_id: int) -> None:
    """Raises GroupNotFound; the Group cannot be removed until the transaction ends."""
    found = connection.scalar(
        select(groups.c.id).where(groups.c.id == group_id).with_for_update(read=True)
    )
    if found is None:
        raise GroupNotFound


def _check_assignee(connection: Connection, group_id: int, details: TaskDetails) -> None:
    if details.assignee_id is None:
        return
    found = connection.execute(
        _assignable_in(group_id).where(users.c.id == details.assignee_id)
    ).one_or_none()
    if found is None:
        raise NotInGroup


def _next_position(connection: Connection, group_id: int) -> int:
    """After every Task of the Group: the end of the Backlog."""
    last = connection.scalar(select(func.max(tasks.c.position)).where(tasks.c.group_id == group_id))
    return (last or 0) + 1


def _task_query() -> Any:
    return select(tasks, users.c.email).outerjoin(users, users.c.id == tasks.c.assignee_id)


def _to_task(row: Row[Any]) -> Task:
    assignee = None if row.assignee_id is None else Assignee(row.assignee_id, row.email)
    return Task(row.id, row.title, row.note, row.status, assignee, row.due_on, tuple(row.labels))


def _values(details: TaskDetails) -> dict[str, Any]:
    return {
        "title": details.title,
        "note": details.note,
        "assignee_id": details.assignee_id,
        "due_on": details.due_on,
        "labels": list(details.labels),
    }


def _task(connection: Connection, task_id: int) -> Task:
    return _to_task(connection.execute(_task_query().where(tasks.c.id == task_id)).one())


class Tasks:
    def __init__(self, engine: Engine, clock: Clock) -> None:
        self._engine = engine
        self._clock = clock

    def of_group(self, group_id: int) -> list[Task]:
        """The Group's Tasks in their order, so the To do ones are in Backlog order."""
        with transaction(self._engine) as connection:
            _lock_group(connection, group_id)
            rows = connection.execute(
                _task_query()
                .where(tasks.c.group_id == group_id)
                .order_by(tasks.c.position, tasks.c.id)
            ).all()
        return [_to_task(row) for row in rows]

    def assignable(self, group_id: int) -> list[Assignee]:
        """Whom the Group's Tasks can be given to, by email address."""
        with transaction(self._engine) as connection:
            _lock_group(connection, group_id)
            rows = connection.execute(_assignable_in(group_id).order_by(users.c.email)).all()
        return [Assignee(row.id, row.email) for row in rows]

    def add(self, group_id: int, details: TaskDetails) -> Task:
        """Adds the Task to the Group's board, in To do, at the end of the Backlog."""
        details = _checked(details)
        with transaction(self._engine) as connection:
            _lock_group(connection, group_id)
            _check_assignee(connection, group_id, details)
            task_id = connection.scalar(
                insert(tasks)
                .values(
                    group_id=group_id,
                    status="toDo",
                    position=_next_position(connection, group_id),
                    created_at=self._clock.now(),
                    **_values(details),
                )
                .returning(tasks.c.id)
            )
            assert task_id is not None
            return _task(connection, task_id)

    def update(self, group_id: int, task_id: int, details: TaskDetails) -> Task:
        """Changes what the Task says; it stays in its column and place. An Assignee who has
        since left the Group (or was deactivated) stays until the change gives it to someone else,
        so the rest of the Task can still be changed."""
        details = _checked(details)
        with transaction(self._engine) as connection:
            before = connection.execute(
                select(tasks.c.assignee_id)
                .where(tasks.c.id == task_id, tasks.c.group_id == group_id)
                .with_for_update()
            ).one_or_none()
            if before is None:
                raise TaskNotFound
            if details.assignee_id != before.assignee_id:
                _check_assignee(connection, group_id, details)
            connection.execute(
                update(tasks).where(tasks.c.id == task_id).values(**_values(details))
            )
            return _task(connection, task_id)

    def move(self, group_id: int, task_id: int, status: TaskStatus) -> None:
        """Moves the Task to the column; moved back to To do, it goes to the end of the
        Backlog."""
        with transaction(self._engine) as connection:
            before = connection.scalar(
                select(tasks.c.status)
                .where(tasks.c.id == task_id, tasks.c.group_id == group_id)
                .with_for_update()
            )
            if before is None:
                raise TaskNotFound
            if before == status:
                return
            changes: dict[str, Any] = {"status": status}
            if status == "toDo":
                changes["position"] = _next_position(connection, group_id)
            connection.execute(update(tasks).where(tasks.c.id == task_id).values(**changes))

    def reorder_backlog(self, group_id: int, task_ids: Sequence[int]) -> None:
        """Puts the Backlog (the To do Tasks) in this order, most important first. Raises
        BacklogChanged unless `task_ids` are exactly the Backlog's Tasks."""
        with transaction(self._engine) as connection:
            _lock_group(connection, group_id)
            backlog = set(
                connection.scalars(
                    select(tasks.c.id)
                    .where(tasks.c.group_id == group_id, tasks.c.status == "toDo")
                    .with_for_update()
                )
            )
            if len(task_ids) != len(backlog) or set(task_ids) != backlog:
                raise BacklogChanged
            # Each column is in order by itself, so the other columns' positions need not move.
            for position, task_id in enumerate(task_ids, start=1):
                connection.execute(
                    update(tasks).where(tasks.c.id == task_id).values(position=position)
                )

    def remove(self, group_id: int, task_id: int) -> None:
        with transaction(self._engine) as connection:
            found = connection.scalar(
                delete(tasks)
                .where(tasks.c.id == task_id, tasks.c.group_id == group_id)
                .returning(tasks.c.id)
            )
        if found is None:
            raise TaskNotFound
