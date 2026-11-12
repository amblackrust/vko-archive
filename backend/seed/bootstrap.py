"""First start of the demo stack: schema, roles, demo content, demo staff accounts, search index.

    python -m seed.bootstrap

Safe to repeat: migrations are idempotent, content is seeded only into an empty catalog, accounts are created
only when missing. Used by the backend container (`backend/docker-entrypoint.sh`); locally `make dev` does the same
steps one by one.
"""

import logging
import os
import subprocess
import sys
import time

from sqlalchemy import func, select, text

from app.cli import create_user
from app.config import get_settings
from app.db import get_sessionmaker
from app.models import Document
from app.models.enums import RoleCode
from app.repositories import users as users_repo
from app.services import indexing
from app.services.authz import ensure_roles_and_permissions
from seed.runner import run

log = logging.getLogger("bootstrap")

# e-mail, role, display name. Demo accounts only: the password comes from DEMO_PASSWORD.
DEMO_USERS = [
    ("superadmin@demo.kz", RoleCode.SUPER_ADMIN, "Главный администратор Демо"),
    ("siteadmin@demo.kz", RoleCode.SITE_ADMIN, "Администратор сайта Демо"),
    ("editor@demo.kz", RoleCode.EDITOR, "Редактор Демо"),
    ("archivist@demo.kz", RoleCode.ARCHIVIST, "Архивист Демо"),
    ("moderator@demo.kz", RoleCode.MODERATOR, "Модератор Демо"),
    ("analyst@demo.kz", RoleCode.ANALYST, "Аналитик Демо"),
]


def wait_for_database(attempts: int = 60) -> None:
    for _ in range(attempts):
        try:
            with get_sessionmaker()() as session:
                session.execute(text("select 1"))
            return
        except Exception as exc:  # noqa: BLE001 - any connection failure means "not ready yet"
            log.info("waiting for the database: %s", exc.__class__.__name__)
            time.sleep(2)
    raise SystemExit("the database did not become ready")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    settings = get_settings()
    wait_for_database()
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)

    with get_sessionmaker()() as session:
        ensure_roles_and_permissions(session)
        session.commit()
        if not session.scalar(select(func.count(Document.id))):
            log.info("seeding the demo catalog (first start)")
            run(session, settings.storage_dir)
            session.commit()
            indexing.reindex_all(session)
            session.commit()

    password = os.environ.get("DEMO_PASSWORD")
    if password:
        with get_sessionmaker()() as session:
            existing = {email for email, *_ in DEMO_USERS if users_repo.get_by_email(session, email) is not None}
        for email, role, name in DEMO_USERS:
            if email not in existing:
                create_user(email, role, password, full_name=name)
                log.info("demo account %s created", email)

    with get_sessionmaker()() as session:
        try:
            embedded = indexing.embed_pending(session, settings)
            log.info("search vectors computed: %s", embedded)
        except Exception as exc:  # noqa: BLE001 - search degrades to full text without the embedding model
            log.warning("vectors skipped (Ollama or the embedding model is not ready): %s", exc)
    return 0


if __name__ == "__main__":
    sys.exit(main())
