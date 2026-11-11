"""Neutral slugs and storage paths of the seeded catalog (no «demo» in public URLs)

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-11 19:00:00

Slugs are visible in URLs, so they lose the «demo» word:
documents demo-* -> doc-*, funds demo-fund-* -> fund-*, news news-demo-* -> news-*,
map objects map-demo-* -> map-*; stored files masters|previews/seed/demo/ -> .../seed/catalog/.
News and map objects are the seed lookup key, so this migration must run before the next
`python -m seed`. Old links are not redirected (decision of the customer). When rows of the
digital_files table were changed, the directories on disk are moved too (best effort).
"""
import os
from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

from app.config import get_settings


revision: str = '0011'
down_revision: str | None = '0010'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, old prefix, new prefix)
SLUGS = (
    ("documents", "demo-", "doc-"),
    ("funds", "demo-fund-", "fund-"),
    ("news", "news-demo-", "news-"),
    ("historical_events", "map-demo-", "map-"),
)
DIRECTORIES = ("masters", "previews")


def _rename(old: str, new: str) -> None:
    connection = op.get_bind()
    for table, old_prefix, new_prefix in SLUGS:
        o, n = (old_prefix, new_prefix) if old == "demo" else (new_prefix, old_prefix)
        op.execute(
            text(f"UPDATE {table} SET slug = :n || substr(slug, :skip) WHERE slug LIKE :like").bindparams(
                n=n, skip=len(o) + 1, like=o.replace("_", r"\_") + "%"
            )
        )
    changed = 0
    for column in ("master_path", "preview_path"):
        result = connection.execute(
            text(f"UPDATE digital_files SET {column} = replace({column}, :a, :b) WHERE {column} LIKE :like").bindparams(
                a=f"/seed/{old}/", b=f"/seed/{new}/", like=f"%/seed/{old}/%"
            )
        )
        changed += result.rowcount
    if not changed:
        return
    storage = get_settings().storage_dir
    for directory in DIRECTORIES:
        source, target = storage / directory / "seed" / old, storage / directory / "seed" / new
        if source.is_dir() and not target.exists():
            os.rename(source, target)


def upgrade() -> None:
    _rename("demo", "catalog")


def downgrade() -> None:
    _rename("catalog", "demo")
