"""audit_logs trigger: user_id -> NULL only from the FK action

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-11 14:00:00

0007 let any UPDATE that only nulls user_id through, so a direct
`UPDATE audit_logs SET user_id = NULL` could detach entries from their author. The
FK `ON DELETE SET NULL` runs inside the referential-integrity trigger of `users`, so it is
recognised by pg_trigger_depth() > 1; a direct statement runs at depth 1 and is rejected.
"""
from collections.abc import Sequence

from alembic import op


revision: str = '0008'
down_revision: str | None = '0007'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _function(fk_only: bool) -> str:
    depth = "pg_trigger_depth() > 1 AND " if fk_only else ""
    return f"""
        CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'UPDATE' AND {depth}OLD.user_id IS NOT NULL AND NEW.user_id IS NULL
               AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
                RETURN NEW;  -- FK ON DELETE SET NULL of a deleted user
            END IF;
            RAISE EXCEPTION 'audit_logs is append-only (% rejected)', TG_OP
                USING ERRCODE = 'insufficient_privilege';
        END;
        $$
    """


def upgrade() -> None:
    op.execute(_function(fk_only=True))


def downgrade() -> None:
    op.execute(_function(fk_only=False))
