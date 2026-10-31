"""HTTP API for feedback: everyone who logs in sends it, Guests too; Admins read what was sent."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, StringConstraints

from kita.api_support import CAMEL_CASE, Refusals, refusals_as_http_errors
from kita.children import TooLong
from kita.feedback import (
    FeedbackDetails,
    FeedbackKind,
    Feedbacks,
    SentFeedback,
    TextRequired,
)
from kita.identity import Identity, StaffMember
from kita.identity_api import role_dependency, staff_member_dependency

_REFUSALS: Refusals = {
    TextRequired: (status.HTTP_422_UNPROCESSABLE_CONTENT, "text_required"),
    TooLong: (status.HTTP_422_UNPROCESSABLE_CONTENT, "too_long"),
}

# The app's address the feedback was sent from (its path, e.g. /groups/3): no query string, so
# no search text comes along.
PageAddress = Annotated[str, StringConstraints(pattern=r"^/[A-Za-z0-9_\-./]{0,199}$")]


class FeedbackIn(BaseModel):
    model_config = CAMEL_CASE

    kind: FeedbackKind
    text: str
    page: PageAddress

    def details(self) -> FeedbackDetails:
        return FeedbackDetails(self.kind, self.text, self.page)


class FeedbackReceipt(BaseModel):
    # False when no address is set or the email could not be sent; the feedback is kept anyway.
    emailed: bool


class FeedbackOut(FeedbackIn):
    id: int
    sent_by: str
    sent_at: datetime

    @classmethod
    def of(cls, sent: SentFeedback) -> "FeedbackOut":
        return cls.model_validate(sent)


def feedback_router(identity: Identity, feedbacks: Feedbacks) -> APIRouter:
    router = APIRouter(prefix="/api/feedback")
    # Guests too: sending feedback shows them no data.
    Sender = Annotated[StaffMember, Depends(staff_member_dependency(identity, guests_allowed=True))]

    @router.post("", status_code=status.HTTP_201_CREATED)
    def send_feedback(feedback: FeedbackIn, sender: Sender) -> FeedbackReceipt:
        with refusals_as_http_errors(_REFUSALS):
            emailed = feedbacks.send(feedback.details(), sender.email)
        return FeedbackReceipt(emailed=emailed)

    @router.get("", dependencies=[Depends(role_dependency(identity, "admin"))])
    def all_feedback() -> list[FeedbackOut]:
        return [FeedbackOut.of(sent) for sent in feedbacks.all()]

    return router
