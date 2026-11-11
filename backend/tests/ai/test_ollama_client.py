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


def _chat_ok(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json={"message": {"content": "ok"}})


def test_num_predict_limits_generation(fake_ollama):
    settings = get_settings()
    _router(fake_ollama, [settings.ollama_model], _chat_ok)
    ollama_client.chat([{"role": "user", "content": "q"}], settings)
    assert json.loads(fake_ollama.requests[-1].content)["options"]["num_predict"] == settings.ollama_num_predict == 400


def test_model_without_structured_output_is_asked_for_json_in_the_prompt(fake_ollama):
    """A runner that answers 501 to `format` (MLX builds): the schema moves into the prompt, the JSON object is
    cut out of the free text, the model is remembered and Ollama is not marked as down."""
    settings = get_settings()

    def chat_handler(request: httpx.Request) -> httpx.Response:
        if "format" in json.loads(request.content):
            return httpx.Response(501, json={"error": "structured output is unavailable"})
        return httpx.Response(200, json={"message": {"content": 'Вот ответ:\n```json\n{"intent": "search"}\n```'}})

    _router(fake_ollama, [settings.ollama_model], chat_handler)
    schema = {"type": "object", "properties": {"intent": {"type": "string"}}}
    assert ollama_client.chat([{"role": "user", "content": "q"}], settings, fmt=schema) == '{"intent": "search"}'
    sent = json.loads(fake_ollama.requests[-1].content)
    assert "format" not in sent and '"intent"' in sent["messages"][-1]["content"]
    calls = len(fake_ollama.requests)
    assert ollama_client.chat([{"role": "user", "content": "q"}], settings, fmt=schema) == '{"intent": "search"}'
    assert len(fake_ollama.requests) == calls + 1  # no second 501 round trip
    assert ollama_client.availability(settings).available


def test_reasoning_only_model_gets_think_and_a_larger_budget(fake_ollama, monkeypatch):
    """OLLAMA_THINK: free text asks the model to reason (the reasoning comes back in a separate field);
    a JSON-constrained call still does not."""
    settings = get_settings()
    monkeypatch.setattr(settings, "ollama_think", True)
    _router(fake_ollama, [settings.ollama_model], _chat_ok)
    ollama_client.chat([{"role": "user", "content": "q"}], settings)
    free = json.loads(fake_ollama.requests[-1].content)
    assert free["think"] is True and free["options"]["num_predict"] == 400 + settings.ollama_think_tokens
    ollama_client.chat([{"role": "user", "content": "q"}], settings, fmt="json")
    constrained = json.loads(fake_ollama.requests[-1].content)
    assert constrained["think"] is False and constrained["options"]["num_predict"] == 400


@pytest.mark.parametrize(
    "fail",
    [
        lambda r: (_ for _ in ()).throw(httpx.ReadTimeout("slow", request=r)),
        lambda r: httpx.Response(400, json={"error": "bad request"}),
    ],
    ids=["read_timeout", "4xx"],
)
def test_read_timeout_and_4xx_no_retry_no_cooldown(fake_ollama, fail):
    settings = get_settings()
    _router(fake_ollama, [settings.ollama_model], fail)
    with pytest.raises(OllamaUnavailable):
        ollama_client.chat([{"role": "user", "content": "q"}], settings)
    assert len([r for r in fake_ollama.requests if r.url.path == "/api/chat"]) == 1
    assert ollama_client.availability(settings).available is True  # one slow/bad request ≠ Ollama down


def test_connect_error_retries_and_cools_down(fake_ollama):
    settings = get_settings()

    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    _router(fake_ollama, [settings.ollama_model], refuse)
    with pytest.raises(OllamaUnavailable):
        ollama_client.chat([{"role": "user", "content": "q"}], settings)
    assert len([r for r in fake_ollama.requests if r.url.path == "/api/chat"]) == 2
    assert ollama_client.availability(settings).available is False


def test_concurrent_generations_limited_fast_busy(fake_ollama):
    settings = get_settings().model_copy(update={"ai_max_concurrent_generations": 1})
    line = json.dumps({"message": {"content": "Текст."}, "done": True})
    _router(fake_ollama, [settings.ollama_model], lambda r: httpx.Response(200, content=line.encode()))
    stream = ollama_client.chat_stream([{"role": "user", "content": "q"}], settings)
    assert next(stream) == "Текст."  # holds the only slot
    with pytest.raises(OllamaUnavailable) as exc:
        ollama_client.chat([{"role": "user", "content": "q"}], settings)
    assert exc.value.reason == "busy"
    assert ollama_client.availability(settings).available is True  # busy is not a failure
    stream.close()  # the client went away: the slot is released
    assert ollama_client.chat([{"role": "user", "content": "q"}], settings) == "Текст."


def test_stream_error_line_mid_answer(fake_ollama):
    settings = get_settings()
    lines = "\n".join([
        json.dumps({"message": {"content": "Первое. "}, "done": False}),
        json.dumps({"error": "model runner crashed"}),
    ])
    _router(fake_ollama, [settings.ollama_model], lambda r: httpx.Response(200, content=lines.encode()))
    stream = ollama_client.chat_stream([{"role": "user", "content": "q"}], settings)
    assert next(stream) == "Первое. "
    with pytest.raises(OllamaUnavailable) as exc:
        next(stream)
    assert exc.value.reason == "bad_response"
    assert len([r for r in fake_ollama.requests if r.url.path == "/api/chat"]) == 1  # no repeat after the first token
