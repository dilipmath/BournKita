"""Data-subject requests: everything the Kita holds about a Parent and their Children, exported
for a data-access request, or deleted for good on request."""

import json
import zipfile
from dataclasses import asdict, dataclass, is_dataclass
from datetime import date, datetime, time
from io import BytesIO
from typing import Any

from pydantic.alias_generators import to_camel
from sqlalchemy import Engine, select

from kita.alerts import Alerts
from kita.archive import delete_for_good
from kita.attendance import Attendance
from kita.children import Children
from kita.clock import Clock
from kita.consents import Consents
from kita.contacts import Contacts
from kita.db import transaction
from kita.groups import Groups
from kita.incidents import Incidents
from kita.parents import ParentNotFound, Parents, child_parents, parents
from kita.photos import LeftoverFiles, Photos


@dataclass(frozen=True)
class HeldData:
    """The modules holding a Child's or Parent's data."""

    children: Children
    parents: Parents
    contacts: Contacts
    alerts: Alerts
    consents: Consents
    photos: Photos
    attendance: Attendance
    incidents: Incidents
    groups: Groups


def _camel(value: Any) -> Any:
    """The value as JSON-ready data, keys in camelCase as the API names them."""
    if is_dataclass(value) and not isinstance(value, type):
        value = asdict(value)
    if isinstance(value, dict):
        return {to_camel(str(key)): _camel(each) for key, each in value.items()}
    if isinstance(value, list | tuple):
        return [_camel(each) for each in value]
    if isinstance(value, datetime):
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, date | time):
        return value.isoformat()
    return value


class _Export:
    """One export being put together: data.json and the photo files it names."""

    def __init__(self, held: HeldData) -> None:
        self._held = held
        # Photo files by their name in the ZIP.
        self.files: dict[str, bytes] = {}

    def photo(self, name: str, photo_id: int | None) -> str | None:
        """Adds the photo's file, if there is a photo; returns its name in the ZIP."""
        if photo_id is None:
            return None
        path = f"photos/{name}.jpg"
        self.files[path] = self._held.photos.held_file(photo_id)
        return path

    def child(self, child_id: int) -> dict[str, Any]:
        held = self._held
        profile, archived_at = held.children.held_profile(child_id)
        group = held.groups.of_child(child_id)
        contacts = held.contacts.of_child(child_id)
        contact_photos = held.photos.photos_of_contacts([contact.id for contact in contacts])
        return {
            **asdict(profile),
            "archived_at": archived_at,
            "group": None if group is None else group.name,
            "parents": [
                {**asdict(linked.parent), "may_pick_up": linked.may_pick_up}
                for linked in held.parents.of_child(child_id)
            ],
            "contacts": [
                {
                    **asdict(contact),
                    "photo": self.photo(f"contact-{contact.id}", contact_photos.get(contact.id)),
                }
                for contact in contacts
            ],
            "alerts": held.alerts.of_child(child_id),
            "consents": held.consents.of_child(child_id),
            "photos": [
                {**asdict(photo), "file": self.photo(f"child-{photo.id}", photo.id)}
                for photo in held.photos.held_of_child(child_id)
            ],
            "attendance": [
                {"on": on, **asdict(day)} for on, day in held.attendance.held_days(child_id).items()
            ],
            "absences": held.attendance.held_absences(child_id),
            "incidents": [
                {
                    key: value
                    for key, value in asdict(incident).items()
                    # The Child is the one it is listed under.
                    if key != "child"
                }
                for incident in held.incidents.held_of_child(child_id)
            ],
        }


@dataclass(frozen=True)
class Exported:
    zip_file: bytes
    # The Children in it, current and archived.
    child_ids: list[int]


@dataclass(frozen=True)
class Deleted:
    child_ids: list[int]
    # Delete them (`Photos.delete_files`) only once the deletion is saved.
    photo_files: LeftoverFiles


class DataRequests:
    def __init__(self, engine: Engine, clock: Clock, held: HeldData) -> None:
        self._engine = engine
        self._clock = clock
        self._held = held

    def export(self, parent_id: int) -> Exported:
        """A ZIP file: data.json with the Parent and each of their Children (current and
        archived) with all their data, and the photo files it names. Raises ParentNotFound, or
        ChildNotFound if a Child is deleted meanwhile."""
        parent = self._held.parents.parent(parent_id).parent
        child_ids = self._held.parents.all_child_ids(parent_id)
        export = _Export(self._held)
        parent_photo = self._held.photos.photos_of_parents([parent_id]).get(parent_id)
        data = {
            "exported_at": self._clock.now(),
            "parent": {
                **asdict(parent),
                "photo": export.photo(f"parent-{parent_id}", parent_photo),
            },
            "children": [export.child(child_id) for child_id in child_ids],
        }
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("data.json", json.dumps(_camel(data), ensure_ascii=False, indent=2))
            for name, file in export.files.items():
                archive.writestr(name, file)
        return Exported(buffer.getvalue(), child_ids)

    def delete_permanently(self, parent_id: int) -> Deleted:
        """Deletes for good the Parent and each of their Children (current and archived) with
        all their data and photo files, and the Children's other Parents who are left with no
        Child. Raises ParentNotFound."""
        with transaction(self._engine) as connection:
            # Locked, so no Child is linked to them meanwhile.
            found = connection.scalar(
                select(parents.c.id).where(parents.c.id == parent_id).with_for_update()
            )
            if found is None:
                raise ParentNotFound
            child_ids = list(
                connection.scalars(
                    select(child_parents.c.child_id).where(child_parents.c.parent_id == parent_id)
                )
            )
            leftovers = delete_for_good(connection, self._held.photos, child_ids, [parent_id])
        return Deleted(child_ids, leftovers)
