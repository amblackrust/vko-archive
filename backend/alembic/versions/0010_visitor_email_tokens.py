"""Visitor e-mail confirmation and one-time tokens (password reset)

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-11 18:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0010'
down_revision: str | None = '0009'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('visitors', sa.Column('email_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_table('visitor_tokens',
    sa.Column('visitor_id', sa.UUID(), nullable=False),
    sa.Column('purpose', sa.String(length=16), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("purpose IN ('password_reset', 'email_confirm')", name=op.f('ck_visitor_tokens_purpose')),
    sa.ForeignKeyConstraint(['visitor_id'], ['visitors.id'], name=op.f('fk_visitor_tokens_visitor_id_visitors'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_visitor_tokens')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_visitor_tokens_token_hash'))
    )
    op.create_index(op.f('ix_visitor_tokens_visitor_id'), 'visitor_tokens', ['visitor_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_visitor_tokens_visitor_id'), table_name='visitor_tokens')
    op.drop_table('visitor_tokens')
    op.drop_column('visitors', 'email_confirmed_at')
