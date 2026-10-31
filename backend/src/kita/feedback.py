"""Feedback: a problem, change request or idea any Staff member (Guests too) sends from any page of
the app. It is stored and emailed to the developer with the page and who sent it."""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import Column, DateTime, Engine, Integer, Row, String, Table, Text, insert, select
from sqlalchemy import update as sql_update

from kita.children import TooLong
from kita.clock import Clock
from kita.db import metadata, transaction
from kita.encryption import FieldCipher
from kita.mail import Email, Mailer, MailNotSent

logger = logging.getLogger(__name__)

FeedbackKind = Literal["problem", "changeRequest", "idea"]
_KIND_NAMES: dict[FeedbackKind, str] = {
    "problem": "Problem",
    "changeRequest": "Change request",
    "idea": "Idea",
}
_MAX_TEXT_LENGTH = 5000

feedback = Table(
    "feedback",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("kind", String(20), nullable=False),
    # Encrypted (see FieldCipher), bound to the row: staff may write about a Child despite the
    # form asking them not to.
    Column("text", Text, nullable=False),
    # The app's address it was sent from, e.g. /groups/3: IDs, never names.
    Column("page", String(200), nullable=False),
    # The email address rather than the account's ID, as in the audit log.
    Column("sent_by", String(320), nullable=False),
    Column("sent_at", DateTime(timezone=True), nullable=False),
)


@dataclass(frozen=True)
class FeedbackDetails:
    kind: FeedbackKind
    text: str
    page: str


@dataclass(frozen=True)
class SentFeedback(FeedbackDetails):
    id: int
    sent_by: str
    sent_at: datetime


class TextRequired(Exception):
    """Feedback needs some text."""


def _text_field(feedback_id: int) -> str:
    return f"feedback.text.{feedback_id}"


class Feedbacks:
    def __init__(
        self, engine: Engine, clock: Clock, cipher: FieldCipher, mailer: Mailer, to: str | None
    ) -> None:
        self._engine = engine
        self._clock = clock
        self._cipher = cipher
        self._mailer = mailer
        # The developer's address; None: feedback is only stored (and logged).
        self._to = to

    def send(self, details: FeedbackDetails, sender: str) -> bool:
        """Stores the feedback, then emails it to the developer; returns whether that worked. A
        failed email keeps the feedback (and is filed as a crash report by the Mailer)."""
        text = details.text.strip()
        if not text:
            raise TextRequired
        if len(text) > _MAX_TEXT_LENGTH:
            raise TooLong
        sent_at = self._clock.now()
        with transaction(self._engine) as connection:
            feedback_id = connection.scalar(
                insert(feedback)
                .values(
                    kind=details.kind, text="", page=details.page, sent_by=sender, sent_at=sent_at
                )
                .returning(feedback.c.id)
            )
            assert feedback_id is not None
            # The encrypted text is bound to the row's ID, so it follows once that exists.
            connection.execute(
                sql_update(feedback)
                .where(feedback.c.id == feedback_id)
                .values(text=self._cipher.encrypt(text, _text_field(feedback_id)))
            )
        if self._to is None:
            logger.info("Feedback %s stored; no address to email it to.", feedback_id)
            return False
        body = "\n".join(
            [
                f"Type: {_KIND_NAMES[details.kind]}",
                f"Page: {details.page}",
                f"From: {sender}",
                f"Time: {sent_at.isoformat()}",
                "",
                text,
            ]
        )
        subject = f"Kita feedback: {_KIND_NAMES[details.kind]}"
        try:
            self._mailer.send(Email(to=self._to, subject=subject, body=body))
        except MailNotSent:
            return False
        return True

    def all(self) -> list[SentFeedback]:
        """All feedback, newest first."""
        with transaction(self._engine) as connection:
            rows = connection.execute(select(feedback).order_by(feedback.c.id.desc())).all()
        return [self._to_feedback(row) for row in rows]

    def _to_feedback(self, row: Row[Any]) -> SentFeedback:
        return SentFeedback(
            kind=row.kind,
            text=self._cipher.decrypt(row.text, _text_field(row.id)),
            page=row.page,
            id=row.id,
            sent_by=row.sent_by,
            sent_at=row.sent_at,
        )
