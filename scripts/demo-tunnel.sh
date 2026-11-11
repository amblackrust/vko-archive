#!/usr/bin/env bash
# Показ проекта по публичной ссылке: отдельная production-сборка сайта и backend на своих портах,
# снаружи — один адрес Cloudflare Quick Tunnel (сайт сам проксирует /api, см. frontend/next.config.ts).
# Рабочие dev-серверы (:3000/:3100, :8000) не затрагиваются; база — та же, что в backend/.env.
# Запуск: scripts/demo-tunnel.sh   Остановка: Ctrl+C.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${DEMO_API_PORT:-8300}"
WEB_PORT="${DEMO_WEB_PORT:-3300}"
LOG_DIR="${TMPDIR:-/tmp}"

command -v cloudflared >/dev/null || { echo "нужен cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2; exit 1; }
for port in $API_PORT $WEB_PORT; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "порт $port занят" >&2; exit 1; fi
done

# next build с другим distDir переписывает tsconfig.json и next-env.d.ts — возвращаем как было.
SNAPSHOT="$(mktemp -d)"
cp "$ROOT/frontend/tsconfig.json" "$ROOT/frontend/next-env.d.ts" "$SNAPSHOT/"
PIDS=()
cleanup() {
  cp "$SNAPSHOT/tsconfig.json" "$SNAPSHOT/next-env.d.ts" "$ROOT/frontend/" 2>/dev/null || true
  rm -rf "$SNAPSHOT"
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] || continue
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
  done
  for port in $API_PORT $WEB_PORT; do lsof -ti "tcp:$port" 2>/dev/null | xargs kill -TERM 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

# 1. Туннель: адрес выдаётся случайный, он нужен backend (CORS, ссылки в письмах) до запуска.
cloudflared tunnel --no-autoupdate --url "http://localhost:$WEB_PORT" >"$LOG_DIR/demo-tunnel.log" 2>&1 &
PIDS+=($!)
URL=""
for _ in $(seq 1 60); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/demo-tunnel.log" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
[ -n "$URL" ] || { echo "туннель не выдал адрес, см. $LOG_DIR/demo-tunnel.log" >&2; exit 1; }

# 2. Backend: тот же код и база, свой порт; публичный адрес разрешён как origin.
cd "$ROOT/backend"
CORS_ORIGINS="[\"$URL\"]" FRONTEND_URL="$URL" AI_RATE_LIMIT_PER_MINUTE="${AI_RATE_LIMIT_PER_MINUTE:-60}" \
  .venv/bin/python -m uvicorn app.main:app --port "$API_PORT" --no-access-log >"$LOG_DIR/demo-api.log" 2>&1 &
PIDS+=($!)

# 3. Сайт: production-сборка в режиме одного адреса (браузер ходит на /api того же домена).
cd "$ROOT/frontend"
export NEXT_PUBLIC_API_URL="" API_PROXY_TARGET="http://localhost:$API_PORT" NEXT_PUBLIC_SITE_URL="$URL" NEXT_DIST_DIR=.next-demo
echo "Собираю сайт для показа (1–2 минуты)…"
npx next build >"$LOG_DIR/demo-build.log" 2>&1 || { echo "сборка не удалась, см. $LOG_DIR/demo-build.log" >&2; exit 1; }
npx next start -p "$WEB_PORT" >"$LOG_DIR/demo-web.log" 2>&1 &
PIDS+=($!)

for url in "http://localhost:$API_PORT/api/health" "http://localhost:$WEB_PORT/ru"; do
  for _ in $(seq 1 60); do curl -fs -o /dev/null "$url" && break; sleep 1; done
  curl -fs -o /dev/null "$url" || { echo "не отвечает $url" >&2; exit 1; }
done

echo
echo "Сайт доступен по адресу: $URL/ru"
echo "Админка: $URL/ru/admin (учётки — docs/DEMO_SCRIPT.md)"
echo "Остановить показ: Ctrl+C"
wait "${PIDS[0]}"
