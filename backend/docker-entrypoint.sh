#!/bin/sh
# Prepare the database (migrations, demo content, demo accounts), then serve the API.
set -e
python -m seed.bootstrap
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log
