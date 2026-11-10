"""search_entries.file_id: source file of OCR chunks (re-checked at query time)

Revision ID: 0004
Revises: 0002
Create Date: 2026-11-10 23:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0004'
down_revision: str | None = '0002'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('search_entries', sa.Column('file_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f('fk_search_entries_file_id_digital_files'), 'search_entries', 'digital_files',
        ['file_id'], ['id'], ondelete='CASCADE',
    )
    op.create_index(op.f('ix_search_entries_file_id'), 'search_entries', ['file_id'], unique=False)
    # Old OCR rows have no source file and would be ignored by search: drop them, the
    # indexing command (python -m app.services.indexing) rebuilds them with file_id.
    op.execute("DELETE FROM search_entries WHERE chunk_no >= 1")


def downgrade() -> None:
    op.drop_index(op.f('ix_search_entries_file_id'), table_name='search_entries')
    op.drop_constraint(op.f('fk_search_entries_file_id_digital_files'), 'search_entries', type_='foreignkey')
    op.drop_column('search_entries', 'file_id')
