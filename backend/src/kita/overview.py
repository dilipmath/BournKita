"""The day at the Kita in numbers: for each Group, how many of its Children are here, gone home,
absent or not here yet, and whose Birthday it is; for the whole Kita, who is still checked in,
who is in no Group, and how many Incidents there were. Counts and names only: no Alert, no
Absence reason, nothing stored encrypted."""

from dataclasses import dataclass
from datetime import date

from kita.alerts import Alerts
from kita.attendance import Attendance
from kita.birthdays import Birthdays
from kita.children import Children, ChildSummary
from kita.groups import GroupForStaffMember, Groups
from kita.incidents import Incidents


@dataclass(frozen=True)
class GroupDay:
    group: GroupForStaffMember
    # All the Group's Children; the four below add up to it.
    expected: int
    here: int
    gone: int
    absent: int
    not_yet: int
    # Children with an Alert who are here now: where extra care is needed.
    alerts_here: int
    birthdays: list[ChildSummary]


@dataclass(frozen=True)
class KitaDay:
    still_checked_in: int
    without_group: list[ChildSummary]
    incidents_today: int


class KitaOverview:
    def __init__(
        self,
        groups: Groups,
        children: Children,
        attendance: Attendance,
        alerts: Alerts,
        birthdays: Birthdays,
        incidents: Incidents,
    ) -> None:
        self._groups = groups
        self._children = children
        self._attendance = attendance
        self._alerts = alerts
        self._birthdays = birthdays
        self._incidents = incidents

    def today(self) -> date:
        return self._attendance.today()

    def groups_of(self, email: str) -> list[GroupForStaffMember]:
        """Every Group: the Staff member's own first, then the others; both by name."""
        listed = self._groups.for_staff_member(email)
        return sorted(listed, key=lambda group: not group.mine)

    def own_groups(self, email: str) -> list[GroupForStaffMember]:
        """The Groups the Staff member works in, by name."""
        return [group for group in self._groups.for_staff_member(email) if group.mine]

    def group_day(self, group: GroupForStaffMember, day: date) -> GroupDay:
        children = self._groups.children_of(group.id)
        child_ids = [child.id for child in children]
        days = self._attendance.days_on(day, child_ids)
        absences = self._attendance.absences_on(day, child_ids)
        with_alerts = self._alerts.children_with_alerts(child_ids)
        here = {i for i, attended in days.items() if attended.checked_out_at is None}
        gone = {i for i, attended in days.items() if attended.checked_out_at is not None}
        birthdays = {b.child_id for b in self._birthdays.between(day, day, group.id)}
        return GroupDay(
            group=group,
            expected=len(children),
            here=len(here),
            gone=len(gone),
            absent=len(set(absences) - here - gone),
            not_yet=len(set(child_ids) - here - gone - set(absences)),
            alerts_here=len(here & with_alerts),
            birthdays=[child for child in children if child.id in birthdays],
        )

    def kita_day(self, day: date) -> KitaDay:
        everyone = [child.id for child in self._children.summaries()]
        days = self._attendance.days_on(day, everyone)
        return KitaDay(
            still_checked_in=sum(
                1 for attended in days.values() if attended.checked_out_at is None
            ),
            without_group=self._groups.children_without_group(),
            incidents_today=self._incidents.count_on(day),
        )
