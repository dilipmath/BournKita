"""The API's form of Alerts, shared by the Child profile and the Group dashboard."""

from dataclasses import asdict

from pydantic import BaseModel

from kita.alerts import Alert, AlertDetails, AlertKind
from kita.api_support import CAMEL_CASE


class AlertIn(BaseModel):
    model_config = CAMEL_CASE

    kind: AlertKind
    name: str
    note: str = ""

    def details(self) -> AlertDetails:
        return AlertDetails(self.kind, self.name, self.note)


class AlertOut(AlertIn):
    id: int

    @classmethod
    def of(cls, alert: Alert) -> "AlertOut":
        return cls(**asdict(alert))
