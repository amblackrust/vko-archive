#!/usr/bin/env bash
# E2E (PLAN T7.7): отдельная БД vko_archive_e2e, backend :8201, frontend :3201 (сборка в .next-e2e).
# Весь прогон идёт под flock, серверы и БД убираются в trap. Запуск: npm run e2e [-- <аргументы playwright>].
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Общий flock: параллельные прогоны (и другие сборки на этих портах) ждут друг друга. Путь задаётся E2E_LOCK.
LOCK="${E2E_LOCK:-${TMPDIR:-/tmp}/vko-archive-e2e.lock}"
API_PORT=8201
WEB_PORT=3201
E2E_DB=vko_archive_e2e
export E2E_DEMO_PASSWORD="${E2E_DEMO_PASSWORD:-Demo-Pass-2026!}"

mkdir -p "$(dirname "$LOCK")"
exec 9>"$LOCK"
flock 9

for port in $API_PORT $WEB_PORT; do
  if ss -ltn "sport = :$port" | grep -q LISTEN; then echo "port $port is busy" >&2; exit 1; fi
done

# next build с другим distDir переписывает tsconfig.json и next-env.d.ts - возвращаем как было.
SNAPSHOT="$(mktemp -d)"
cp "$ROOT/frontend/tsconfig.json" "$ROOT/frontend/next-env.d.ts" "$SNAPSHOT/"

PIDS=()
cleanup() {
  cp "$SNAPSHOT/tsconfig.json" "$SNAPSHOT/next-env.d.ts" "$ROOT/frontend/" 2>/dev/null || true
  rm -rf "$SNAPSHOT"
  # Серверы запущены через setsid: pid == id группы, гасим группу целиком (next оставляет next-server).
  for pid in "${PIDS[@]:-}"; do [ -n "$pid" ] && kill -TERM -- "-$pid" 2>/dev/null || true; done
  docker exec vko-archive-db psql -U "$DB_USER" -d postgres -qc "DROP DATABASE IF EXISTS $E2E_DB WITH (FORCE)" >/dev/null 2>&1 || true
}

# Параметры подключения берём из backend/.env (пароль в вывод не попадает).
BASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$ROOT/backend/.env")"
DB_USER="$(printf '%s' "$BASE_URL" | sed -E 's#^[^:]+://([^:]+):.*#\1#')"
trap cleanup EXIT INT TERM
export DATABASE_URL="${BASE_URL%/*}/$E2E_DB"

docker exec vko-archive-db psql -U "$DB_USER" -d postgres -qc "DROP DATABASE IF EXISTS $E2E_DB WITH (FORCE)"
docker exec vko-archive-db psql -U "$DB_USER" -d postgres -qc "CREATE DATABASE $E2E_DB"

cd "$ROOT/backend"
PY=.venv/bin/python
.venv/bin/alembic upgrade head >/dev/null 2>&1
$PY -m seed >/dev/null
# Поисковый индекс (+ эмбеддинги, если Ollama доступна; иначе только словный поиск).
$PY -m app.services.indexing >/dev/null 2>&1 || $PY -m app.services.indexing --no-embed >/dev/null 2>&1
# Демо-учётки §5 PLAN.md (пароль из E2E_DEMO_PASSWORD / docs/DEMO_SCRIPT.md, не логируется).
VKO_USER_PASSWORD="$E2E_DEMO_PASSWORD" $PY - <<'PYEOF' >/dev/null
from sqlalchemy import select
from app.cli import create_user
from app.db import get_sessionmaker
from app.models import Branch
from app.models.enums import RoleCode
import os
with get_sessionmaker()() as s:
    ridder = s.scalar(select(Branch.id).where(Branch.slug == "branch-ridder"))
    other = s.scalar(select(Branch.id).where(Branch.slug == "branch-altai"))
assert ridder and other
pw = os.environ["VKO_USER_PASSWORD"]
rows = [
    ("superadmin@demo.kz", RoleCode.SUPER_ADMIN, None), ("siteadmin@demo.kz", RoleCode.SITE_ADMIN, None),
    ("editor@demo.kz", RoleCode.EDITOR, None), ("archivist@demo.kz", RoleCode.ARCHIVIST, None),
    ("branch.ridder@demo.kz", RoleCode.BRANCH_ADMIN, ridder), ("moderator@demo.kz", RoleCode.MODERATOR, None),
    ("analyst@demo.kz", RoleCode.ANALYST, None),
    ("lockout@demo.kz", RoleCode.ANALYST, None),  # только для сценария блокировки после неверных паролей
]
for email, role, branch in rows:
    create_user(email, role, pw, full_name="ДЕМО " + role.value, branch_id=branch)
PYEOF

export CORS_ORIGINS="[\"http://localhost:$WEB_PORT\"]"
setsid $PY -m uvicorn app.main:app --port "$API_PORT" --no-access-log >"${TMPDIR:-/tmp}/e2e-api.log" 2>&1 9>&- &
PIDS+=($!)

cd "$ROOT/frontend"
export NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" NEXT_PUBLIC_SITE_URL="http://localhost:$WEB_PORT" NEXT_DIST_DIR=.next-e2e
npx next build >/dev/null
setsid npx next start -p "$WEB_PORT" >"${TMPDIR:-/tmp}/e2e-web.log" 2>&1 9>&- &
PIDS+=($!)

for url in "http://localhost:$API_PORT/api/health" "http://localhost:$WEB_PORT/ru"; do
  for _ in $(seq 1 60); do curl -fs -o /dev/null "$url" && break; sleep 1; done
  curl -fs -o /dev/null "$url"
done

export E2E_WEB="http://localhost:$WEB_PORT" E2E_API="http://localhost:$API_PORT"
if [ -n "${E2E_HOLD:-}" ]; then
  echo "E2E stack is up ($E2E_WEB, $E2E_API); stop it with Ctrl+C / kill"
  sleep infinity 9>&- & HOLD=$!; PIDS+=("$HOLD"); wait "$HOLD"
fi
npx playwright test "$@"
