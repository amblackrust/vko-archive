"""Технические логи (T7.8): одна JSON-строка на запись, request id, маскирование секретов и ПДн.

В лог попадают только метод, путь (без query-строки), статус и время ответа. Тела запросов и ответов,
заголовки (Authorization, Cookie), query-строка (там может быть поисковый текст) и `extra`-поля
записей не выводятся. Маска применяется ко всему тексту записи, включая трейсбек.
"""

import contextvars
import json
import logging
import re
import time
import uuid
from datetime import UTC, datetime

from fastapi import Request
from fastapi.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"
# Входящий request id принимаем только в безопасном виде, иначе генерируем свой (защита от инъекций в лог).
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)

_LOG_HANDLER_MARK = "_vko_structured"

_SECRET_KEYS = (
    r"password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|session|csrf|jwt|access[_-]?key"
)
# key=value, key: value, "key": "value" — значение заменяем целиком.
_SECRET_ASSIGNMENT = re.compile(
    rf"(?i)(\b[\w-]*(?:{_SECRET_KEYS})[\w-]*[\"']?\s*[=:]\s*[\"']?)([^\s,;&\"'}}\]]+)"
)
_BEARER = re.compile(r"(?i)\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]+")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# ИИН: 12 цифр. Может совпасть с другим 12-значным номером — лучше лишняя маска, чем утечка.
_IIN = re.compile(r"(?<!\d)\d{12}(?!\d)")


def mask_sensitive(text: str) -> str:
    text = _BEARER.sub(r"\1 ***", text)  # раньше «key: value», иначе схема и токен разойдутся
    text = _SECRET_ASSIGNMENT.sub(r"\1***", text)
    text = _EMAIL.sub("***@***", text)
    return _IIN.sub("***", text)


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": mask_sensitive(record.getMessage()),
        }
        request_id = request_id_var.get()
        if request_id:
            entry["request_id"] = request_id
        if record.exc_info:
            entry["exc"] = mask_sensitive(self.formatException(record.exc_info))
        return json.dumps(entry, ensure_ascii=False)


def configure_logging(level: int = logging.INFO) -> None:
    """Идемпотентно заменяет только свой обработчик: чужие обработчики (pytest, uvicorn) не трогаем."""
    root = logging.getLogger()
    for handler in list(root.handlers):
        if getattr(handler, _LOG_HANDLER_MARK, False):
            root.removeHandler(handler)
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredFormatter())
    setattr(handler, _LOG_HANDLER_MARK, True)
    root.addHandler(handler)
    root.setLevel(level)
    # httpx пишет полный URL каждого исходящего запроса (с query-строкой): на уровне INFO это лишний риск утечки.
    logging.getLogger("httpx").setLevel(logging.WARNING)


_request_logger = logging.getLogger("app.request")


async def log_requests(request: Request, call_next) -> Response:
    incoming = request.headers.get(REQUEST_ID_HEADER)
    request_id = incoming if incoming and _SAFE_REQUEST_ID.match(incoming) else uuid.uuid4().hex
    token = request_id_var.set(request_id)
    started = time.perf_counter()
    status_code = 500  # остаётся 500, если обработчик упал необработанным исключением
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception:
        _request_logger.exception("%s %s failed", request.method, request.url.path)
        raise
    finally:
        duration_ms = (time.perf_counter() - started) * 1000
        _request_logger.info("%s %s %d %.1fms", request.method, request.url.path, status_code, duration_ms)
        request_id_var.reset(token)
    response.headers[REQUEST_ID_HEADER] = request_id
    return response
