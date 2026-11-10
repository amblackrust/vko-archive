"""review fixes: digital_files.access, fund number uniqueness, case-insensitive email,
range CHECK constraints

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-10 22:30:20.123835

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, constraint name, condition) — names follow the ck_%(table)s_%(name)s convention.
RANGE_CHECKS = [
    ('documents', 'ck_documents_date_range', 'date_from <= date_to'),
    ('historical_events', 'ck_historical_events_date_range', 'date_from <= date_to'),
    ('historical_events', 'ck_historical_events_lat_range', 'lat BETWEEN -90 AND 90'),
    ('historical_events', 'ck_historical_events_lng_range', 'lng BETWEEN -180 AND 180'),
    ('branches', 'ck_branches_lat_range', 'lat BETWEEN -90 AND 90'),
    ('branches', 'ck_branches_lng_range', 'lng BETWEEN -180 AND 180'),
    ('memorial_dates', 'ck_memorial_dates_month_range', 'month BETWEEN 1 AND 12'),
    ('memorial_dates', 'ck_memorial_dates_day_range', 'day BETWEEN 1 AND 31'),
]


def upgrade() -> None:
    # Existing files get the most restrictive state until an archivist reviews them.
    op.add_column('digital_files', sa.Column('access', sa.String(length=32), server_default='needs_review', nullable=False))
    op.create_check_constraint(
        op.f('ck_digital_files_file_access'),
        'digital_files',
        "access IN ('open', 'restricted', 'closed', 'needs_review')",
    )
    op.create_unique_constraint(op.f('uq_funds_branch_id_number'), 'funds', ['branch_id', 'number'], postgresql_nulls_not_distinct=True)
    op.drop_constraint(op.f('uq_users_email'), 'users', type_='unique')
    op.create_index('uq_users_email_lower', 'users', [sa.literal_column('lower(email)')], unique=True)
    for table, name, condition in RANGE_CHECKS:
        op.create_check_constraint(op.f(name), table, condition)


def downgrade() -> None:
    for table, name, _ in reversed(RANGE_CHECKS):
        op.drop_constraint(op.f(name), table, type_='check')
    op.drop_index('uq_users_email_lower', table_name='users')
    op.create_unique_constraint(op.f('uq_users_email'), 'users', ['email'])
    op.drop_constraint(op.f('uq_funds_branch_id_number'), 'funds', type_='unique')
    op.drop_column('digital_files', 'access')
