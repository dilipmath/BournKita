"""Helpers for tests that need photos."""

import io
from typing import Any

from fastapi.testclient import TestClient
from PIL import Image


def jpeg(width: int = 1200, height: int = 900, **exif: Any) -> bytes:
    """A JPEG as a camera might send it; `exif` sets tags by number (e.g. 0x8825 for GPS)."""
    image = Image.new("RGB", (width, height), (200, 120, 40))
    tags = Image.Exif()
    for tag, value in exif.items():
        tags[int(tag.removeprefix("tag_"), 16)] = value
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", exif=tags)
    return buffer.getvalue()


def upload(client: TestClient, url: str, data: bytes, method: str = "POST") -> Any:
    return client.request(method, url, files={"photo": ("photo.jpg", data, "image/jpeg")})


def size_of(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as image:
        assert image.format == "JPEG"
        return image.size


def give_photo_consent(admin: TestClient, child_id: int) -> None:
    response = admin.post(
        f"/api/children/{child_id}/consents/photo/given", json={"givenOn": "2026-09-01"}
    )
    assert response.status_code == 204, response.text
