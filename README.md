# Государственный архив ВКО — новый сайт

Прототип нового сайта Государственного архива Восточно-Казахстанской области
(хакатон Code Masters 9.0). План работ — `PLAN.md`, статус готовности — `READINESS.md`,
архитектурные решения — `docs/DECISIONS.md`.

## Стек

- Backend: Python 3.11+ (проверено на 3.12), FastAPI, SQLAlchemy 2, Alembic, Pydantic v2
- БД: PostgreSQL 16 + pgvector + pg_trgm (docker-образ `pgvector/pgvector:pg16`)
- ИИ: локальный Ollama (`qwen3.5:9b-q6k`, эмбеддинги `bge-m3`)
- Frontend: Next.js 15 + TypeScript + Tailwind + shadcn/ui + next-intl (каталог `frontend/`)

## Требования

Docker (с compose), Python 3.11+, Node.js 20+, `make`.
Для ИИ-функций — Ollama на `http://localhost:11434` с моделями:

```bash
ollama pull qwen3.5:9b-q6k
ollama pull bge-m3
```

Без Ollama сайт работает, `/api/health` показывает `ollama`/`embeddings` как `unavailable`.

## Быстрый старт

```bash
make dev
```

Команда создаёт `.env` и `backend/.env` из примеров (если их нет), поднимает PostgreSQL,
ставит зависимости backend, применяет миграции и запускает backend и frontend параллельно.
Перед первым запуском замените `change_me` на свой пароль в обоих `.env` (он должен совпадать).

## Пошагово

```bash
cp .env.example .env                    # пароль БД для docker compose
cp backend/.env.example backend/.env    # тот же пароль в DATABASE_URL / TEST_DATABASE_URL
docker compose up -d --wait db          # PostgreSQL + pgvector на localhost:5432

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head          # расширения vector, pg_trgm и все таблицы
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Frontend (в отдельном терминале):

```bash
cd frontend && npm install && npm run dev
```

## Порты

| Сервис | Порт |
|---|---|
| frontend | 3000 |
| backend (API, `/api/...`) | 8000 |
| PostgreSQL | 5432 (`POSTGRES_PORT` в `.env`) |
| Ollama (на хосте) | 11434 |

## Проверка

```bash
curl http://localhost:8000/api/health   # статусы db, ollama, embeddings
make test                               # pytest -q в backend/
```

Тесты используют реальную БД из docker compose: отдельную базу `TEST_DATABASE_URL`
(по умолчанию `vko_archive_test`), которая создаётся автоматически и мигрируется с нуля.

## Структура

```
backend/
  app/            main.py, config.py, db.py, deps.py
    models/       SQLAlchemy-модели (PLAN.md §2)
    schemas/      Pydantic-схемы
    repositories/ доступ к данным
    services/     бизнес-логика (authorize, workflow, search, ai, ...)
    routers/      public/ и admin/ API
    ai/           клиент Ollama, промпты, RAG, guards
  alembic/        миграции (схема меняется только новыми миграциями)
  seed/           наполнение из info/ + демо-данные
  storage/        мастер-копии и превью (не раздаются как статика)
  tests/
frontend/         Next.js
docs/             DECISIONS.md, handoff/ и прочая документация
info/             исходные материалы заказчика (только чтение)
```
