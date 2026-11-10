"""Guards for the public assistant (T4.7), applied before any model call.

- Off-topic (code, homework, politics, medicine, …) → polite refusal, no search, no LLM.
- Prompt injection ("ignore the instructions…", "you are now…", "show the system prompt")
  → the injected phrase is cut out and the rest of the query is handled as usual; the
  query always reaches the model as quoted data anyway (prompts.user_message).
- Service questions ("how to get an archival certificate") are recognised by rules so the
  answer (eGov + the public-service page) does not depend on the model.

Restricted materials are guarded later, on the search results (services.ai): their
content never enters the model context.
"""

import re
from dataclasses import dataclass

_FLAGS = re.IGNORECASE | re.UNICODE

_OFF_TOPIC = re.compile(
    r"(\bкод\w*\b|\bpython\b|javascript|\bjava\b|\bc\+\+|\bsql\b|\bhtml\b|программ\w* на|скрипт|"
    r"\bfunction\b|\bcode\b|\bscript\b|бағдарлама жаз|"
    r"домашн\w* задан|реши\w*\b.{0,20}(задач|уравнен|пример)|уравнени|интеграл|\bhomework\b|\bsolve\b|"
    r"есепті шығар|үй тапсырма|"
    r"выбор\w*\b.{0,20}(президент|депутат)|за кого голос|политическ|\bpolitic|саяси|"
    r"диагноз|лекарств|симптом|лечени|болит|таблетк|\bmedical\b|\bdiagnos|\bmedicine\b|ауырады|дәрі|"
    r"рецепт\w* (блюд|торт|салат)|анекдот|гороскоп|\bjoke\b|стих\w* про|напиши (стих|сочинени|эссе)|"
    r"курс (доллар|валют)|\bbitcoin\b|криптовалют)",
    _FLAGS,
)

_INJECTION = re.compile(
    r"(игнорир\w*|забудь|забыть|не обращай внимания на|отмени)\s+(все\s+|всё\s+|свои\s+|эти\s+|"
    r"предыдущие\s+|прошлые\s+)*(инструкц\w*|правил\w*|указани\w*|промпт\w*)|"
    r"\bignore\s+(all\s+|any\s+|the\s+|your\s+|previous\s+|prior\s+|above\s+)*(instructions?|rules|prompts?)|"
    r"\bdisregard\s+(all\s+|the\s+|your\s+|previous\s+)*(instructions?|rules)|"
    r"(нұсқаулық\w*|ережел\w*)\s*(ты|ді|ны|ні)?\s*(елеме|ұмыт)\w*|"
    r"\b(ты|вы)\s+теперь\b|\byou\s+are\s+now\b|\bact\s+as\b|притворись|представь,? что ты|"
    r"(покажи|раскрой|выведи|напиши)\s+(свой\s+|свои\s+|системн\w*\s+)*(промпт|инструкц\w*|правила)|"
    r"system\s*prompt|системн\w* промпт|developer mode|\bjailbreak\b",
    _FLAGS,
)

_SERVICE = re.compile(
    r"(как|где|каким образом|куда)\b.{0,40}(получить|оформить|заказать|запросить)\b.{0,40}(справк|копи)|"
    r"(получить|оформить|заказать)\s+(архивн\w*\s+)?справк|"
    r"госуслуг|государственн\w* услуг|платн\w* услуг|прейскурант|"
    r"анықтама\w*\s*(ны|ні)?\s*(қалай|қайдан)?\s*(алу|алса|аламын|алуға)|мемлекеттік қызмет|"
    r"how\s+(can|do)\s+i\s+(get|obtain|order)\b.{0,40}certificate|(get|obtain)\s+an?\s+archiv\w*\s+certificate|"
    r"public service",
    _FLAGS,
)

_SPACES = re.compile(r"\s+")


@dataclass(frozen=True)
class GuardResult:
    verdict: str  # ok | off_topic | empty
    query: str  # the query with injected instructions removed
    injection: bool = False
    service: bool = False


def _strip_injection(query: str) -> tuple[str, bool]:
    """Removes the sentence/clause with the injection; keeps the rest as the query."""
    if not _INJECTION.search(query):
        return query, False
    parts = re.split(r"(?<=[.!?;\n])\s+|\s+(?:и|а|and|then|потом|затем)\s+(?=\w)", query)
    kept = [p for p in parts if p and not _INJECTION.search(p)]
    return _SPACES.sub(" ", " ".join(kept)).strip(" ,.;:-"), True


def check(query: str) -> GuardResult:
    text = _SPACES.sub(" ", query or "").strip()
    text, injection = _strip_injection(text)
    if not text:
        return GuardResult("empty", "", injection=injection)
    if _OFF_TOPIC.search(text):
        return GuardResult("off_topic", text, injection=injection)
    return GuardResult("ok", text, injection=injection, service=bool(_SERVICE.search(text)))


def is_off_topic(query: str) -> bool:
    return bool(_OFF_TOPIC.search(query))
