"""The day at the Kita in numbers: for each Group, how many of its Children are here, gone home,
absent or not here yet, and whose Birthday it is; for the whole Kita, who is still checked in,
who is in no Group, and how many Incidents there were. Counts and names only: no Alert, no
Absence reason, nothing stored encrypted."""

from dataclasses import dataclass
from datetime import date, time

from kita.alerts import Alerts
from kita.attendance import Attendance
from kita.birthdays import Birthdays
from kita.children import Children, ChildSummary
from kita.clock import KITA_TIME_ZONE, Clock
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
class LateChild:
    child: ChildSummary
    # Their Group, whose Today view to open; None: in no Group.
    group_id: int | None


@dataclass(frozen=True)
class KitaDay:
    still_checked_in: int
    without_group: list[ChildSummary]
    incidents_today: int
    closes_at: time | None
    # Still checked in after closing time; none before it, or without one.
    still_here_after_closing: list[LateChild]


class KitaOverview:
    def __init__(
        self,
        groups: Groups,
        children: Children,
        attendance: Attendance,
        alerts: Alerts,
        birthdays: Birthdays,
        incidents: Incidents,
        clock: Clock,
        closes_at: time | None,
    ) -> None:
        self._clock = clock
        self._closes_at = closes_at
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
        everyone = self._children.summaries()
        days = self._attendance.days_on(day, [child.id for child in everyone])
        return KitaDay(
            closes_at=self._closes_at,
            still_here_after_closing=self._late(
                day, everyone, {i for i, a in days.items() if a.checked_out_at is None}
            ),
            still_checked_in=sum(
                1 for attended in days.values() if attended.checked_out_at is None
            ),
            without_group=self._groups.children_without_group(),
            incidents_today=self._incidents.count_on(day),
        )

    def _late(self, day: date, everyone: list[ChildSummary], here: set[int]) -> list[LateChild]:
        """Those still here, by first name, once the Kita's closing time has passed today."""
        now = self._clock.now().astimezone(KITA_TIME_ZONE)
        if self._closes_at is None or now.date() != day or now.time() < self._closes_at or not here:
            return []
        group_of = self._groups.groups_of_children(list(here))
        return [LateChild(child, group_of.get(child.id)) for child in everyone if child.id in here]
