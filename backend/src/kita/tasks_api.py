"""HTTP API for Task boards and Backlogs: Admins and Teachers may see and change every Group's.
Tasks are not Child data, so not audited."""

from datetime import date

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.children import NameRequired, TooLong
from kita.groups import GroupNotFound
from kita.identity import Identity
from kita.identity_api import staff_member_dependency
from kita.tasks import (
    Assignee,
    BacklogChanged,
    NotInGroup,
    Task,
    TaskDetails,
    TaskNotFound,
    Tasks,
    TaskStatus,
)


class TaskIn(BaseModel):
    model_config = CAMEL_CASE

    title: str
    note: str = ""
    # A Staff member who works in the Group, by account ID.
    assignee_id: int | None = None
    due_on: date | None = None
    labels: list[str] = []

    def details(self) -> TaskDetails:
        return TaskDetails(self.title, self.note, self.assignee_id, self.due_on, tuple(self.labels))


class AssigneeOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    email: str

    @classmethod
    def of(cls, assignee: Assignee) -> "AssigneeOut":
        return cls.model_validate(assignee)


class TaskOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    title: str
    note: str
    status: TaskStatus
    assignee: AssigneeOut | None
    due_on: date | None
    labels: list[str]

    @classmethod
    def of(cls, task: Task) -> "TaskOut":
        return cls.model_validate(task)


class TaskMoveIn(BaseModel):
    model_config = CAMEL_CASE

    status: TaskStatus


class BacklogOrderIn(BaseModel):
    """Every To do Task of the Group, by ID, most important first."""

    model_config = CAMEL_CASE

    task_ids: list[int]


_REFUSALS: Refusals = {
    NameRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "name_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
    NotInGroup: (status.HTTP_422_UNPROCESSABLE_CONTENT, "not_in_group"),
    GroupNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    TaskNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    BacklogChanged: (status.HTTP_409_CONFLICT, "backlog_changed"),
}


def tasks_router(identity: Identity, tasks: Tasks) -> APIRouter:
    router = APIRouter(
        prefix="/api/groups/{group_id}",
        dependencies=[Depends(staff_member_dependency(identity))],
    )

    @router.get("/tasks")
    def task_board(group_id: int) -> list[TaskOut]:
        """The Group's Tasks; within each column in order, so To do is in Backlog order."""
        with refusals_as_http_errors(_REFUSALS):
            return [TaskOut.of(task) for task in tasks.of_group(group_id)]

    @router.get("/assignees")
    def assignees(group_id: int) -> list[AssigneeOut]:
        """Whom the Group's Tasks can be given to: its active Staff members."""
        with refusals_as_http_errors(_REFUSALS):
            return [AssigneeOut.of(assignee) for assignee in tasks.assignable(group_id)]

    @router.post("/tasks", status_code=status.HTTP_201_CREATED)
    def add_task(group_id: int, task: TaskIn) -> TaskOut:
        with refusals_as_http_errors(_REFUSALS):
            return TaskOut.of(tasks.add(group_id, task.details()))

    @router.put("/tasks/{task_id}")
    def update_task(group_id: int, task_id: int, task: TaskIn) -> TaskOut:
        with refusals_as_http_errors(_REFUSALS):
            return TaskOut.of(tasks.update(group_id, task_id, task.details()))

    @router.put("/tasks/{task_id}/status", status_code=status.HTTP_204_NO_CONTENT)
    def move_task(group_id: int, task_id: int, move: TaskMoveIn) -> None:
        """Moves the Task to another column (or leaves it where it is)."""
        with refusals_as_http_errors(_REFUSALS):
            tasks.move(group_id, task_id, move.status)

    @router.put("/backlog", status_code=status.HTTP_204_NO_CONTENT)
    def reorder_backlog(group_id: int, order: BacklogOrderIn) -> None:
        """Puts the Backlog in this order; 409 if it no longer has exactly these Tasks."""
        with refusals_as_http_errors(_REFUSALS):
            tasks.reorder_backlog(group_id, order.task_ids)

    @router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
    def remove_task(group_id: int, task_id: int) -> None:
        with refusals_as_http_errors(_REFUSALS):
            tasks.remove(group_id, task_id)

    return router
