"""HTTP API for the start pages: the Kita overview of Admins, and a Staff member's own Groups."""

from datetime import date

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE
from kita.children_api import ChildSummaryOut
from kita.identity import Identity
from kita.identity_api import role_dependency, staff_member_dependency, staff_member_of
from kita.overview import GroupDay, KitaDay, KitaOverview


class GroupDayOut(BaseModel):
    model_config = CAMEL_CASE

    id: int
    name: str
    icon: str
    mine: bool
    expected: int
    here: int
    gone: int
    absent: int
    not_yet: int
    alerts_here: int
    birthdays: list[ChildSummaryOut]

    @classmethod
    def of(cls, day: GroupDay) -> "GroupDayOut":
        return cls(
            id=day.group.id,
            name=day.group.name,
            icon=day.group.icon,
            mine=day.group.mine,
            expected=day.expected,
            here=day.here,
            gone=day.gone,
            absent=day.absent,
            not_yet=day.not_yet,
            alerts_here=day.alerts_here,
            birthdays=[ChildSummaryOut.of(child) for child in day.birthdays],
        )


class KitaDayOut(BaseModel):
    model_config = CAMEL_CASE

    still_checked_in: int
    without_group: list[ChildSummaryOut]
    incidents_today: int

    @classmethod
    def of(cls, day: KitaDay) -> "KitaDayOut":
        return cls(
            still_checked_in=day.still_checked_in,
            without_group=[ChildSummaryOut.of(child) for child in day.without_group],
            incidents_today=day.incidents_today,
        )


class OwnGroupsOut(BaseModel):
    day: date
    groups: list[GroupDayOut]


class OverviewOut(BaseModel):
    day: date
    groups: list[GroupDayOut]
    kita: KitaDayOut


def overview_router(identity: Identity, overview: KitaOverview) -> APIRouter:
    router = APIRouter(prefix="/api/overview")

    @router.get("", dependencies=[Depends(role_dependency(identity, "admin"))])
    def kita_overview(request: Request) -> OverviewOut:
        """Today at the whole Kita: each Group's day, the Admin's own Groups first."""
        day = overview.today()
        email = staff_member_of(request).email
        return OverviewOut(
            day=day,
            groups=[
                GroupDayOut.of(overview.group_day(group, day))
                for group in overview.groups_of(email)
            ],
            kita=KitaDayOut.of(overview.kita_day(day)),
        )

    @router.get("/mine", dependencies=[Depends(staff_member_dependency(identity))])
    def own_groups(request: Request) -> OwnGroupsOut:
        """Today in the Groups the Staff member works in: a Teacher's start page."""
        day = overview.today()
        email = staff_member_of(request).email
        return OwnGroupsOut(
            day=day,
            groups=[
                GroupDayOut.of(overview.group_day(group, day))
                for group in overview.own_groups(email)
            ],
        )

    return router
