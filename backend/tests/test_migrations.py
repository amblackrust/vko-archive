import re

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import CheckConstraint, Enum, create_engine, inspect, text

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
            context = MigrationContext.configure(conn, opts={"compare_server_default": True})
            diff = compare_metadata(context, Base.metadata)
    finally:
        engine.dispose()
    assert diff == []


def _db_check_constraints(test_db_url: str) -> dict[tuple[str, str], str]:
    engine = create_engine(test_db_url)
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    "SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid) "
                    "FROM pg_constraint WHERE contype = 'c' AND conname LIKE 'ck\\_%'"
                )
            )
            return {(table, name): definition for table, name, definition in rows}
    finally:
        engine.dispose()


def test_enum_check_constraints_match_model_enums(test_db_url: str) -> None:
    """compare_metadata ignores CHECK constraints: an enum value added in a model without
    a migration would only fail at INSERT time. Compare the allowed values directly."""
    db_checks = _db_check_constraints(test_db_url)
    checked = 0
    for table in Base.metadata.sorted_tables:
        for column in table.columns:
            if not isinstance(column.type, Enum):
                continue
            name = f"ck_{table.name}_{column.type.name}"
            definition = db_checks.get((table.name, name))
            assert definition is not None, f"missing CHECK {name}"
            assert f"({column.name})::text" in definition, f"{name} checks another column: {definition}"
            assert set(re.findall(r"'([^']*)'::character varying", definition)) == set(column.type.enums), name
            checked += 1
    assert checked > 0


def test_named_check_constraints_exist_in_db(test_db_url: str) -> None:
    db_checks = _db_check_constraints(test_db_url)
    expected = {
        (table.name, constraint.name)
        for table in Base.metadata.sorted_tables
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint) and constraint.name
    }
    assert expected <= set(db_checks)
