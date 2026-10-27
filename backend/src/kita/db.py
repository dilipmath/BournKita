from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager, contextmanager
from contextvars import ContextVar

from alembic import command
from alembic.config import Config
from anyio import to_thread
from sqlalchemy import Connection, Engine, MetaData

# Every module defines its tables on this metadata; Alembic migrations create them.
metadata = MetaData(
    naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
)


def migrate(database_url: str) -> None:
    """Brings the database schema up to date."""
    config = Config()
    config.set_main_option("script_location", "kita:migrations")
    config.attributes["database_url"] = database_url
    command.upgrade(config, "head")


class _Unit:
    """A unit of work's transaction, begun only when a module first needs the database, so a
    request holds no connection while e.g. its login is checked."""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        self._connection: Connection | None = None

    def connection(self) -> Connection:
        if self._connection is None:
            self._connection = self._engine.connect()
            self._connection.begin()
        return self._connection

    def commit(self) -> None:
        if self._connection is not None:
            self._connection.commit()

    def close(self) -> None:
        """Rolls back whatever was not committed."""
        if self._connection is not None:
            self._connection.close()


# The unit of work running in this context, if any.
_unit_of_work: ContextVar[_Unit | None] = ContextVar("unit_of_work", default=None)


class UnitOfWork:
    """Several modules' work during one request as a single transaction: all of it is saved, or
    none (e.g. a change and its audit entry). Modules take part by reaching the database only
    through `transaction`; one that used its engine directly could wait on the unit's own locks."""

    def __init__(self, unit: _Unit) -> None:
        self._unit = unit

    async def commit(self) -> None:
        await to_thread.run_sync(self._unit.commit)


@asynccontextmanager
async def unit_of_work(engine: Engine) -> AsyncIterator[UnitOfWork]:
    """Runs the `transaction`s of the enclosed code, including worker threads it starts, in one
    transaction. Nothing is saved unless `commit` is awaited. Enter it in async code: a worker
    thread's changes to its context are lost."""
    unit = _Unit(engine)
    token = _unit_of_work.set(unit)
    try:
        yield UnitOfWork(unit)
    finally:
        _unit_of_work.reset(token)
        await to_thread.run_sync(unit.close)


@contextmanager
def transaction(engine: Engine) -> Iterator[Connection]:
    """A transaction for a module's reads and writes. Inside a unit of work it is a savepoint of
    the unit's transaction, so it is only kept if the whole unit is; elsewhere it commits on its
    own."""
    unit = _unit_of_work.get()
    if unit is None:
        with engine.begin() as own:
            yield own
    else:
        connection = unit.connection()
        with connection.begin_nested():
            yield connection
