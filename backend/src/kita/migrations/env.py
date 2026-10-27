from alembic import context
from sqlalchemy import create_engine

from kita import audit, children, identity, parents  # noqa: F401  (register their tables on the metadata)
from kita.db import metadata
from kita.settings import Settings

database_url = context.config.attributes.get("database_url") or Settings().database_url
engine = create_engine(database_url)
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=metadata)
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
