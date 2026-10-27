"""What the HTTP APIs with photos share: reading an upload, answering with a photo, and the
refusals."""

import hashlib

from fastapi import Request, Response, UploadFile, status

from kita.api_support import Refusals
from kita.photos import MAX_UPLOAD_BYTES, NotAnImage, PhotoNotFound, PhotoTooLarge

PHOTO_REFUSALS: Refusals = {
    PhotoNotFound: (status.HTTP_404_NOT_FOUND, "not_found"),
    NotAnImage: (status.HTTP_422_UNPROCESSABLE_CONTENT, "not_an_image"),
    PhotoTooLarge: (status.HTTP_413_CONTENT_TOO_LARGE, "too_large"),
}


async def read_upload(photo: UploadFile) -> bytes:
    # No further than needed to tell that it is too large.
    return await photo.read(MAX_UPLOAD_BYTES + 1)


def photo_response(data: bytes, request: Request) -> Response:
    """The photo, which the tablet may keep but must check with us before showing again: so a
    gallery loads quickly, and a withdrawn photo Consent still hides it at once."""
    etag = f'"{hashlib.sha256(data).hexdigest()[:32]}"'
    headers = {"ETag": etag, "Cache-Control": "private, no-cache"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(data, media_type="image/jpeg", headers=headers)
