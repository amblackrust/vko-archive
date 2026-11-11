"""session revocation on logout, append-only audit log

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-11 12:00:00

`session_version` of users and visitors goes into every session token (claim `sev`);
logout increments it, so every token issued before is refused by the server.

audit_logs becomes append-only in the database: a trigger rejects UPDATE, DELETE and
TRUNCATE. The only update let through is the one the FK `ON DELETE SET NULL` makes when a
user row is deleted (user_id -> NULL, every other column unchanged).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0007'
down_revision: str | None = '0006'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('users', sa.Column('session_version', sa.Integer(), server_default='0', nullable=False))
    op.add_column('visitors', sa.Column('session_version', sa.Integer(), server_default='0', nullable=False))
    op.execute(
        """
        CREATE FUNCTION audit_logs_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'UPDATE' AND OLD.user_id IS NOT NULL AND NEW.user_id IS NULL
               AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
                RETURN NEW;  -- FK ON DELETE SET NULL of a deleted user
            END IF;
            RAISE EXCEPTION 'audit_logs is append-only (% rejected)', TG_OP
                USING ERRCODE = 'insufficient_privilege';
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs "
        "FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only()"
    )
    op.execute(
        "CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs "
        "FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs")
    op.execute("DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS audit_logs_append_only()")
    op.drop_column('visitors', 'session_version')
    op.drop_column('users', 'session_version')
