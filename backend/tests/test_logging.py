import io
import json
import logging
import re
import sys

import pytest
from fastapi.testclient import TestClient

from app.logging_config import StructuredFormatter, mask_sensitive
from app.main import app


def test_mask_sensitive_hides_secrets_and_personal_data():
    text = (
        'login password=Qwerty123 token: abc.def.ghi "api_key": "sk-live-1" '
        "Authorization: Bearer eyJhbGciOi.payload.sig email=user@example.org iin 870101300123"
    )
    masked = mask_sensitive(text)
    for leaked in ("Qwerty123", "abc.def.ghi", "sk-live-1", "eyJhbGciOi", "user@example.org", "870101300123"):
        assert leaked not in masked
    assert "password=***" in masked


def test_mask_sensitive_keeps_ordinary_text():
    assert mask_sensitive("GET /api/branches 200 3.1ms") == "GET /api/branches 200 3.1ms"


def test_structured_formatter_masks_message_and_traceback():
    try:
        raise ValueError("bad value token=TOP-SECRET-VALUE")
    except ValueError:
        record = logging.LogRecord(
            "app.test", logging.ERROR, __file__, 1, "login failed password=HUNTER2", None, sys.exc_info()
        )
    line = StructuredFormatter().format(record)
    entry = json.loads(line)
    assert entry["level"] == "ERROR" and entry["logger"] == "app.test"
    assert "HUNTER2" not in line and "TOP-SECRET-VALUE" not in line
    assert "ValueError" in entry["exc"]


def test_request_log_and_headers_do_not_leak_secrets():
    # Проверяем уже отформатированную строку, как она уйдёт в stderr: там работает маска.
    buffer = io.StringIO()
    handler = logging.StreamHandler(buffer)
    handler.setFormatter(StructuredFormatter())
    root = logging.getLogger()
    root.addHandler(handler)
    try:
        response = TestClient(app).get(
            "/api/no-such-route",
            params={"password": "QUERY-SECRET-1", "q": "поиск по фамилии"},
            headers={
                "Authorization": "Bearer HEADER-SECRET-2",
                "Cookie": "vko_session=COOKIE-SECRET-3",
            },
        )
    finally:
        root.removeHandler(handler)
    assert response.status_code == 404
    logged = buffer.getvalue()
    assert '"msg": "GET /api/no-such-route 404' in logged
    for secret in ("QUERY-SECRET-1", "HEADER-SECRET-2", "COOKIE-SECRET-3", "поиск по фамилии"):
        assert secret not in logged


def test_request_id_is_echoed_or_generated():
    client = TestClient(app)
    echoed = client.get("/api/no-such-route", headers={"X-Request-ID": "trace-42.a"})
    assert echoed.headers["X-Request-ID"] == "trace-42.a"

    unsafe = client.get("/api/no-such-route", headers={"X-Request-ID": "bad id with spaces"})
    assert re.fullmatch(r"[0-9a-f]{32}", unsafe.headers["X-Request-ID"])
