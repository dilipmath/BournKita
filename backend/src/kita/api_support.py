"""Shared pieces for the HTTP API modules."""

from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import HTTPException
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
