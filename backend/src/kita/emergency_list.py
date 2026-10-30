"""The emergency list: the Children at the Kita right now, with their Alerts and whom to call,
for one Group or the whole Kita. Staff print it for an evacuation, or to have it on paper when
the system or the power is down."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from kita.alerts import Alert, Alerts
from kita.attendance import Attendance
from kita.children import Children, ChildSummary
from kita.clock import KITA_TIME_ZONE, Clock
from kita.contacts import Contacts
from kita.groups import Group, Groups
from kita.parents import Parents

# A Parent, or one of the Child's Emergency contacts.
CallerKind = Literal["parent", "emergency"]


@dataclass(frozen=True)
class Caller:
    """Someone to call about a Child."""

    kind: CallerKind
    name: str
    # As the Admin recorded it (e.g. "Grandmother"); empty for Parents.
    relationship: str
    phone: str


@dataclass(frozen=True)
class PresentChild:
    """A Child checked in and not yet checked out."""

    id: int
    first_name: str
    last_name: str
    checked_in_at: datetime
    alerts: list[Alert]
    # Parents first, then the Emergency contacts, each in their own order.
    callers: list[Caller]


@dataclass(frozen=True)
class GroupOnList:
    # None: the Children in no Group.
    group: Group | None
    # By first name.
    children: list[PresentChild]


@dataclass(frozen=True)
class EmergencyList:
    made_at: datetime
    # None: the whole Kita.
    group: Group | None
    # One per Group: for the whole Kita, every Group by name (those with nobody here too), then
    # the Children in no Group if any are here.
    groups: list[GroupOnList]

    @property
    def day(self) -> date:
        """The Kita's day the list was made on."""
        return _day(self.made_at)

    @property
    def child_ids(self) -> list[int]:
        return [child.id for each in self.groups for child in each.children]


class EmergencyLists:
    def __init__(
        self,
        clock: Clock,
        children: Children,
        groups: Groups,
        attendance: Attendance,
        alerts: Alerts,
        parents: Parents,
        contacts: Contacts,
    ) -> None:
        self._clock = clock
        self._children = children
        self._groups = groups
        self._attendance = attendance
        self._alerts = alerts
        self._parents = parents
        self._contacts = contacts

    def of_group(self, group_id: int) -> EmergencyList:
        """Raises GroupNotFound."""
        made_at = self._clock.now()
        group = self._groups.group(group_id)
        on_list = self._group_on_list(_day(made_at), group, self._groups.children_of(group_id))
        return EmergencyList(made_at, group, [on_list])

    def of_kita(self) -> EmergencyList:
        made_at = self._clock.now()
        day = _day(made_at)
        on_list = []
        grouped: set[int] = set()
        for group in self._groups.all():
            children = self._groups.children_of(group.id)
            grouped.update(child.id for child in children)
            on_list.append(self._group_on_list(day, group, children))
        in_no_group = self._group_on_list(
            day, None, [child for child in self._children.summaries() if child.id not in grouped]
        )
        if in_no_group.children:
            on_list.append(in_no_group)
        return EmergencyList(made_at, None, on_list)

    def _group_on_list(
        self, day: date, group: Group | None, children: Sequence[ChildSummary]
    ) -> GroupOnList:
        days = self._attendance.days_on(day, [child.id for child in children])
        here = [c for c in children if c.id in days and days[c.id].checked_out_at is None]
        alerts = self._alerts.of_children([child.id for child in here])
        return GroupOnList(
            group,
            [
                PresentChild(
                    child.id,
                    child.first_name,
                    child.last_name,
                    days[child.id].checked_in_at,
                    alerts.get(child.id, []),
                    self._callers(child.id),
                )
                for child in here
            ],
        )

    def _callers(self, child_id: int) -> list[Caller]:
        parents = [
            Caller("parent", f"{p.parent.first_name} {p.parent.last_name}", "", p.parent.phone)
            for p in self._parents.of_child(child_id)
        ]
        contacts = [
            Caller("emergency", contact.name, contact.relationship, contact.phone)
            for contact in self._contacts.of_child(child_id)
            if contact.kind == "emergency"
        ]
        return parents + contacts


def _day(at: datetime) -> date:
    """The Kita's day of that moment."""
    return at.astimezone(KITA_TIME_ZONE).date()
