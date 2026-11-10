"""T4.1: Ollama client — request parameters, model choice, retry, degradation, think filter."""

import json

import httpx
import pytest

from app.ai import ollama_client
from app.ai.ollama_client import OllamaUnavailable
from app.config import get_settings


def _tags(*names: str) -> httpx.Response:
    return httpx.Response(200, json={"models": [{"name": n} for n in names]})


def _router(fake, models, chat):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return _tags(*models)
        return chat(request)

    fake.handler = handler


def test_chat_sends_required_parameters_and_strips_think(fake_ollama):
    settings = get_settings()
    _router(
        fake_ollama,
        [settings.ollama_model],
        lambda r: httpx.Response(200, json={"message": {"content": "<think>secret plan</think>Ответ"}}),
    )
    schema = {"type": "object"}
    assert ollama_client.chat([{"role": "user", "content": "q"}], settings, fmt=schema) == "Ответ"
    body = json.loads(fake_ollama.requests[-1].content)
    assert body["think"] is False
    assert body["keep_alive"] == "30m"
    assert body["stream"] is False
    assert body["format"] == schema
    assert body["model"] == settings.ollama_model
    assert body["options"]["temperature"] == 0.1
    assert body["options"]["num_ctx"] >= 8192


def test_fallback_model_and_missing_model(fake_ollama):
    settings = get_settings()
    _router(fake_ollama, [settings.ollama_fallback_model], lambda r: httpx.Response(200, json={"message": {"content": "ok"}}))
    assert ollama_client.chat_model(settings) == settings.ollama_fallback_model
    ollama_client.chat([{"role": "user", "content": "q"}], settings)
    assert json.loads(fake_ollama.requests[-1].content)["model"] == settings.ollama_fallback_model

    ollama_client.reset_state()
    _router(fake_ollama, ["bge-m3:latest"], lambda r: httpx.Response(500))
    with pytest.raises(OllamaUnavailable) as exc:
        ollama_client.chat([{"role": "user", "content": "q"}], settings)
    assert exc.value.reason == "model_missing"
    assert ollama_client.availability(settings) == ollama_client.Availability(False, "model_missing")


def test_retries_once_on_server_error(fake_ollama):
    settings = get_settings()
    calls = []

    def chat(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(503)
        return httpx.Response(200, json={"message": {"content": "второй раз"}})

    _router(fake_ollama, [settings.ollama_model], chat)
    assert ollama_client.chat([{"role": "user", "content": "q"}], settings) == "второй раз"
    assert len(calls) == 2


def test_failure_marks_unavailable_and_cools_down(fake_ollama):
    settings = get_settings()
    _router(fake_ollama, [settings.ollama_model], lambda r: httpx.Response(500))
    with pytest.raises(OllamaUnavailable):
        ollama_client.chat([{"role": "user", "content": "q"}], settings)
    chat_calls = [r for r in fake_ollama.requests if r.url.path == "/api/chat"]
    assert len(chat_calls) == 2  # one retry, not more
    before = len(fake_ollama.requests)
    assert ollama_client.availability(settings).available is False
    assert len(fake_ollama.requests) == before  # cooldown: Ollama is not asked again


def test_ollama_down_is_unavailable(fake_ollama):
    status = ollama_client.availability(get_settings())
    assert status == ollama_client.Availability(False, "ollama_unavailable")


def test_stream_filters_think_split_across_chunks(fake_ollama):
    settings = get_settings()
    pieces = ["<thi", "nk>скрыто</th", "ink>Пер", "вое. [S1]", ""]
    lines = "\n".join(
        json.dumps({"message": {"content": p}, "done": i == len(pieces) - 1}) for i, p in enumerate(pieces)
    )
    _router(fake_ollama, [settings.ollama_model], lambda r: httpx.Response(200, content=lines.encode()))
    text = "".join(ollama_client.chat_stream([{"role": "user", "content": "q"}], settings))
    assert text == "Первое. [S1]"
    assert json.loads(fake_ollama.requests[-1].content)["think"] is False


def test_strip_think_unclosed_block():
    assert ollama_client.strip_think("<think>рассуждение без конца") == ""
    assert ollama_client.strip_think("Да.<think>x</think> Нет.") == "Да. Нет."
