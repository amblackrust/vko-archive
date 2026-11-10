"""Tests run against a real PostgreSQL (pgvector) from docker compose.

They use a separate database (TEST_DATABASE_URL, default: <DATABASE_URL db name>_test),
created automatically if missing and migrated from scratch with `alembic upgrade head`.
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, get_settings
from app.db import get_session
from app.main import app

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _test_database_url(settings: Settings) -> str:
    if settings.test_database_url:
        url = settings.test_database_url
    else:
        main = make_url(settings.database_url)
        url = main.set(database=f"{main.database}_test").render_as_string(hide_password=False)
    if make_url(url).database == make_url(settings.database_url).database:
        raise RuntimeError("TEST_DATABASE_URL must point to a different database than DATABASE_URL")
    return url


def _ensure_database(url: str) -> None:
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target.database}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    finally:
        admin.dispose()


def alembic_config(url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture(scope="session")
def test_db_url() -> str:
    url = _test_database_url(get_settings())
    _ensure_database(url)
    config = alembic_config(url)
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    return url


@pytest.fixture(scope="session")
def engine(test_db_url: str) -> Iterator[Engine]:
    engine = create_engine(test_db_url)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    """Session inside a transaction that is rolled back after the test."""
    with engine.connect() as conn:
        trans = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            trans.rollback()


@pytest.fixture
def client(engine: Engine) -> Iterator[TestClient]:
    factory = sessionmaker(bind=engine)

    def _session() -> Iterator[Session]:
        with factory() as session:
            yield session

    app.dependency_overrides[get_session] = _session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
