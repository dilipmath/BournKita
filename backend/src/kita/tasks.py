"""Tasks: the work a Group's team keeps on its Task board, each in one column (To do, Doing or
Done). Every Staff member may work on every Group's board."""

from dataclasses import dataclass
from typing import Literal, get_args

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    String,
    Table,
    delete,
    insert,
    select,
    update,
)

from kita.children import NameRequired, TooLong
from kita.clock import Clock
from kita.db import metadata, transaction
from kita.groups import GroupNotFound, groups

# The Task board's columns, in order.
TaskStatus = Literal["toDo", "doing", "done"]

_MAX_TITLE_LENGTH = 200
_MAX_NOTE_LENGTH = 2000

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
    Column("created_at", DateTime(timezone=True), nullable=False),
    CheckConstraint(f"status IN {get_args(TaskStatus)}", name="status"),
)


@dataclass(frozen=True)
class TaskDetails:
    """What a Staff member enters for a Task: a title and, optionally, a note."""

    title: str
    note: str


@dataclass(frozen=True)
class Task(TaskDetails):
    id: int
    status: TaskStatus


class TaskNotFound(Exception):
    """The Group's board has no Task with this ID."""


def _checked(details: TaskDetails) -> TaskDetails:
    title = " ".join(details.title.split())
    note = details.note.strip()
    if not title:
        raise NameRequired
    if len(title) > _MAX_TITLE_LENGTH or len(note) > _MAX_NOTE_LENGTH:
        raise TooLong
    return TaskDetails(title, note)


class Tasks:
    def __init__(self, engine: Engine, clock: Clock) -> None:
        self._engine = engine
        self._clock = clock

    def of_group(self, group_id: int) -> list[Task]:
        """The Group's Tasks, oldest first."""
        with transaction(self._engine) as connection:
            if connection.scalar(select(groups.c.id).where(groups.c.id == group_id)) is None:
                raise GroupNotFound
            rows = connection.execute(
                select(tasks.c.id, tasks.c.title, tasks.c.note, tasks.c.status)
                .where(tasks.c.group_id == group_id)
                .order_by(tasks.c.created_at, tasks.c.id)
            ).all()
        return [Task(row.title, row.note, row.id, row.status) for row in rows]

    def add(self, group_id: int, details: TaskDetails) -> Task:
        """Adds the Task to the Group's board, in To do."""
        details = _checked(details)
        now = self._clock.now()
        with transaction(self._engine) as connection:
            found = connection.scalar(
                select(groups.c.id).where(groups.c.id == group_id).with_for_update(read=True)
            )
            if found is None:
                raise GroupNotFound
            task_id = connection.scalar(
                insert(tasks)
                .values(
                    group_id=group_id,
                    title=details.title,
                    note=details.note,
                    status="toDo",
                    created_at=now,
                )
                .returning(tasks.c.id)
            )
        assert task_id is not None
        return Task(details.title, details.note, task_id, "toDo")

    def update(self, group_id: int, task_id: int, details: TaskDetails) -> Task:
        """Changes the Task's title and note; it stays in its column."""
        details = _checked(details)
        with transaction(self._engine) as connection:
            its_status = connection.scalar(
                update(tasks)
                .where(tasks.c.id == task_id, tasks.c.group_id == group_id)
                .values(title=details.title, note=details.note)
                .returning(tasks.c.status)
            )
        if its_status is None:
            raise TaskNotFound
        return Task(details.title, details.note, task_id, its_status)

    def move(self, group_id: int, task_id: int, status: TaskStatus) -> None:
        """Moves the Task to the column."""
        with transaction(self._engine) as connection:
            found = connection.scalar(
                update(tasks)
                .where(tasks.c.id == task_id, tasks.c.group_id == group_id)
                .values(status=status)
                .returning(tasks.c.id)
            )
        if found is None:
            raise TaskNotFound

    def remove(self, group_id: int, task_id: int) -> None:
        with transaction(self._engine) as connection:
            found = connection.scalar(
                delete(tasks)
                .where(tasks.c.id == task_id, tasks.c.group_id == group_id)
                .returning(tasks.c.id)
            )
        if found is None:
            raise TaskNotFound
