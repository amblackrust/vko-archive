"""Strip the visible «ДЕМО» marker from archive codes; drop the prototype news item

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-11 16:00:00

The demo marker is no longer shown in the UI (decision of the MVP customer). Archive codes
are the seed lookup key of demo documents, so they are renamed here; the texts are then
refreshed by `python -m seed --refresh`.
"""
from collections.abc import Sequence

from alembic import op


revision: str = '0009'
down_revision: str | None = '0008'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE documents SET archive_code = substr(archive_code, 6) WHERE archive_code LIKE 'ДЕМО Ф.%'")
    op.execute("DELETE FROM news WHERE slug = 'news-demo-prototype'")


def downgrade() -> None:
    op.execute("UPDATE documents SET archive_code = 'ДЕМО ' || archive_code WHERE slug LIKE 'demo-%'")
