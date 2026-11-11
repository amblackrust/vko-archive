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

# Only unambiguous markers of a non-archive task, with word boundaries: archive topics
# (political repressions, hospitals, manuscripts, «программа съезда», «код фонда») must
# pass. Borderline queries are left to the parser's `intent: off_topic`.
_OFF_TOPIC = re.compile(
    # programming
    r"\b(python|javascript|typescript|java|sql|php|golang)\b|\bc(\+\+|#)(?!\w)|"
    r"\b(напиши|написать|напишите)\s+(мне\s+)?(код|программу|скрипт|функцию)\b|"
    r"\bwrite\s+(me\s+)?(a\s+|an\s+|some\s+|the\s+)?(code|program|script|function)\b|"
    r"\b(бағдарлама|код)\s+жаз|"
    # homework
    r"\bреши\w*\b.{0,20}\b(задач|уравнени|пример)|\bдомашн\w*\s+задани|\bhomework\b|"
    r"\bsolve\s+(this\s+|the\s+|an?\s+|my\s+)?(equation|problem|task|integral)|"
    r"\bесеп\w*\s+шығар|\bүй\s+тапсырма|"
    # politics: advice whom to vote for (political history is an archive topic)
    r"\bза\s+кого\s+голосовать|\bwho\s+(should\s+i|to)\s+vote\b|\bкімге\s+дауыс\s+бер|"
    # medical advice (hospitals, treatment of the wounded etc. are archive topics)
    r"\b(как|чем)\s+(лечить|вылечить|лечиться)\b|"
    r"\bкак\w*\s+(лекарств\w*|таблетк\w*)\s+(пить|выпить|принимать|купить|мне)\b|\bпоставь\w*\s+(мне\s+)?диагноз|"
    r"\bwhat\s+(medicine|medication|pills?)\s+(should|can|do)\s+i\b|\bhow\s+(to|do\s+i|can\s+i)\s+(treat|cure)\b|"
    r"\bқандай\s+дәрі\s+іш|\bқалай\s+емде|"
    # entertainment and the like
    r"\bнапиши\w*\s+(мне\s+)?(стих|сочинени|эссе|рассказ)|\bwrite\s+(me\s+)?(a\s+|an\s+)?(poem|essay|joke)|"
    r"\btell\s+(me\s+)?a\s+joke|\bөлең\s+жаз|\bанекдот\w*|\bгороскоп\w*|"
    r"\bрецепт\w*\s+(блюд|торт|салат)|\bbitcoin\b|\bкриптовалют",
    _FLAGS,
)

_INJECTION = re.compile(
    r"(игнорир\w*|забудь|забыть|не обращай внимания на|отмени)\s+(все\s+|всё\s+|свои\s+|эти\s+|"
    r"предыдущие\s+|прошлые\s+)*(инструкц\w*|правил\w*|указани\w*|промпт\w*)|"
    r"\bignore\s+(all\s+|any\s+|the\s+|your\s+|previous\s+|prior\s+|above\s+)*(instructions?|rules|prompts?)|"
    r"\bdisregard\s+(all\s+|the\s+|your\s+|previous\s+)*(instructions?|rules)|"
    r"(нұсқаулық\w*|ережел\w*)\s*(ты|ді|ны|ні)?\s*(елеме|ұмыт)\w*|"
    r"\b(ты|вы)\s+теперь\b|\byou\s+are\s+now\b|"
    # «act as» only as a role command: at a sentence start or after «please/now/and».
    r"(?:^|[.!?;:]\s*|\b(?:please|now|and)\s+)act\s+as\s+(?:an?|my|if)\b|\bpretend\s+(?:to\s+be|you\s+are)\b|"
    r"притворись|представь,? что ты|"
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
_CYRILLIC = re.compile(r"[\u0400-\u04FF]")
_LATIN_WORD = re.compile(r"[a-z]{4,}", re.IGNORECASE)
_VOWELS = frozenset("aeiouy")
_KEYBOARD_ROWS = ("qwerty", "wertyu", "asdfg", "sdfgh", "dfghj", "fghjk", "ghjkl", "zxcvb", "xcvbn", "cvbnm", "qazwsx", "yuiop")
_CONSONANT_RUN = re.compile(r"[^aeiouy]{5,}", re.IGNORECASE)
_REPEATED = re.compile(r"(.)\1{2,}")


@dataclass(frozen=True)
class GuardResult:
    verdict: str  # ok | off_topic | empty
    query: str  # the query with injected instructions removed
    injection: bool = False
    service: bool = False
    # Latin keyboard mash with no archive meaning: answered «nothing found», not «cannot help».
    gibberish: bool = False


def _strip_injection(query: str) -> tuple[str, bool]:
    """Removes the sentence/clause with the injection; keeps the rest as the query."""
    if not _INJECTION.search(query):
        return query, False
    parts = re.split(r"(?<=[.!?;\n])\s+|\s+(?:и|а|and|then|потом|затем)\s+(?=\w)", query)
    kept = [p for p in parts if p and not _INJECTION.search(p)]
    return _SPACES.sub(" ", " ".join(kept)).strip(" ,.;:-"), True


def _gibberish_word(word: str) -> bool:
    word = word.lower()
    vowels = sum(ch in _VOWELS for ch in word)
    return (
        vowels == 0
        or vowels / len(word) < 0.2
        or bool(_CONSONANT_RUN.search(word))
        or bool(_REPEATED.search(word))
        or any(row in word for row in _KEYBOARD_ROWS)
    )


def is_gibberish(text: str) -> bool:
    """Only Latin letters and every word of 4+ letters looks like a keyboard mash («asdfghjk»,
    «qwerty zxcv»): no vowels, long consonant runs, repeated letters, keyboard rows.
    Text with Cyrillic, or with at least one plausible word, is never gibberish."""
    if _CYRILLIC.search(text):
        return False
    words = _LATIN_WORD.findall(text)
    return bool(words) and all(_gibberish_word(word) for word in words)


def check(query: str) -> GuardResult:
    text = _SPACES.sub(" ", query or "").strip()
    text, injection = _strip_injection(text)
    if not text:
        return GuardResult("empty", "", injection=injection)
    if _OFF_TOPIC.search(text):
        return GuardResult("off_topic", text, injection=injection)
    service = bool(_SERVICE.search(text))
    return GuardResult("ok", text, injection=injection, service=service, gibberish=not service and is_gibberish(text))


def is_off_topic(query: str) -> bool:
    return bool(_OFF_TOPIC.search(query))


_MARKER = re.compile(r"\s*\[S\d+\]")


def clean_history(history: list) -> list[tuple[str, str]]:
    """Dialog history from the client as (role, text) pairs safe to show the model as data.
    Injected instructions are cut out of every turn; user turns that are off-topic or empty
    are dropped; source markers are removed from assistant turns (they point to old cards)."""
    turns: list[tuple[str, str]] = []
    for turn in history:
        text = _SPACES.sub(" ", turn.text).strip()
        if turn.role == "user":
            result = check(text)
            text = result.query if result.verdict == "ok" else ""
        else:
            text = _strip_injection(_MARKER.sub("", text))[0]
        if text:
            turns.append((turn.role, text))
    return turns
