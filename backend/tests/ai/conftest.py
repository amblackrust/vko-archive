"""AI tests never reach a real Ollama: every HTTP call of `app.ai.ollama_client` goes to
`fake_ollama.handler` (default: connection refused). Tests set a handler or patch the
client functions directly."""

from collections.abc import Callable, Iterator

import httpx
import pytest

from app.ai import ollama_client
from app.services.rate_limit import ai_limiter
from tests.search.conftest import factory, storage  # noqa: F401  (fixtures)
from tests.admin.conftest import api, roles_ready  # noqa: F401  (fixtures)


class FakeOllama:
    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.handler: Callable[[httpx.Request], httpx.Response] = self._refuse

    @staticmethod
    def _refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.handler(request)


@pytest.fixture(autouse=True)
def fake_ollama(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeOllama]:
    fake = FakeOllama()
    monkeypatch.setattr(
        ollama_client,
        "_client",
        lambda settings, timeout: httpx.Client(base_url=settings.ollama_url, timeout=timeout, transport=httpx.MockTransport(fake)),
    )
    ollama_client.reset_state()
    ai_limiter.reset()
    yield fake
    ollama_client.reset_state()
    ai_limiter.reset()
