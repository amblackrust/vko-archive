"""Real fund lists: former names and accounting fields of a fund, newspaper holdings

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-12 00:30:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = '0012'
down_revision: str | None = '0011'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FUND_CHECKS = (
    ('ck_funds_category_range', 'category BETWEEN 1 AND 3'),
    ('ck_funds_ownership_value', "ownership IN ('state', 'private')"),
    ('ck_funds_restricted_value', "restricted = 'partial'"),
)


def upgrade() -> None:
    op.add_column('funds', sa.Column('former_names', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.add_column('funds', sa.Column('units_count', sa.Integer(), nullable=True))
    op.add_column('funds', sa.Column('category', sa.Integer(), nullable=True))
    op.add_column('funds', sa.Column('ownership', sa.String(length=16), nullable=True))
    op.add_column('funds', sa.Column('first_received', sa.Date(), nullable=True))
    op.add_column('funds', sa.Column('restricted', sa.String(length=16), nullable=True))
    op.add_column('funds', sa.Column('source', sa.String(length=255), nullable=True))
    for name, condition in FUND_CHECKS:
        op.create_check_constraint(op.f(name), 'funds', condition)
    op.create_table('newspapers',
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('publisher', sa.Text(), nullable=True),
    sa.Column('year_from', sa.Integer(), nullable=False),
    sa.Column('year_to', sa.Integer(), nullable=False),
    sa.Column('volumes_total', sa.Integer(), nullable=False),
    sa.Column('years_covered', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('years', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_newspapers')),
    sa.UniqueConstraint('title', 'publisher', name=op.f('uq_newspapers_title_publisher'), postgresql_nulls_not_distinct=True)
    )


def downgrade() -> None:
    op.drop_table('newspapers')
    for name, _ in FUND_CHECKS:
        op.drop_constraint(op.f(name), 'funds', type_='check')
    for column in ('source', 'restricted', 'first_received', 'ownership', 'category', 'units_count', 'former_names'):
        op.drop_column('funds', column)
