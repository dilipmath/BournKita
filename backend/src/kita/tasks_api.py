"""HTTP API for Task boards: every Staff member may see and change every Group's board. Tasks
are not Child data, so not audited."""

from dataclasses import asdict

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.children import NameRequired, TooLong
from kita.groups import GroupNotFound
from kita.identity import Identity
from kita.identity_api import staff_member_dependency
from kita.tasks import Task, TaskDetails, TaskNotFound, Tasks, TaskStatus


class TaskIn(BaseModel):
    model_config = CAMEL_CASE

    title: str
    note: str = ""

    def details(self) -> TaskDetails:
        return TaskDetails(self.title, self.note)


class TaskOut(TaskIn):
    id: int
    status: TaskStatus

    @classmethod
    def of(cls, task: Task) -> "TaskOut":
        return cls(**asdict(task))


class TaskMoveIn(BaseModel):
    model_config = CAMEL_CASE

    status: TaskStatus


_REFUSALS: Refusals = {
    NameRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "name_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
    GroupNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    TaskNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
}


def tasks_router(identity: Identity, tasks: Tasks) -> APIRouter:
    router = APIRouter(
        prefix="/api/groups/{group_id}/tasks",
        dependencies=[Depends(staff_member_dependency(identity))],
    )

    @router.get("")
    def task_board(group_id: int) -> list[TaskOut]:
        """The Group's Tasks, oldest first; each says which column it is in."""
        with refusals_as_http_errors(_REFUSALS):
            return [TaskOut.of(task) for task in tasks.of_group(group_id)]

    @router.post("", status_code=status.HTTP_201_CREATED)
    def add_task(group_id: int, task: TaskIn) -> TaskOut:
        with refusals_as_http_errors(_REFUSALS):
            return TaskOut.of(tasks.add(group_id, task.details()))

    @router.put("/{task_id}")
    def update_task(group_id: int, task_id: int, task: TaskIn) -> TaskOut:
        with refusals_as_http_errors(_REFUSALS):
            return TaskOut.of(tasks.update(group_id, task_id, task.details()))

    @router.put("/{task_id}/status", status_code=status.HTTP_204_NO_CONTENT)
    def move_task(group_id: int, task_id: int, move: TaskMoveIn) -> None:
        """Moves the Task to another column (or leaves it where it is)."""
        with refusals_as_http_errors(_REFUSALS):
            tasks.move(group_id, task_id, move.status)

    @router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
    def remove_task(group_id: int, task_id: int) -> None:
        with refusals_as_http_errors(_REFUSALS):
            tasks.remove(group_id, task_id)

    return router
