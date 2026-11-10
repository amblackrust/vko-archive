"""RAG building blocks (T4.4): model context from server-checked items and the
post-check of the model's text.

The model sees each item as `[S1] type | title | code | date | …` and may cite items only
by these markers. Links and cards are built by the server (`AiSource`), never taken from
the model. The post-check removes from the answer every marker that is not in the
context, every archive code that is not a context item's code, URLs, site paths and UUIDs.
"""

import re
from collections.abc import Iterator
from dataclasses import dataclass, field

from app.schemas.ai import AiSource

MAX_ITEMS = 8
DESCRIPTION_CHARS = 300

_MARKER_LIST_RE = re.compile(r"[\[【]\s*S\d{1,3}(?:\s*[,;]\s*S?\d{1,3})*\s*[\]】]", re.IGNORECASE)
_MARKER_NUM_RE = re.compile(r"\d{1,3}")
_URL_RE = re.compile(
    r"https?://\S+|www\.\S+|"
    r"(?<![\w/])/(?:catalog|branches|exhibitions|news|pages|memory|about|services|api|files|contacts|kk|ru|en)"
    r"(?:/[\w\-./?=&%#]*)?",
    re.IGNORECASE,
)
_UUID_RE = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE)
# Archive codes (шифры): «Ф. 12, оп. 3, д. 45», «Ф.Д-1 Оп.1 Д.1 №1», kk «Қ. …», en «F. … Op. …».
_CODE_RE = re.compile(
    r"(?:ДЕМО\s+)?(?<!\w)(?:Ф|Қ|F|Fund)\s*\.?\s*(?:№\s*)?[\w\-]+\s*,?\s*"
    r"(?:(?:Оп|оп|Т|Op|op|Inv)\s*\.?\s*(?:№\s*)?[\w\-]+\s*,?\s*)?"
    r"(?:(?:Д|д|І|D|File)\s*\.?\s*(?:№\s*)?[\w\-]+\s*,?\s*)?"
    r"(?:(?:№|No\.?)\s*[\w\-]+)?",
)
_CODE_NORM_RE = re.compile(r"[\s,.]+")
_SPACES_RE = re.compile(r"[ \t]+")
_EMPTY_BRACKETS_RE = re.compile(r"\(\s*[,;]?\s*\)|\[\s*\]")
_SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([,.;:!?])")
# Words before a dot that do not end a sentence (parts of archive codes, «г.», «им.»).
_ABBREVIATIONS = frozenset("ф оп д л лл г гг им т қ і f op d p no inv демо".split())
_SENTENCE_END_RE = re.compile(r"[.!?…]+\s+(?=[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ«\"(\[])|\n+")
_WORD_BEFORE_RE = re.compile(r"(\w+)$")
_MEANINGFUL_RE = re.compile(r"\w{2,}")


@dataclass
class ContextItem:
    source: AiSource
    line: str  # without the "[S1] " prefix
    codes: list[str] = field(default_factory=list)  # other spellings of the item's code (funds)


@dataclass
class Context:
    items: list[ContextItem] = field(default_factory=list)

    @property
    def refs(self) -> dict[str, AiSource]:
        return {item.source.ref: item.source for item in self.items}

    @property
    def codes(self) -> list[str]:
        codes = [_norm_code(i.source.archive_code) for i in self.items if i.source.archive_code]
        return codes + [_norm_code(code) for i in self.items for code in i.codes]

    def text(self) -> str:
        return "\n".join(f"[{item.source.ref}] {item.line}" for item in self.items)


def field_line(*parts: str | None) -> str:
    return " | ".join(" ".join(p.split()) for p in parts if p and p.strip())


def shorten(text: str, limit: int = DESCRIPTION_CHARS) -> str:
    text = " ".join((text or "").split())
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + " …"


def _norm_code(code: str) -> str:
    code = re.sub(r"^ДЕМО\s+", "", code.strip(), flags=re.IGNORECASE)
    return _CODE_NORM_RE.sub("", code).lower()


def _known_code(candidate: str, codes: list[str]) -> bool:
    """A code from the context, or its fund/inventory/case prefix."""
    norm = _norm_code(candidate)
    return bool(norm) and any(code.startswith(norm) for code in codes)


def _markers(match: re.Match[str], refs: set[str], cited: list[str]) -> str:
    kept = []
    for number in _MARKER_NUM_RE.findall(match.group(0)):
        ref = f"S{int(number)}"
        if ref in refs:
            kept.append(f"[{ref}]")
            if ref not in cited:
                cited.append(ref)
    return " ".join(kept)


def sanitize(text: str, refs: set[str], codes: list[str], cited: list[str]) -> str:
    """Post-check of model text. Appends cited refs (in order) to `cited`."""
    text = _URL_RE.sub("", text)
    text = _UUID_RE.sub("", text)
    text = _CODE_RE.sub(lambda m: m.group(0) if _looks_unlike_code(m.group(0)) or _known_code(m.group(0), codes) else "", text)
    text = _MARKER_LIST_RE.sub(lambda m: _markers(m, refs, cited), text)
    text = _EMPTY_BRACKETS_RE.sub("", text)
    text = _SPACE_BEFORE_PUNCT_RE.sub(r"\1", text)
    return _SPACES_RE.sub(" ", text)


def _looks_unlike_code(fragment: str) -> bool:
    """`_CODE_RE` is loose (e.g. «Ф» alone, an English «F»); require a digit and an
    inventory/case/number part before treating the fragment as a code."""
    has_digit = any(ch.isdigit() for ch in fragment)
    has_part = bool(re.search(r"(Оп|оп|Т|Op|op|Inv|Д|д|І|D|File|№|No)\s*\.?", fragment[1:]))
    fund_ref = bool(re.match(r"(?:ДЕМО\s+)?(?:(?:Ф|Қ|F)\s*[.№]|Fund\b)", fragment))
    return not (has_digit and (has_part or fund_ref))


def is_empty(text: str) -> bool:
    without_markers = _MARKER_LIST_RE.sub("", text)
    return not _MEANINGFUL_RE.search(without_markers)


class StreamSanitizer:
    """Sanitizes a token stream sentence by sentence: text is released only up to a
    sentence end, so a marker or an archive code is never split between checks."""

    def __init__(self, refs: set[str], codes: list[str]) -> None:
        self.refs = refs
        self.codes = codes
        self.cited: list[str] = []
        self._buffer = ""
        self._parts: list[str] = []

    def _boundary(self) -> int:
        last = 0
        for match in _SENTENCE_END_RE.finditer(self._buffer):
            word = _WORD_BEFORE_RE.search(self._buffer[: match.start()])
            if match.group(0).startswith("\n") or not word or word.group(1).lower() not in _ABBREVIATIONS:
                last = match.end()
        return last

    def _release(self, text: str) -> str:
        clean = sanitize(text, self.refs, self.codes, self.cited)
        self._parts.append(clean)
        return clean

    def feed(self, chunk: str) -> Iterator[str]:
        self._buffer += chunk
        end = self._boundary()
        if end:
            ready, self._buffer = self._buffer[:end], self._buffer[end:]
            clean = self._release(ready)
            if clean:
                yield clean

    def flush(self) -> Iterator[str]:
        if self._buffer:
            rest, self._buffer = self._buffer, ""
            clean = self._release(rest)
            if clean:
                yield clean

    @property
    def text(self) -> str:
        return "".join(self._parts).strip()
