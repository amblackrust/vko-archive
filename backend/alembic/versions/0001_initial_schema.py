"""initial schema: extensions vector + pg_trgm and all models of the project plan §2

Revision ID: 0001
Revises: 
Create Date: 2026-11-10 22:23:41.838428

"""
from collections.abc import Sequence

import sqlalchemy as sa
import pgvector.sqlalchemy
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0001'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table('permissions',
    sa.Column('module', sa.String(length=64), nullable=False),
    sa.Column('action', sa.String(length=64), nullable=False),
    sa.Column('description', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_permissions')),
    sa.UniqueConstraint('module', 'action', name=op.f('uq_permissions_module_action'))
    )
    op.create_table('roles',
    sa.Column('code', sa.String(length=64), nullable=False),
    sa.Column('name', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('description', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('is_system', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_roles')),
    sa.UniqueConstraint('code', name=op.f('uq_roles_code'))
    )
    op.create_table('search_entries',
    sa.Column('object_type', sa.String(length=32), nullable=False),
    sa.Column('object_id', sa.Uuid(), nullable=False),
    sa.Column('lang', sa.String(length=8), nullable=False),
    sa.Column('chunk_no', sa.Integer(), server_default='0', nullable=False),
    sa.Column('title', sa.Text(), server_default='', nullable=False),
    sa.Column('body', sa.Text(), server_default='', nullable=False),
    sa.Column('tsv', postgresql.TSVECTOR(), nullable=True),
    sa.Column('embedding', pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
    sa.Column('embedding_model', sa.String(length=64), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_search_entries')),
    sa.UniqueConstraint('object_type', 'object_id', 'lang', 'chunk_no', name=op.f('uq_search_entries_object_type_object_id_lang_chunk_no'))
    )
    op.create_index('ix_search_entries_embedding', 'search_entries', ['embedding'], unique=False, postgresql_using='hnsw', postgresql_ops={'embedding': 'vector_cosine_ops'})
    op.create_index(op.f('ix_search_entries_object_id'), 'search_entries', ['object_id'], unique=False)
    op.create_index(op.f('ix_search_entries_object_type'), 'search_entries', ['object_type'], unique=False)
    op.create_index('ix_search_entries_title_trgm', 'search_entries', ['title'], unique=False, postgresql_using='gin', postgresql_ops={'title': 'gin_trgm_ops'})
    op.create_index('ix_search_entries_tsv', 'search_entries', ['tsv'], unique=False, postgresql_using='gin')
    op.create_table('search_logs',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('query', sa.Text(), nullable=False),
    sa.Column('lang', sa.String(length=8), nullable=True),
    sa.Column('source', sa.String(length=32), nullable=True),
    sa.Column('results_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('zero_result', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('clicked', sa.Boolean(), server_default='false', nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_search_logs'))
    )
    op.create_index(op.f('ix_search_logs_ts'), 'search_logs', ['ts'], unique=False)
    op.create_index(op.f('ix_search_logs_zero_result'), 'search_logs', ['zero_result'], unique=False)
    op.create_table('synonyms',
    sa.Column('terms', postgresql.ARRAY(sa.Text()), nullable=False),
    sa.Column('note', sa.String(length=255), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_synonyms'))
    )
    op.create_index('ix_synonyms_terms', 'synonyms', ['terms'], unique=False, postgresql_using='gin')
    op.create_table('users',
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('failed_logins', sa.Integer(), server_default='0', nullable=False),
    sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('branch_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users')),
    sa.UniqueConstraint('email', name=op.f('uq_users_email'))
    )
    op.create_index(op.f('ix_users_branch_id'), 'users', ['branch_id'], unique=False)
    op.create_table('audit_logs',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('actor', sa.String(length=320), nullable=True),
    sa.Column('action_type', sa.String(length=64), nullable=False),
    sa.Column('object_type', sa.String(length=64), nullable=True),
    sa.Column('object_id', sa.String(length=64), nullable=True),
    sa.Column('result', sa.Enum('success', 'failure', 'denied', name='audit_result', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('ip', sa.String(length=64), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_audit_logs_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_logs'))
    )
    op.create_index(op.f('ix_audit_logs_action_type'), 'audit_logs', ['action_type'], unique=False)
    op.create_index('ix_audit_logs_object', 'audit_logs', ['object_type', 'object_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_ts'), 'audit_logs', ['ts'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)
    op.create_table('branches',
    sa.Column('name', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('short_name', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('type', sa.Enum('head', 'district', 'city', 'personnel', name='branch_type', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('address', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('phone', sa.String(length=255), nullable=True),
    sa.Column('email', sa.String(length=320), nullable=True),
    sa.Column('director', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('hours', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('photo_file_id', sa.UUID(), nullable=True),
    sa.Column('description', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('funds_summary', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('lat', sa.Numeric(precision=9, scale=6), nullable=True),
    sa.Column('lng', sa.Numeric(precision=9, scale=6), nullable=True),
    sa.Column('coords_verified', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('show_on_map', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_branches_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_branches')),
    sa.UniqueConstraint('slug', name=op.f('uq_branches_slug'))
    )
    op.create_index(op.f('ix_branches_workflow_status'), 'branches', ['workflow_status'], unique=False)
    op.create_table('categories',
    sa.Column('scope', sa.String(length=32), nullable=False),
    sa.Column('name', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('description', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('parent_id', sa.UUID(), nullable=True),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_categories_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['parent_id'], ['categories.id'], name=op.f('fk_categories_parent_id_categories'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_categories')),
    sa.UniqueConstraint('slug', name=op.f('uq_categories_slug'))
    )
    op.create_index(op.f('ix_categories_scope'), 'categories', ['scope'], unique=False)
    op.create_index(op.f('ix_categories_workflow_status'), 'categories', ['workflow_status'], unique=False)
    op.create_table('digital_files',
    sa.Column('owner_type', sa.String(length=32), nullable=True),
    sa.Column('owner_id', sa.Uuid(), nullable=True),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.Column('original_name', sa.String(length=255), nullable=True),
    sa.Column('master_path', sa.String(length=1024), nullable=False),
    sa.Column('preview_path', sa.String(length=1024), nullable=True),
    sa.Column('mime', sa.String(length=128), nullable=False),
    sa.Column('size', sa.BigInteger(), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('pages', sa.Integer(), nullable=True),
    sa.Column('uploaded_by', sa.UUID(), nullable=True),
    sa.Column('provenance', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('rights_note', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('caption', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('ocr_text', sa.Text(), nullable=True),
    sa.Column('ocr_status', sa.Enum('none', 'pending', 'done', 'failed', 'unavailable', name='ocr_status', native_enum=False, create_constraint=True, length=32), server_default='none', nullable=False),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], name=op.f('fk_digital_files_uploaded_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_digital_files'))
    )
    op.create_index('ix_digital_files_owner', 'digital_files', ['owner_type', 'owner_id'], unique=False)
    op.create_index(op.f('ix_digital_files_sha256'), 'digital_files', ['sha256'], unique=False)
    op.create_table('faqs',
    sa.Column('category', sa.String(length=64), nullable=False),
    sa.Column('question', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('answer', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_faqs_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_faqs')),
    sa.UniqueConstraint('slug', name=op.f('uq_faqs_slug'))
    )
    op.create_index(op.f('ix_faqs_category'), 'faqs', ['category'], unique=False)
    op.create_index(op.f('ix_faqs_workflow_status'), 'faqs', ['workflow_status'], unique=False)
    op.create_table('historical_events',
    sa.Column('date_text', sa.String(length=64), nullable=True),
    sa.Column('date_from', sa.Date(), nullable=True),
    sa.Column('date_to', sa.Date(), nullable=True),
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('description', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('theme', sa.String(length=128), nullable=True),
    sa.Column('place', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('lat', sa.Numeric(precision=9, scale=6), nullable=True),
    sa.Column('lng', sa.Numeric(precision=9, scale=6), nullable=True),
    sa.Column('sources', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_historical_events_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_historical_events')),
    sa.UniqueConstraint('slug', name=op.f('uq_historical_events_slug'))
    )
    op.create_index(op.f('ix_historical_events_date_from'), 'historical_events', ['date_from'], unique=False)
    op.create_index(op.f('ix_historical_events_theme'), 'historical_events', ['theme'], unique=False)
    op.create_index(op.f('ix_historical_events_workflow_status'), 'historical_events', ['workflow_status'], unique=False)
    op.create_table('memorial_dates',
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('month', sa.Integer(), nullable=False),
    sa.Column('day', sa.Integer(), nullable=True),
    sa.Column('event_year', sa.Integer(), nullable=True),
    sa.Column('date_text', sa.String(length=64), nullable=True),
    sa.Column('text', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('related', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_memorial_dates_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_memorial_dates')),
    sa.UniqueConstraint('slug', name=op.f('uq_memorial_dates_slug'))
    )
    op.create_index(op.f('ix_memorial_dates_workflow_status'), 'memorial_dates', ['workflow_status'], unique=False)
    op.create_index(op.f('ix_memorial_dates_year'), 'memorial_dates', ['year'], unique=False)
    op.create_table('notifications',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('kind', sa.String(length=64), nullable=False),
    sa.Column('message', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('object_type', sa.String(length=64), nullable=True),
    sa.Column('object_id', sa.Uuid(), nullable=True),
    sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_notifications_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_notifications'))
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
    op.create_table('pages',
    sa.Column('key', sa.String(length=128), nullable=False),
    sa.Column('section', sa.String(length=64), nullable=True),
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('body', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('seo_title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('seo_description', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('seo_keywords', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_pages_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_pages')),
    sa.UniqueConstraint('key', name=op.f('uq_pages_key')),
    sa.UniqueConstraint('slug', name=op.f('uq_pages_slug'))
    )
    op.create_index(op.f('ix_pages_section'), 'pages', ['section'], unique=False)
    op.create_index(op.f('ix_pages_workflow_status'), 'pages', ['workflow_status'], unique=False)
    op.create_table('role_permissions',
    sa.Column('role_id', sa.UUID(), nullable=False),
    sa.Column('permission_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], name=op.f('fk_role_permissions_permission_id_permissions'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_role_permissions_role_id_roles'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('role_id', 'permission_id', name=op.f('pk_role_permissions'))
    )
    op.create_table('site_settings',
    sa.Column('key', sa.String(length=128), nullable=False),
    sa.Column('value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_by', sa.UUID(), nullable=True),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_site_settings_updated_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('key', name=op.f('pk_site_settings'))
    )
    op.create_table('tags',
    sa.Column('name', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_tags_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tags')),
    sa.UniqueConstraint('slug', name=op.f('uq_tags_slug'))
    )
    op.create_index(op.f('ix_tags_workflow_status'), 'tags', ['workflow_status'], unique=False)
    op.create_table('user_roles',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('role_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_user_roles_role_id_roles'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_roles_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', 'role_id', name=op.f('pk_user_roles'))
    )
    op.create_table('workflow_history',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('object_type', sa.String(length=64), nullable=False),
    sa.Column('object_id', sa.Uuid(), nullable=False),
    sa.Column('from_status', sa.String(length=32), nullable=True),
    sa.Column('to_status', sa.String(length=32), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_workflow_history_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_workflow_history'))
    )
    op.create_index('ix_workflow_history_object', 'workflow_history', ['object_type', 'object_id'], unique=False)
    op.create_table('collections',
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('theme', sa.String(length=128), nullable=True),
    sa.Column('period', sa.String(length=64), nullable=True),
    sa.Column('description', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('cover_file_id', sa.UUID(), nullable=True),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['cover_file_id'], ['digital_files.id'], name=op.f('fk_collections_cover_file_id_digital_files'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_collections_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_collections')),
    sa.UniqueConstraint('slug', name=op.f('uq_collections_slug'))
    )
    op.create_index(op.f('ix_collections_theme'), 'collections', ['theme'], unique=False)
    op.create_index(op.f('ix_collections_workflow_status'), 'collections', ['workflow_status'], unique=False)
    op.create_table('exhibitions',
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('theme', sa.String(length=128), nullable=True),
    sa.Column('period', sa.String(length=64), nullable=True),
    sa.Column('intro', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('cover_file_id', sa.UUID(), nullable=True),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['cover_file_id'], ['digital_files.id'], name=op.f('fk_exhibitions_cover_file_id_digital_files'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_exhibitions_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_exhibitions')),
    sa.UniqueConstraint('slug', name=op.f('uq_exhibitions_slug'))
    )
    op.create_index(op.f('ix_exhibitions_theme'), 'exhibitions', ['theme'], unique=False)
    op.create_index(op.f('ix_exhibitions_workflow_status'), 'exhibitions', ['workflow_status'], unique=False)
    op.create_table('funds',
    sa.Column('number', sa.String(length=64), nullable=False),
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('type', sa.Enum('organization', 'personal', 'party', 'newspaper', name='fund_type', native_enum=False, create_constraint=True, length=32), nullable=False),
    sa.Column('dates_from', sa.Integer(), nullable=True),
    sa.Column('dates_to', sa.Integer(), nullable=True),
    sa.Column('branch_id', sa.UUID(), nullable=True),
    sa.Column('annotation', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], name=op.f('fk_funds_branch_id_branches'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_funds_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_funds')),
    sa.UniqueConstraint('slug', name=op.f('uq_funds_slug'))
    )
    op.create_index(op.f('ix_funds_branch_id'), 'funds', ['branch_id'], unique=False)
    op.create_index(op.f('ix_funds_number'), 'funds', ['number'], unique=False)
    op.create_index(op.f('ix_funds_type'), 'funds', ['type'], unique=False)
    op.create_index(op.f('ix_funds_workflow_status'), 'funds', ['workflow_status'], unique=False)
    op.create_table('legal_acts',
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('number', sa.String(length=64), nullable=True),
    sa.Column('date', sa.Date(), nullable=True),
    sa.Column('issuer', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('status', sa.Enum('active', 'amended', 'expired', name='legal_act_status', native_enum=False, create_constraint=True, length=32), server_default='active', nullable=False),
    sa.Column('adilet_url', sa.String(length=1024), nullable=True),
    sa.Column('file_id', sa.UUID(), nullable=True),
    sa.Column('actualized_at', sa.Date(), nullable=True),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_legal_acts_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['file_id'], ['digital_files.id'], name=op.f('fk_legal_acts_file_id_digital_files'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_legal_acts')),
    sa.UniqueConstraint('slug', name=op.f('uq_legal_acts_slug'))
    )
    op.create_index(op.f('ix_legal_acts_workflow_status'), 'legal_acts', ['workflow_status'], unique=False)
    op.create_table('news',
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('summary', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('body', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('category', sa.String(length=64), nullable=True),
    sa.Column('cover_file_id', sa.UUID(), nullable=True),
    sa.Column('media', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('related', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['cover_file_id'], ['digital_files.id'], name=op.f('fk_news_cover_file_id_digital_files'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_news_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_news')),
    sa.UniqueConstraint('slug', name=op.f('uq_news_slug'))
    )
    op.create_index(op.f('ix_news_category'), 'news', ['category'], unique=False)
    op.create_index(op.f('ix_news_published_at'), 'news', ['published_at'], unique=False)
    op.create_index(op.f('ix_news_workflow_status'), 'news', ['workflow_status'], unique=False)
    op.create_table('persons',
    sa.Column('name', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('birth_year', sa.Integer(), nullable=True),
    sa.Column('death_year', sa.Integer(), nullable=True),
    sa.Column('years_text', sa.String(length=64), nullable=True),
    sa.Column('bio', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('photo_file_id', sa.UUID(), nullable=True),
    sa.Column('sources', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_persons_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['photo_file_id'], ['digital_files.id'], name=op.f('fk_persons_photo_file_id_digital_files'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_persons')),
    sa.UniqueConstraint('slug', name=op.f('uq_persons_slug'))
    )
    op.create_index(op.f('ix_persons_workflow_status'), 'persons', ['workflow_status'], unique=False)
    op.create_table('collection_items',
    sa.Column('collection_id', sa.UUID(), nullable=False),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.Column('item_type', sa.String(length=32), nullable=False),
    sa.Column('item_id', sa.Uuid(), nullable=False),
    sa.Column('note', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['collection_id'], ['collections.id'], name=op.f('fk_collection_items_collection_id_collections'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_collection_items'))
    )
    op.create_index(op.f('ix_collection_items_collection_id'), 'collection_items', ['collection_id'], unique=False)
    op.create_index('ix_collection_items_item', 'collection_items', ['item_type', 'item_id'], unique=False)
    op.create_table('inventories',
    sa.Column('fund_id', sa.UUID(), nullable=False),
    sa.Column('number', sa.String(length=64), nullable=False),
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('dates_text', sa.String(length=255), nullable=True),
    sa.Column('dates_from', sa.Integer(), nullable=True),
    sa.Column('dates_to', sa.Integer(), nullable=True),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_inventories_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['fund_id'], ['funds.id'], name=op.f('fk_inventories_fund_id_funds'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_inventories')),
    sa.UniqueConstraint('fund_id', 'number', name=op.f('uq_inventories_fund_id_number')),
    sa.UniqueConstraint('slug', name=op.f('uq_inventories_slug'))
    )
    op.create_index(op.f('ix_inventories_fund_id'), 'inventories', ['fund_id'], unique=False)
    op.create_index(op.f('ix_inventories_workflow_status'), 'inventories', ['workflow_status'], unique=False)
    op.create_table('price_list_items',
    sa.Column('name', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('unit', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('price', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('note', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('act_ref', sa.String(length=255), nullable=True),
    sa.Column('legal_act_id', sa.UUID(), nullable=True),
    sa.Column('actualized_at', sa.Date(), nullable=True),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_price_list_items_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['legal_act_id'], ['legal_acts.id'], name=op.f('fk_price_list_items_legal_act_id_legal_acts'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_price_list_items')),
    sa.UniqueConstraint('slug', name=op.f('uq_price_list_items_slug'))
    )
    op.create_index(op.f('ix_price_list_items_workflow_status'), 'price_list_items', ['workflow_status'], unique=False)
    op.create_table('cases',
    sa.Column('inventory_id', sa.UUID(), nullable=False),
    sa.Column('number', sa.String(length=64), nullable=False),
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('dates_text', sa.String(length=255), nullable=True),
    sa.Column('dates_from', sa.Integer(), nullable=True),
    sa.Column('dates_to', sa.Integer(), nullable=True),
    sa.Column('sheets_count', sa.Integer(), nullable=True),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_cases_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['inventory_id'], ['inventories.id'], name=op.f('fk_cases_inventory_id_inventories'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_cases')),
    sa.UniqueConstraint('inventory_id', 'number', name=op.f('uq_cases_inventory_id_number')),
    sa.UniqueConstraint('slug', name=op.f('uq_cases_slug'))
    )
    op.create_index(op.f('ix_cases_inventory_id'), 'cases', ['inventory_id'], unique=False)
    op.create_index(op.f('ix_cases_workflow_status'), 'cases', ['workflow_status'], unique=False)
    op.create_table('documents',
    sa.Column('archive_code', sa.String(length=255), nullable=True),
    sa.Column('case_id', sa.UUID(), nullable=True),
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('date_text', sa.String(length=255), nullable=True),
    sa.Column('date_from', sa.Date(), nullable=True),
    sa.Column('date_to', sa.Date(), nullable=True),
    sa.Column('period', sa.String(length=64), nullable=True),
    sa.Column('doc_type', sa.String(length=64), nullable=True),
    sa.Column('language', sa.String(length=32), nullable=True),
    sa.Column('authors', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('places', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('historical_note', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('summary', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('sheets_count', sa.Integer(), nullable=True),
    sa.Column('storage_location', sa.String(length=255), nullable=True),
    sa.Column('description_status', sa.Enum('public', 'do_not_publish', 'needs_review', name='description_status', native_enum=False, create_constraint=True, length=32), server_default='needs_review', nullable=False),
    sa.Column('file_access', sa.Enum('open', 'restricted', 'closed', 'needs_review', name='file_access', native_enum=False, create_constraint=True, length=32), server_default='needs_review', nullable=False),
    sa.Column('access_conditions', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('has_digital_copy', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('branch_id', sa.UUID(), nullable=True),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], name=op.f('fk_documents_branch_id_branches'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['case_id'], ['cases.id'], name=op.f('fk_documents_case_id_cases'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_documents_created_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_documents')),
    sa.UniqueConstraint('archive_code', name=op.f('uq_documents_archive_code')),
    sa.UniqueConstraint('slug', name=op.f('uq_documents_slug'))
    )
    op.create_index('ix_documents_archive_code_trgm', 'documents', ['archive_code'], unique=False, postgresql_using='gin', postgresql_ops={'archive_code': 'gin_trgm_ops'})
    op.create_index(op.f('ix_documents_branch_id'), 'documents', ['branch_id'], unique=False)
    op.create_index(op.f('ix_documents_case_id'), 'documents', ['case_id'], unique=False)
    op.create_index(op.f('ix_documents_date_from'), 'documents', ['date_from'], unique=False)
    op.create_index(op.f('ix_documents_description_status'), 'documents', ['description_status'], unique=False)
    op.create_index(op.f('ix_documents_doc_type'), 'documents', ['doc_type'], unique=False)
    op.create_index(op.f('ix_documents_period'), 'documents', ['period'], unique=False)
    op.create_index(op.f('ix_documents_workflow_status'), 'documents', ['workflow_status'], unique=False)
    op.create_table('document_categories',
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('category_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], name=op.f('fk_document_categories_category_id_categories'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name=op.f('fk_document_categories_document_id_documents'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('document_id', 'category_id', name=op.f('pk_document_categories'))
    )
    op.create_table('document_tags',
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.Column('tag_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name=op.f('fk_document_tags_document_id_documents'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], name=op.f('fk_document_tags_tag_id_tags'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('document_id', 'tag_id', name=op.f('pk_document_tags'))
    )
    op.create_table('event_documents',
    sa.Column('event_id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name=op.f('fk_event_documents_document_id_documents'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['event_id'], ['historical_events.id'], name=op.f('fk_event_documents_event_id_historical_events'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('event_id', 'document_id', name=op.f('pk_event_documents'))
    )
    op.create_table('exhibits',
    sa.Column('exhibition_id', sa.UUID(), nullable=False),
    sa.Column('position', sa.Integer(), server_default='0', nullable=False),
    sa.Column('title', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('media_file_id', sa.UUID(), nullable=True),
    sa.Column('media_url', sa.String(length=1024), nullable=True),
    sa.Column('caption', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('source', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('archive_code', sa.String(length=255), nullable=True),
    sa.Column('document_id', sa.UUID(), nullable=True),
    sa.Column('fund_id', sa.UUID(), nullable=True),
    sa.Column('is_demo', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('slug', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('workflow_status', sa.Enum('draft', 'review', 'needs_changes', 'approved', 'published', 'archived', name='workflow_status', native_enum=False, create_constraint=True, length=32), server_default='draft', nullable=False),
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('translation_status', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_exhibits_created_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name=op.f('fk_exhibits_document_id_documents'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['exhibition_id'], ['exhibitions.id'], name=op.f('fk_exhibits_exhibition_id_exhibitions'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['fund_id'], ['funds.id'], name=op.f('fk_exhibits_fund_id_funds'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['media_file_id'], ['digital_files.id'], name=op.f('fk_exhibits_media_file_id_digital_files'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_exhibits')),
    sa.UniqueConstraint('slug', name=op.f('uq_exhibits_slug'))
    )
    op.create_index(op.f('ix_exhibits_document_id'), 'exhibits', ['document_id'], unique=False)
    op.create_index(op.f('ix_exhibits_exhibition_id'), 'exhibits', ['exhibition_id'], unique=False)
    op.create_index(op.f('ix_exhibits_workflow_status'), 'exhibits', ['workflow_status'], unique=False)
    op.create_table('person_documents',
    sa.Column('person_id', sa.UUID(), nullable=False),
    sa.Column('document_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name=op.f('fk_person_documents_document_id_documents'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['person_id'], ['persons.id'], name=op.f('fk_person_documents_person_id_persons'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('person_id', 'document_id', name=op.f('pk_person_documents'))
    )

    # FKs that close the users <-> branches <-> digital_files cycle (use_alter in models).
    op.create_foreign_key(
        op.f("fk_users_branch_id_branches"), "users", "branches", ["branch_id"], ["id"], ondelete="SET NULL"
    )
    op.create_foreign_key(
        op.f("fk_branches_photo_file_id_digital_files"),
        "branches",
        "digital_files",
        ["photo_file_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_branches_photo_file_id_digital_files"), "branches", type_="foreignkey")
    op.drop_constraint(op.f("fk_users_branch_id_branches"), "users", type_="foreignkey")
    op.drop_table('person_documents')
    op.drop_index(op.f('ix_exhibits_workflow_status'), table_name='exhibits')
    op.drop_index(op.f('ix_exhibits_exhibition_id'), table_name='exhibits')
    op.drop_index(op.f('ix_exhibits_document_id'), table_name='exhibits')
    op.drop_table('exhibits')
    op.drop_table('event_documents')
    op.drop_table('document_tags')
    op.drop_table('document_categories')
    op.drop_index(op.f('ix_documents_workflow_status'), table_name='documents')
    op.drop_index(op.f('ix_documents_period'), table_name='documents')
    op.drop_index(op.f('ix_documents_doc_type'), table_name='documents')
    op.drop_index(op.f('ix_documents_description_status'), table_name='documents')
    op.drop_index(op.f('ix_documents_date_from'), table_name='documents')
    op.drop_index(op.f('ix_documents_case_id'), table_name='documents')
    op.drop_index(op.f('ix_documents_branch_id'), table_name='documents')
    op.drop_index('ix_documents_archive_code_trgm', table_name='documents', postgresql_using='gin', postgresql_ops={'archive_code': 'gin_trgm_ops'})
    op.drop_table('documents')
    op.drop_index(op.f('ix_cases_workflow_status'), table_name='cases')
    op.drop_index(op.f('ix_cases_inventory_id'), table_name='cases')
    op.drop_table('cases')
    op.drop_index(op.f('ix_price_list_items_workflow_status'), table_name='price_list_items')
    op.drop_table('price_list_items')
    op.drop_index(op.f('ix_inventories_workflow_status'), table_name='inventories')
    op.drop_index(op.f('ix_inventories_fund_id'), table_name='inventories')
    op.drop_table('inventories')
    op.drop_index('ix_collection_items_item', table_name='collection_items')
    op.drop_index(op.f('ix_collection_items_collection_id'), table_name='collection_items')
    op.drop_table('collection_items')
    op.drop_index(op.f('ix_persons_workflow_status'), table_name='persons')
    op.drop_table('persons')
    op.drop_index(op.f('ix_news_workflow_status'), table_name='news')
    op.drop_index(op.f('ix_news_published_at'), table_name='news')
    op.drop_index(op.f('ix_news_category'), table_name='news')
    op.drop_table('news')
    op.drop_index(op.f('ix_legal_acts_workflow_status'), table_name='legal_acts')
    op.drop_table('legal_acts')
    op.drop_index(op.f('ix_funds_workflow_status'), table_name='funds')
    op.drop_index(op.f('ix_funds_type'), table_name='funds')
    op.drop_index(op.f('ix_funds_number'), table_name='funds')
    op.drop_index(op.f('ix_funds_branch_id'), table_name='funds')
    op.drop_table('funds')
    op.drop_index(op.f('ix_exhibitions_workflow_status'), table_name='exhibitions')
    op.drop_index(op.f('ix_exhibitions_theme'), table_name='exhibitions')
    op.drop_table('exhibitions')
    op.drop_index(op.f('ix_collections_workflow_status'), table_name='collections')
    op.drop_index(op.f('ix_collections_theme'), table_name='collections')
    op.drop_table('collections')
    op.drop_index('ix_workflow_history_object', table_name='workflow_history')
    op.drop_table('workflow_history')
    op.drop_table('user_roles')
    op.drop_index(op.f('ix_tags_workflow_status'), table_name='tags')
    op.drop_table('tags')
    op.drop_table('site_settings')
    op.drop_table('role_permissions')
    op.drop_index(op.f('ix_pages_workflow_status'), table_name='pages')
    op.drop_index(op.f('ix_pages_section'), table_name='pages')
    op.drop_table('pages')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_memorial_dates_year'), table_name='memorial_dates')
    op.drop_index(op.f('ix_memorial_dates_workflow_status'), table_name='memorial_dates')
    op.drop_table('memorial_dates')
    op.drop_index(op.f('ix_historical_events_workflow_status'), table_name='historical_events')
    op.drop_index(op.f('ix_historical_events_theme'), table_name='historical_events')
    op.drop_index(op.f('ix_historical_events_date_from'), table_name='historical_events')
    op.drop_table('historical_events')
    op.drop_index(op.f('ix_faqs_workflow_status'), table_name='faqs')
    op.drop_index(op.f('ix_faqs_category'), table_name='faqs')
    op.drop_table('faqs')
    op.drop_index(op.f('ix_digital_files_sha256'), table_name='digital_files')
    op.drop_index('ix_digital_files_owner', table_name='digital_files')
    op.drop_table('digital_files')
    op.drop_index(op.f('ix_categories_workflow_status'), table_name='categories')
    op.drop_index(op.f('ix_categories_scope'), table_name='categories')
    op.drop_table('categories')
    op.drop_index(op.f('ix_branches_workflow_status'), table_name='branches')
    op.drop_table('branches')
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_ts'), table_name='audit_logs')
    op.drop_index('ix_audit_logs_object', table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action_type'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index(op.f('ix_users_branch_id'), table_name='users')
    op.drop_table('users')
    op.drop_index('ix_synonyms_terms', table_name='synonyms', postgresql_using='gin')
    op.drop_table('synonyms')
    op.drop_index(op.f('ix_search_logs_zero_result'), table_name='search_logs')
    op.drop_index(op.f('ix_search_logs_ts'), table_name='search_logs')
    op.drop_table('search_logs')
    op.drop_index('ix_search_entries_tsv', table_name='search_entries', postgresql_using='gin')
    op.drop_index('ix_search_entries_title_trgm', table_name='search_entries', postgresql_using='gin', postgresql_ops={'title': 'gin_trgm_ops'})
    op.drop_index(op.f('ix_search_entries_object_type'), table_name='search_entries')
    op.drop_index(op.f('ix_search_entries_object_id'), table_name='search_entries')
    op.drop_index('ix_search_entries_embedding', table_name='search_entries', postgresql_using='hnsw', postgresql_ops={'embedding': 'vector_cosine_ops'})
    op.drop_table('search_entries')
    op.drop_table('roles')
    op.drop_table('permissions')
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
    op.execute("DROP EXTENSION IF EXISTS vector")
