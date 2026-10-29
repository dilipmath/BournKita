"""HTTP API for Groups: every Staff member may see them, only Admins may change them."""

from datetime import date

from fastapi import APIRouter, Depends, Request, status
from fastapi.routing import APIRoute
from pydantic import BaseModel

from kita.alerts import Alert, Alerts
from kita.alerts_api import AlertOut
from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.attendance import Absence, Attendance, AttendanceDay
from kita.attendance_api import AbsenceOut, AttendanceDayOut
from kita.audit_api import (
    about_noted_children,
    not_about_one_child,
    note_changed_fields,
    note_children,
)
from kita.birthdays import Birthdays
from kita.children import ChildSummary, NameRequired, TooLong
from kita.groups import (
    Group,
    GroupDetails,
    GroupForStaffMember,
    GroupIcon,
    GroupNameTaken,
    GroupNotFound,
    Groups,
)
from kita.identity import Identity
from kita.identity_api import role_dependency, staff_member_dependency, staff_member_of


class GroupIn(BaseModel):
    model_config = CAMEL_CASE

    name: str
    icon: GroupIcon

    def details(self) -> GroupDetails:
        return GroupDetails(self.name, self.icon)


class GroupOut(GroupIn):
    id: int

    @classmethod
    def of(cls, group: Group) -> "GroupOut":
        return cls.model_validate(group)


class GroupForStaffMemberOut(GroupOut):
    # Whether the Staff member asking works in it.
    mine: bool

    @classmethod
    def of_listed(cls, group: GroupForStaffMember) -> "GroupForStaffMemberOut":
        return cls.model_validate(group)


class GroupChildOut(BaseModel):
    """One of a Group's Children today: their name and Alerts, whether they are checked in or
    absent, and whether it is their Birthday."""

    model_config = CAMEL_CASE

    id: int
    first_name: str
    last_name: str
    alerts: list[AlertOut]
    # None: not checked in today.
    attendance: AttendanceDayOut | None
    # None: not absent today.
    absence: AbsenceOut | None
    birthday_today: bool

    @classmethod
    def of(
        cls,
        child: ChildSummary,
        alerts: list[Alert],
        day: AttendanceDay | None,
        absence: Absence | None,
        birthday_today: bool,
    ) -> "GroupChildOut":
        return cls(
            id=child.id,
            first_name=child.first_name,
            last_name=child.last_name,
            alerts=[AlertOut.of(alert) for alert in alerts],
            attendance=None if day is None else AttendanceDayOut.of(day),
            absence=None if absence is None else AbsenceOut.of(absence),
            birthday_today=birthday_today,
        )


class GroupDashboardOut(GroupOut):
    """The Group dashboard, the Today view: the Group, the day at the Kita, and its Children by
    first name, each with their Alerts and how they are today."""

    day: date
    children: list[GroupChildOut]


_REFUSALS: Refusals = {
    NameRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "name_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
    GroupNameTaken: (status.HTTP_409_CONFLICT, "group_name_taken"),
    GroupNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
}


def groups_router(
    identity: Identity,
    groups: Groups,
    alerts: Alerts,
    attendance: Attendance,
    birthdays: Birthdays,
    audited_route_class: type[APIRoute],
) -> APIRouter:
    """`audited_route_class` comes from audited_route: the dashboard shows Children's Alerts, and
    removing a Group changes its Children's."""
    router = APIRouter(
        prefix="/api/groups",
        dependencies=[Depends(staff_member_dependency(identity))],
        route_class=audited_route_class,
    )
    admin_only = [Depends(role_dependency(identity, "admin"))]

    @router.get("")
    @not_about_one_child
    def list_groups(request: Request) -> list[GroupForStaffMemberOut]:
        email = staff_member_of(request).email
        return [GroupForStaffMemberOut.of_listed(group) for group in groups.for_staff_member(email)]

    @router.post("", status_code=status.HTTP_201_CREATED, dependencies=admin_only)
    @not_about_one_child
    def create_group(group: GroupIn) -> GroupOut:
        with refusals_as_http_errors(_REFUSALS):
            return GroupOut.of(groups.create(group.details()))

    @router.get("/{group_id}")
    @about_noted_children
    def group_dashboard(group_id: int, request: Request) -> GroupDashboardOut:
        with refusals_as_http_errors(_REFUSALS):
            group = groups.group(group_id)
            children = groups.children_of(group_id)
        child_ids = [child.id for child in children]
        day = attendance.today()
        its_alerts = alerts.of_children(child_ids)
        attendance_days = attendance.days_on(day, child_ids)
        absences_today = attendance.absences_on(day, child_ids)
        birthday_children = {b.child_id for b in birthdays.between(day, day, group_id)}
        # Names, Attendance and Birthdays are not logged (like the list of Children); Alerts are
        # health data, so their views are.
        note_children(request, list(its_alerts))
        return GroupDashboardOut(
            **GroupOut.of(group).model_dump(by_alias=False),
            day=day,
            children=[
                GroupChildOut.of(
                    child,
                    its_alerts.get(child.id, []),
                    attendance_days.get(child.id),
                    absences_today.get(child.id),
                    child.id in birthday_children,
                )
                for child in children
            ],
        )

    @router.put("/{group_id}", dependencies=admin_only)
    @not_about_one_child  # Renaming changes no Child's data.
    def update_group(group_id: int, group: GroupIn) -> GroupOut:
        with refusals_as_http_errors(_REFUSALS):
            return GroupOut.of(groups.update(group_id, group.details()))

    @router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=admin_only)
    @about_noted_children
    def remove_group(group_id: int, request: Request) -> None:
        with refusals_as_http_errors(_REFUSALS):
            child_ids = groups.remove(group_id)
        note_children(request, child_ids)
        note_changed_fields(request, ["group"])

    return router
