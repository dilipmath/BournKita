"""Shared pieces for the HTTP API modules."""

import math
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta

from fastapi import HTTPException, Request, status
from pydantic import ConfigDict
from pydantic.alias_generators import to_camel

# JSON in camelCase, while attributes keep their Python names (first_name), so models can also
# be built from domain objects.
CAMEL_CASE = ConfigDict(
    alias_generator=to_camel,
    validate_by_name=True,
    serialize_by_alias=True,
    from_attributes=True,
)

# Each rule a request can break, with the status code and error code the API answers.
Refusals = dict[type[Exception], tuple[int, str]]


@contextmanager
def refusals_as_http_errors(refusals: Refusals) -> Iterator[None]:
    try:
        yield
    except tuple(refusals) as error:
        status_code, detail = refusals[type(error)]
        raise HTTPException(status_code, detail=detail) from None


# Set by the web server (app.caddy) to the address it received the request from, overwriting any
# such header a client sends. The API itself is only reachable through the web server and from
# inside the stack (e.g. the backup service).
CLIENT_ADDRESS_HEADER = "X-Kita-Client-Address"


def client_address(request: Request) -> str:
    """The network address a request came from, for limits and logs."""
    forwarded = request.headers.get(CLIENT_ADDRESS_HEADER)
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


def too_many(detail: str, retry_after: timedelta) -> HTTPException:
    """The answer when a limit per address is reached: 429, saying when to try again."""
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        detail=detail,
        headers={"Retry-After": str(math.ceil(retry_after.total_seconds()))},
    )
