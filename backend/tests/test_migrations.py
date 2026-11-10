from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from app.models import Base
from tests.conftest import alembic_config


def test_upgrade_head_from_scratch_creates_extensions_and_all_tables(test_db_url: str) -> None:
    config = alembic_config(test_db_url)
    command.downgrade(config, "base")
    command.upgrade(config, "head")

    engine = create_engine(test_db_url)
    try:
        with engine.connect() as conn:
            extensions = {row[0] for row in conn.execute(text("SELECT extname FROM pg_extension"))}
            tables = set(inspect(conn).get_table_names())
    finally:
        engine.dispose()

    assert {"vector", "pg_trgm"} <= extensions
    assert set(Base.metadata.tables) <= tables


def test_models_match_migrations(test_db_url: str) -> None:
    """Model changes must come with a migration (no drift between models and schema)."""
    engine = create_engine(test_db_url)
    try:
        with engine.connect() as conn:
            diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    finally:
        engine.dispose()
    assert diff == []
