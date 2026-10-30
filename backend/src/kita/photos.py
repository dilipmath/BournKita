"""Photos: of Children, for their gallery, and one of each Pick-up person (recorded ones and
Parents), to check at pick-up. A Child's photos are shown only while their photo Consent is
given; Pick-up persons' are not up to it. Files are kept encrypted in a FileStore, and their metadata in the
database."""

import io
import os
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal, Protocol

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import (
    CheckConstraint,
    Column,
    Connection,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    Table,
    delete,
    insert,
    select,
)

from kita.children import ChildNotFound, children
from kita.clock import Clock
from kita.consents import Consents
from kita.contacts import ContactNotFound, child_contacts
from kita.db import metadata, transaction
from kita.encryption import FieldCipher
from kita.parents import ParentNotFound, parents

# thumbnail: for galleries and lists, small enough to load quickly on a tablet.
# full: for looking at one photo.
PhotoSize = Literal["thumbnail", "full"]
_LONGEST_SIDE: dict[PhotoSize, int] = {"thumbnail": 320, "full": 2048}
# Larger than a tablet or phone camera's photos.
MAX_UPLOAD_BYTES = 20_000_000
# Also larger than a camera's, and small enough to decode safely: a few kilobytes can claim far
# more, to exhaust the server's memory.
MAX_PIXELS = 50_000_000


class FileNotStored(Exception):
    """The FileStore has no file by this name."""


class FileStore(Protocol):
    """Where photo files are kept, by name."""

    def put(self, name: str, data: bytes) -> None: ...

    def get(self, name: str) -> bytes: ...

    def delete(self, name: str) -> None:
        """Deletes the file, if there is one."""
        ...


class DiskFileStore:
    """Keeps files in a folder, e.g. on the Kita's network drive."""

    def __init__(self, folder: Path) -> None:
        self._folder = folder

    def put(self, name: str, data: bytes) -> None:
        self._folder.mkdir(parents=True, exist_ok=True)
        # Written aside and then moved, so a crash never leaves half a file under the name.
        partial = self._folder / f"{name}.partial"
        partial.write_bytes(data)
        os.replace(partial, self._folder / name)

    def get(self, name: str) -> bytes:
        try:
            return (self._folder / name).read_bytes()
        except FileNotFoundError:
            raise FileNotStored(name) from None

    def delete(self, name: str) -> None:
        (self._folder / name).unlink(missing_ok=True)


photos = Table(
    "photos",
    metadata,
    Column("id", Integer, primary_key=True),
    # Whose photo it is: exactly one of these. A Child has many, Pick-up persons one each.
    Column("child_id", Integer, ForeignKey("children.id", ondelete="CASCADE"), index=True),
    Column(
        "contact_id",
        Integer,
        ForeignKey("child_contacts.id", ondelete="CASCADE"),
        unique=True,
    ),
    Column("parent_id", Integer, ForeignKey("parents.id", ondelete="CASCADE"), unique=True),
    Column("uploaded_at", DateTime(timezone=True), nullable=False),
    CheckConstraint("num_nonnulls(child_id, contact_id, parent_id) = 1", name="one_owner"),
)


@dataclass(frozen=True)
class Photo:
    id: int
    uploaded_at: datetime


@dataclass(frozen=True)
class ContactPhoto:
    """The photo of one of a Child's contacts, e.g. a Pick-up person."""

    child_id: int
    contact_id: int


@dataclass(frozen=True)
class ParentPhoto:
    parent_id: int


# The one photo of a Pick-up person: one of a Child's contacts, or a Parent.
PickUpPhoto = ContactPhoto | ParentPhoto


@dataclass(frozen=True)
class LeftoverFiles:
    """Files of photos whose records were deleted. Delete them (`delete_files`) only once that
    is saved: deleted before, a failed save would keep records whose files are gone."""

    names: tuple[str, ...]


class PhotoNotFound(Exception):
    """There is no such photo, or none that may be shown."""


class NoPhotoConsent(Exception):
    """The Child's photo Consent is not given, so the Kita may not keep new photos."""


class PhotoTooLarge(Exception):
    """The upload is larger than MAX_UPLOAD_BYTES, or has more than MAX_PIXELS."""


class NotAnImage(Exception):
    """The upload is not a photo the app can read (JPEG, PNG or WebP)."""


def _resized(image: Image.Image, size: PhotoSize) -> bytes:
    copy = image.copy()
    longest = _LONGEST_SIDE[size]
    copy.thumbnail((longest, longest))
    buffer = io.BytesIO()
    # Saved afresh without the camera's metadata (e.g. where the photo was taken).
    copy.save(buffer, "JPEG", quality=85 if size == "full" else 80)
    return buffer.getvalue()


def _prepared(data: bytes) -> dict[PhotoSize, bytes]:
    """The upload's files, one per size."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise PhotoTooLarge
    try:
        with Image.open(io.BytesIO(data), formats=["JPEG", "PNG", "WEBP"]) as image:
            # Opening reads only the header; nothing is decoded yet.
            if image.width * image.height > MAX_PIXELS:
                raise PhotoTooLarge
            # Upright as the camera held it, since the metadata saying so goes.
            upright = ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise NotAnImage from None
    return {size: _resized(upright, size) for size in _LONGEST_SIDE}


def _file_name(photo_id: int, size: PhotoSize) -> str:
    return f"{photo_id}-{size}.jpg.enc"


def _leftovers(photo_ids: Sequence[int]) -> LeftoverFiles:
    return LeftoverFiles(
        tuple(_file_name(photo_id, size) for photo_id in photo_ids for size in _LONGEST_SIDE)
    )


def _owner(connection: Connection, of: PickUpPhoto, lock: bool = False) -> tuple[Column[int], int]:
    """The photos column naming the Pick-up person, and their ID; raises if there is none."""
    not_found: type[Exception]
    if isinstance(of, ContactPhoto):
        query = select(child_contacts.c.id).where(
            child_contacts.c.id == of.contact_id, child_contacts.c.child_id == of.child_id
        )
        column, owner_id, not_found = photos.c.contact_id, of.contact_id, ContactNotFound
    else:
        query = select(parents.c.id).where(parents.c.id == of.parent_id)
        column, owner_id, not_found = photos.c.parent_id, of.parent_id, ParentNotFound
    if connection.scalar(query.with_for_update() if lock else query) is None:
        raise not_found
    return column, owner_id


def _delete_photo_of(connection: Connection, column: Column[int], owner_id: int) -> list[int]:
    """Deletes the Pick-up person's photo record, if any; returns its ID."""
    return list(connection.scalars(delete(photos).where(column == owner_id).returning(photos.c.id)))


class Photos:
    def __init__(
        self,
        engine: Engine,
        clock: Clock,
        cipher: FieldCipher,
        store: FileStore,
        consents: Consents,
    ) -> None:
        self._engine = engine
        self._consents = consents
        self._clock = clock
        self._cipher = cipher
        self._store = store

    def of_child(self, child_id: int) -> list[Photo]:
        """The Child's photos, newest first; none without photo Consent."""
        if not self._may_show(child_id):
            return []
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(photos.c.id, photos.c.uploaded_at)
                .where(photos.c.child_id == child_id)
                .order_by(photos.c.id.desc())
            ).all()
        return [Photo(row.id, row.uploaded_at) for row in rows]

    def add(self, child_id: int, data: bytes) -> Photo:
        files = _prepared(data)
        uploaded_at = self._clock.now()
        with transaction(self._engine) as connection:
            # Locked, so the Consent cannot be withdrawn while the photo is added.
            locked = connection.scalar(
                select(children.c.id).where(children.c.id == child_id).with_for_update()
            )
            if locked is None:
                raise ChildNotFound
            if not self._may_show(child_id):
                raise NoPhotoConsent
            photo_id = connection.scalar(
                insert(photos)
                .values(child_id=child_id, uploaded_at=uploaded_at)
                .returning(photos.c.id)
            )
            assert photo_id is not None
            self._put_files(photo_id, files)
        return Photo(photo_id, uploaded_at)

    def file(self, child_id: int, photo_id: int, size: PhotoSize) -> bytes:
        with transaction(self._engine) as connection:
            found = connection.scalar(
                select(photos.c.id).where(photos.c.id == photo_id, photos.c.child_id == child_id)
            )
        if found is None or not self._may_show(child_id):
            raise PhotoNotFound
        return self._file(photo_id, size)

    def remove(self, child_id: int, photo_id: int) -> LeftoverFiles:
        with transaction(self._engine) as connection:
            removed = connection.scalar(
                delete(photos)
                .where(photos.c.id == photo_id, photos.c.child_id == child_id)
                .returning(photos.c.id)
            )
        if removed is None:
            raise PhotoNotFound
        return _leftovers([photo_id])

    def leftovers_of_child(self, child_id: int) -> LeftoverFiles:
        """The files of all the Child's photos, shown or not, and of their contacts' photos,
        for when the Child is purged."""
        with transaction(self._engine) as connection:
            photo_ids = connection.scalars(
                select(photos.c.id).where(
                    (photos.c.child_id == child_id)
                    | photos.c.contact_id.in_(
                        select(child_contacts.c.id).where(child_contacts.c.child_id == child_id)
                    )
                )
            ).all()
        return _leftovers(photo_ids)

    def leftovers_of_parents(self, parent_ids: Sequence[int]) -> LeftoverFiles:
        """The files of these Parents' photos, for when they are deleted."""
        return _leftovers(list(self.photos_of_parents(parent_ids).values()))

    def leftovers_of_contact(self, child_id: int, contact_id: int) -> LeftoverFiles:
        """The files of the contact's photo, if any, for when the contact is removed."""
        with transaction(self._engine) as connection:
            photo_ids = connection.scalars(
                select(photos.c.id)
                .join(child_contacts, child_contacts.c.id == photos.c.contact_id)
                .where(child_contacts.c.id == contact_id, child_contacts.c.child_id == child_id)
            ).all()
        return _leftovers(photo_ids)

    def set_pick_up_photo(self, of: PickUpPhoto, data: bytes) -> LeftoverFiles:
        """Sets the Pick-up person's photo; returns the files of the one it replaced."""
        files = _prepared(data)
        with transaction(self._engine) as connection:
            # Locked, so two uploads at once cannot both stay.
            column, owner_id = _owner(connection, of, lock=True)
            replaced = _delete_photo_of(connection, column, owner_id)
            photo_id = connection.scalar(
                insert(photos)
                .values({column.name: owner_id, "uploaded_at": self._clock.now()})
                .returning(photos.c.id)
            )
            assert photo_id is not None
            self._put_files(photo_id, files)
        return _leftovers(replaced)

    def pick_up_photo_file(self, of: PickUpPhoto, size: PhotoSize) -> bytes:
        with transaction(self._engine) as connection:
            column, owner_id = _owner(connection, of)
            photo_id = connection.scalar(select(photos.c.id).where(column == owner_id))
        if photo_id is None:
            raise PhotoNotFound
        return self._file(photo_id, size)

    def remove_pick_up_photo(self, of: PickUpPhoto) -> LeftoverFiles:
        with transaction(self._engine) as connection:
            column, owner_id = _owner(connection, of, lock=True)
            removed = _delete_photo_of(connection, column, owner_id)
        if not removed:
            raise PhotoNotFound
        return _leftovers(removed)

    def photos_of_contacts(self, contact_ids: Sequence[int]) -> dict[int, int]:
        """The photo ID of each of these contacts that has a photo, by contact ID."""
        return self._photos_of(photos.c.contact_id, contact_ids)

    def photos_of_parents(self, parent_ids: Sequence[int]) -> dict[int, int]:
        """The photo ID of each of these Parents who has a photo, by Parent ID."""
        return self._photos_of(photos.c.parent_id, parent_ids)

    def _photos_of(self, column: Column[int], owner_ids: Sequence[int]) -> dict[int, int]:
        with transaction(self._engine) as connection:
            rows = connection.execute(
                select(column, photos.c.id).where(column.in_(owner_ids))
            ).all()
        return {owner_id: photo_id for owner_id, photo_id in rows}

    def _put_files(self, photo_id: int, files: dict[PhotoSize, bytes]) -> None:
        for size, file in files.items():
            name = _file_name(photo_id, size)
            self._store.put(name, self._cipher.encrypt_bytes(file, name))

    def _file(self, photo_id: int, size: PhotoSize) -> bytes:
        name = _file_name(photo_id, size)
        return self._cipher.decrypt_bytes(self._store.get(name), name)

    def delete_files(self, leftovers: LeftoverFiles) -> None:
        for name in leftovers.names:
            self._store.delete(name)

    def _may_show(self, child_id: int) -> bool:
        return self._consents.is_given(child_id, "photo")
