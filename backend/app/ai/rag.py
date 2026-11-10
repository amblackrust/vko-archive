"""RAG building blocks (T4.4): model context from server-checked items and the
post-check of the model's text.

The model sees each item as `[S1] type | title | code | date | …` and may cite items only
by these markers. Links and cards are built by the server (`AiSource`), never taken from
the model. The post-check removes from the answer every marker that is not in the
context, every archive code that is not a context item's code, URLs, site paths and UUIDs.
"""

import re
import unicodedata
from collections.abc import Iterator
from dataclasses import dataclass, field

from app.schemas.ai import AiSource

MAX_ITEMS = 8
DESCRIPTION_CHARS = 300

_MARKER_LIST_RE = re.compile(r"[\[【]\s*S\d{1,3}(?:\s*[,;]\s*S?\d{1,3})*\s*[\]】]", re.IGNORECASE)
_MARKER_NUM_RE = re.compile(r"\d{1,3}")
# Zero-width and bidi control characters: they split words so that a pattern does not match.
_INVISIBLE_RE = re.compile("[\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]")

# --- links ---------------------------------------------------------------------------
# The model must not give links at all: cards and external links (eGov) are built by the
# server. Only the bare names of the official portals may stay as text.
ALLOWED_DOMAINS = frozenset({"egov.kz", "eotinish.kz"})
_MD_LINK_RE = re.compile(r"!?\[([^\[\]\n]{0,300})\]\((?:[^()\n]|\([^()\n]*\))*\)")
_SCHEME_URL_RE = re.compile(r"\S*://\S*|(?<!\S)//\S+")  # any scheme, also homoglyphs («httрs://»)
# «javascript:…», «mailto:…», «data:…» and any other «word:non-space».
_SCHEME_RE = re.compile(r"(?<![\w.\-])[^\W\d_][\w+.\-]*:(?![\s\d«\"'(\[]|$)\S*")
_EMAIL_RE = re.compile(r"[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+")
_DOMAIN_RE = re.compile(
    r"(?<![\w@\-])(?:www\.)?(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|рф|қаз|xn--[a-z0-9\-]+)"
    r"(?!\w)(?:[/?#:][^\s]*)?",
    re.IGNORECASE,
)
_SITE_PATH_RE = re.compile(
    r"(?<![\w/])/(?:catalog|branches|exhibitions|news|pages|memory|about|services|api|files|contacts|kk|ru|en)"
    r"(?:/[\w\-./?=&%#]*)?",
    re.IGNORECASE,
)
_DOTTED_TOKEN_RE = re.compile(r"\S*[./]\S*")
_LATIN_RE = re.compile(r"[A-Za-z]")
_CYRILLIC_RE = re.compile(r"[\u0400-\u04ff]")
_UUID_RE = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE)

# --- archive codes (шифры) ---------------------------------------------------------------
# «Ф. 12, оп. 3, д. 45, л. 7», «ДЕМО Ф.Д-1 Оп.1 Д.1 №1», «фонд № 999, опись 2, дело 17»,
# kk «Қ. 5, Т. 1, І. 3» / «қор 5, тізімдеме 1, іс 3, парақ 2», en «Fund 77, inventory 1, file 3».
_CODE_KEYS = {
    "fund": r"фонд\w*|ф|қор\w*|қ|fund|f",
    "inv": r"опис\w*|оп|тізімдеме\w*|т|inventory|inv|opis|op",
    "case": r"дел[оауе]|д|іс\w{0,4}|і|file|case|d",
    "sheet": r"лист\w{0,2}|лл|л|парақ\w*|п|sheets?|folios?|fol",
    "num": r"№|no",
}
_CODE_VALUE = r"(?=[\w\-]*\d)[^\W_](?:[\w\-]*\w)?"
_CODE_KEY_ANY = "|".join(_CODE_KEYS.values())
_CODE_PART = rf"(?<!\w)(?:{_CODE_KEY_ANY})(?![^\W\d_])\s*\.?\s*(?:№\s*)?{_CODE_VALUE}"
_CODE_SPAN_RE = re.compile(rf"{_CODE_PART}(?:[\s,.;]*{_CODE_PART})*", re.IGNORECASE)
_CODE_PART_RE = re.compile(
    r"(?<!\w)(?:" + "|".join(f"(?P<{kind}>{key})" for kind, key in _CODE_KEYS.items()) + r")(?![^\W\d_])"
    rf"\s*\.?\s*(?:№\s*)?(?P<value>{_CODE_VALUE})",
    re.IGNORECASE,
)
_CODE_KEY_AHEAD_RE = re.compile(rf"\s*(?:{_CODE_KEY_ANY})(?![^\W\d_])", re.IGNORECASE)
_DEMO_BEFORE_RE = re.compile(r"ДЕМО\s*$", re.IGNORECASE)

_SPACES_RE = re.compile(r"[ \t]+")
_EMPTY_BRACKETS_RE = re.compile(r"\(\s*[,;]?\s*\)|\[\s*\]|<\s*>")
_SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([,.;:!?])")
# Words before a dot that do not end a sentence (parts of archive codes, «г.», «им.»).
_ABBREVIATIONS = frozenset("ф оп д л лл г гг им т қ і п f op d p no inv демо".split())
_SENTENCE_END_RE = re.compile(r"[.!?…]+\s+(?=[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ«\"(\[])|\n+(?=\S)")
_WORD_BEFORE_RE = re.compile(r"(\w+)$")
_MEANINGFUL_RE = re.compile(r"\w{2,}")


@dataclass
class ContextItem:
    source: AiSource
    line: str  # without the "[S1] " prefix
    codes: list[str] = field(default_factory=list)  # other spellings of the item's code (funds)


Code = dict[str, str]  # component (fund / inv / case / sheet / num) -> normalised value


@dataclass
class Context:
    items: list[ContextItem] = field(default_factory=list)

    @property
    def refs(self) -> dict[str, AiSource]:
        return {item.source.ref: item.source for item in self.items}

    @property
    def codes(self) -> list[Code]:
        texts = [i.source.archive_code for i in self.items if i.source.archive_code]
        texts += [code for i in self.items for code in i.codes]
        return [code for text in texts for code in parse_codes(text)]

    def text(self) -> str:
        return "\n".join(f"[{item.source.ref}] {item.line}" for item in self.items)


def field_line(*parts: str | None) -> str:
    return " | ".join(" ".join(p.split()) for p in parts if p and p.strip())


def shorten(text: str, limit: int = DESCRIPTION_CHARS) -> str:
    text = " ".join((text or "").split())
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + " …"


def normalize(text: str) -> str:
    """NFKC (fullwidth letters, ligatures) without invisible characters; «№» is kept
    (NFKC would turn it into «No»)."""
    text = _INVISIBLE_RE.sub("", text)
    return "№".join(unicodedata.normalize("NFKC", part) for part in text.split("№"))


def _code_value(value: str) -> str:
    return re.sub(r"[\s\-‐-―−]", "", value).casefold()


def _code_groups(span: re.Match[str]) -> list[list[re.Match[str]]]:
    """Components of a code-like span, split into separate codes at every fund."""
    groups: list[list[re.Match[str]]] = []
    for part in _CODE_PART_RE.finditer(span.group(0)):
        if part.group("fund") is not None or not groups:
            groups.append([])
        groups[-1].append(part)
    return groups


def _as_code(parts: list[re.Match[str]]) -> Code | None:
    """None for sheets/numbers only («л. 5», «№ 3») or a lone case/inventory («д. 5»):
    those are not archive codes. A component (not a sheet) given twice with different
    values → {} (unknown)."""
    code: Code = {}
    conflict = False
    for part in parts:
        kind = next(k for k in _CODE_KEYS if part.group(k) is not None)
        value = _code_value(part.group("value"))
        conflict |= kind != "sheet" and code.get(kind, value) != value
        code.setdefault(kind, value)
    if not code.keys() & {"fund", "inv", "case"} or ("fund" not in code and len(code) < 2):
        return None
    return {} if conflict else code


def parse_codes(text: str) -> list[Code]:
    return [
        code
        for span in _CODE_SPAN_RE.finditer(normalize(text))
        for group in _code_groups(span)
        if (code := _as_code(group))
    ]


def _known_code(candidate: Code, codes: list[Code]) -> bool:
    """Every component the model wrote equals that component of one context code (the
    whole code or its fund / inventory / case prefix). A sheet is checked only if the
    context code has one (the prompt asks the model to name the sheet)."""
    return bool(candidate) and any(
        all(known.get(kind) == value for kind, value in candidate.items() if kind != "sheet" or "sheet" in known)
        for known in codes
    )


def _check_codes(text: str, codes: list[Code]) -> str:
    """Removes archive codes that are not codes of context items."""
    out: list[str] = []
    last = 0
    for span in _CODE_SPAN_RE.finditer(text):
        for group in _code_groups(span):
            code = _as_code(group)
            if code is None or _known_code(code, codes):
                continue
            start, end = span.start() + group[0].start(), span.start() + group[-1].end()
            demo = _DEMO_BEFORE_RE.search(text, last, start)
            out.append(text[last : demo.start() if demo else start])
            last = end
    out.append(text[last:])
    return "".join(out)


def _remove_links(text: str) -> str:
    def markdown(match: re.Match[str]) -> str:
        label = match.group(1)
        return f"[{label}]" if re.fullmatch(r"\s*S\d{1,3}\s*", label, re.IGNORECASE) else label

    def scheme_url(match: re.Match[str]) -> str:
        # «https://egov.kz» → «egov.kz»: the official portal may be named, not linked.
        host = re.fullmatch(r"https?://(?:www\.)?([a-z\-]+(?:\.[a-z\-]+)+)/?([.,;:!?)]*)", match.group(0), re.IGNORECASE)
        return host.group(1).lower() + host.group(2) if host and host.group(1).lower() in ALLOWED_DOMAINS else ""

    def domain(match: re.Match[str]) -> str:
        return match.group(0) if match.group(0).lower() in ALLOWED_DOMAINS else ""

    def mixed_script(match: re.Match[str]) -> str:
        # «раураl.com», «evil.кz»: Latin and Cyrillic letters in one label of a dotted token.
        labels = re.split(r"[./\-]", match.group(0))
        mixed = any(_LATIN_RE.search(label) and _CYRILLIC_RE.search(label) for label in labels)
        return "" if mixed else match.group(0)

    text = _MD_LINK_RE.sub(markdown, text)
    text = _SCHEME_URL_RE.sub(scheme_url, text)
    text = _SCHEME_RE.sub("", text)
    text = _EMAIL_RE.sub("", text)
    text = _DOMAIN_RE.sub(domain, text)
    text = _DOTTED_TOKEN_RE.sub(mixed_script, text)
    return _SITE_PATH_RE.sub("", text)


def _markers(match: re.Match[str], refs: set[str], cited: list[str]) -> str:
    kept = []
    for number in _MARKER_NUM_RE.findall(match.group(0)):
        ref = f"S{int(number)}"
        if ref in refs:
            kept.append(f"[{ref}]")
            if ref not in cited:
                cited.append(ref)
    return " ".join(kept)


def sanitize(text: str, refs: set[str], codes: list[Code], cited: list[str]) -> str:
    """Post-check of model text. Appends cited refs (in order) to `cited`."""
    text = _remove_links(normalize(text))
    text = _UUID_RE.sub("", text)
    text = _check_codes(text, codes)
    text = _MARKER_LIST_RE.sub(lambda m: _markers(m, refs, cited), text)
    text = _EMPTY_BRACKETS_RE.sub("", text)
    text = _SPACE_BEFORE_PUNCT_RE.sub(r"\1", text)
    return _SPACES_RE.sub(" ", text)


def is_empty(text: str) -> bool:
    without_markers = _MARKER_LIST_RE.sub("", text)
    return not _MEANINGFUL_RE.search(without_markers)


class StreamSanitizer:
    """Sanitizes a token stream sentence by sentence: text is released only up to a
    sentence end, so a marker or an archive code is never split between checks."""

    def __init__(self, refs: set[str], codes: list[Code]) -> None:
        self.refs = refs
        self.codes = codes
        self.cited: list[str] = []
        self._buffer = ""
        self._parts: list[str] = []

    def _boundary(self) -> int:
        last = 0
        for match in _SENTENCE_END_RE.finditer(self._buffer):
            if _CODE_KEY_AHEAD_RE.match(self._buffer, match.end()):
                continue  # «Ф. 99. Оп. 5. Д. 17»: the code goes on
            word = _WORD_BEFORE_RE.search(self._buffer[: match.start()])
            if match.group(0).startswith("\n") or not word or word.group(1).lower() not in _ABBREVIATIONS:
                last = match.end()
        return last

    def _release(self, text: str) -> str:
        clean = sanitize(text, self.refs, self.codes, self.cited)
        self._parts.append(clean)
        return clean

    def feed(self, chunk: str) -> Iterator[str]:
        self._buffer = normalize(self._buffer + chunk)
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
