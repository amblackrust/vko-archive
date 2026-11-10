BACKEND_VENV := backend/.venv
PY := $(BACKEND_VENV)/bin/python

.PHONY: dev env db-up db-down backend-install migrate backend-dev frontend-install frontend-dev test

## One command: env files, database, deps, migrations, then backend + frontend in parallel.
dev: env db-up backend-install migrate
	$(MAKE) -j2 backend-dev frontend-dev

## Create .env files from the examples (only if missing) with a random DB password.
## Existing files are never overwritten; fails if one still has the example password.
env:
	@if [ ! -f .env ]; then \
		pw=$$(python3 -c 'import secrets; print(secrets.token_hex(24))') && \
		sed "s/^POSTGRES_PASSWORD=change_me$$/POSTGRES_PASSWORD=$$pw/" .env.example > .env && \
		echo "created .env with a random POSTGRES_PASSWORD"; \
	fi
	@if [ ! -f backend/.env ]; then \
		pw=$$(sed -n 's/^POSTGRES_PASSWORD=//p' .env) && \
		jwt=$$(python3 -c 'import secrets; print(secrets.token_hex(32))') && \
		sed -e "s/:change_me@/:$$pw@/" -e "s/^JWT_SECRET=change_me_jwt_secret$$/JWT_SECRET=$$jwt/" \
			backend/.env.example > backend/.env && \
		echo "created backend/.env (password taken from .env, random JWT_SECRET)"; \
	fi
	@if grep -q change_me .env backend/.env; then \
		echo "error: .env or backend/.env still uses the example password change_me" >&2; exit 1; \
	fi

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
