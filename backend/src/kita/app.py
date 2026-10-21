from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Response, status
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from kita.clock import Clock, SystemClock
from kita.mail import LogMailer, Mailer
from kita.settings import Settings


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]
    time: str


def create_app(
    settings: Settings,
    clock: Clock | None = None,
    mailer: Mailer | None = None,
) -> FastAPI:
    clock = clock or SystemClock()
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": settings.database_connect_timeout_seconds},
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    app = FastAPI(title="Kita Kids Database", lifespan=lifespan)
    app.state.mailer = mailer or LogMailer()

    @app.get("/api/health")
    def health(response: Response) -> Health:
        now = clock.now().isoformat().replace("+00:00", "Z")
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except OperationalError:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return Health(status="degraded", database="unavailable", time=now)
        return Health(status="ok", database="ok", time=now)

    return app
