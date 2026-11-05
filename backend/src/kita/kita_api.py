"""HTTP API for the Kita's own name and logo: on the login page, so no login is needed."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel

from kita.api_support import CAMEL_CASE
from kita.settings import Settings

# Pictures only: an SVG could carry scripts, so it is not served.
_LOGO_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


class KitaOut(BaseModel):
    model_config = CAMEL_CASE

    # None: the app calls itself "Kita Kids Database".
    name: str | None
    has_logo: bool


def _usable_logo(path: Path | None) -> Path | None:
    """The logo file, if it is set, there, and a picture."""
    if path is None or path.suffix.lower() not in _LOGO_TYPES or not path.is_file():
        return None
    return path


def kita_router(settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api/kita")
    name = (settings.name or "").strip() or None

    @router.get("")
    def kita() -> KitaOut:
        return KitaOut(name=name, has_logo=_usable_logo(settings.logo) is not None)

    @router.get("/logo")
    def logo() -> Response:
        path = _usable_logo(settings.logo)
        if path is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="not_found")
        return Response(
            path.read_bytes(),
            media_type=_LOGO_TYPES[path.suffix.lower()],
            # Changed rarely, but then at once on every tablet.
            headers={"Cache-Control": "no-cache"},
        )

    return router
