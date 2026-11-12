BACKEND_VENV := backend/.venv
PY := $(BACKEND_VENV)/bin/python

.PHONY: up down dev env db-up db-down backup backend-install migrate backend-dev frontend-install frontend-dev test

## One command: env files, database, deps, migrations, then backend.
dev: env db-up backend-install migrate
	$(MAKE) backend-dev

## Create .env files from the examples (only if missing): random database password and JWT secret.
## The demo accounts get the documented password Demo-Pass-2026!. Existing files are never overwritten.
env:
	@if [ ! -f .env ]; then \
		pw=$$(python3 -c 'import secrets; print(secrets.token_hex(24))') && \
		jwt=$$(python3 -c 'import secrets; print(secrets.token_hex(32))') && \
		sed -e "s/^POSTGRES_PASSWORD=change_me$$/POSTGRES_PASSWORD=$$pw/" \
			-e "s/^JWT_SECRET=change_me_jwt_secret$$/JWT_SECRET=$$jwt/" \
			-e "s/^DEMO_PASSWORD=change_me_demo_password$$/DEMO_PASSWORD=Demo-Pass-2026!/" \
			.env.example > .env && \
		echo "created .env (random POSTGRES_PASSWORD and JWT_SECRET, demo password Demo-Pass-2026!)"; \
	fi
	@if [ ! -f backend/.env ]; then \
		pw=$$(sed -n 's/^POSTGRES_PASSWORD=//p' .env) && \
		jwt=$$(sed -n 's/^JWT_SECRET=//p' .env) && \
		sed -e "s/:change_me@/:$$pw@/" -e "s/^JWT_SECRET=change_me_jwt_secret$$/JWT_SECRET=$$jwt/" \
			backend/.env.example > backend/.env && \
		echo "created backend/.env (same database password and JWT secret)"; \
	fi
	@if grep -q change_me .env backend/.env; then \
		echo "error: .env or backend/.env still uses a change_me placeholder" >&2; exit 1; \
	fi

## Whole stack in containers: database, Ollama with the models, API (migrations + demo data), site on :3000.
up: env
	docker compose up --build

down:
	docker compose down

db-up:
	docker compose up -d --wait db

db-down:
	docker compose down

## Database backup: pg_dump (custom format) into backups/; restore — see README.
## The dump is written to *.part first and renamed only if pg_dump succeeded.
backup:
	@mkdir -p backups
	@file=backups/vko_archive_$$(date +%Y%m%d_%H%M%S).dump; \
	docker compose exec -T db sh -c 'pg_dump -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -Fc' > "$$file.part" \
		&& mv "$$file.part" "$$file" && echo "backup: $$file"

$(PY):
	python3 -m venv $(BACKEND_VENV)

backend-install: $(PY)
	$(PY) -m pip install -q -r backend/requirements.txt

migrate:
	cd backend && .venv/bin/alembic upgrade head

backend-dev:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000 --no-access-log

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/pytest -q
