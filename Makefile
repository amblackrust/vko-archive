BACKEND_VENV := backend/.venv
PY := $(BACKEND_VENV)/bin/python

.PHONY: dev env db-up db-down backend-install migrate backend-dev frontend-install frontend-dev test

## One command: env files, database, deps, migrations, then backend + frontend in parallel.
dev: env db-up backend-install migrate
	$(MAKE) -j2 backend-dev frontend-dev

## Create .env files from the examples (only if missing). Change the password afterwards.
env:
	@test -f .env || cp .env.example .env
	@test -f backend/.env || cp backend/.env.example backend/.env

db-up:
	docker compose up -d --wait db

db-down:
	docker compose down

$(PY):
	python3 -m venv $(BACKEND_VENV)

backend-install: $(PY)
	$(PY) -m pip install -q -r backend/requirements.txt

migrate:
	cd backend && .venv/bin/alembic upgrade head

backend-dev:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm install && npm run dev

test:
	cd backend && .venv/bin/pytest -q
