from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData

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
