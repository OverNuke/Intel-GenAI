"""Impact ("¿a cuántas personas afecta?") read from what the person wrote.

A pure, deterministic pass shared by every adapter, so a weak or offline model can never make
Ariadna ask again for something the person already said. It only fills gaps: a value the person
set in the draft always wins, and the draft stays editable.
"""

import re
import unicodedata
from collections.abc import Sequence
from dataclasses import replace

from app.modules.assistant.domain.conversation import Conversation
from app.modules.tickets.domain.ticket import Impact

# From this many affected people on, the whole area is assumed to be involved.
HIGH_HEADCOUNT = 10

_NUMBER_WORDS = {
    "un": 1,
    "uno": 1,
    "una": 1,
    "dos": 2,
    "tres": 3,
    "cuatro": 4,
    "cinco": 5,
    "seis": 6,
    "siete": 7,
    "ocho": 8,
    "nueve": 9,
    "diez": 10,
    "once": 11,
    "doce": 12,
    "quince": 15,
    "veinte": 20,
    "treinta": 30,
}
_NUMBER = r"(?:\d{1,3}|" + "|".join(_NUMBER_WORDS) + r")"
_PEOPLE = r"(?:companer[oa]s?|compas?|personas?|colegas?|usuarios?|emplead[oa]s?|trabajadores)"

_LOW = re.compile(
    r"\bsolo (?:me afecta|a mi|yo|me pasa)\b"
    r"|\bsolamente (?:a mi|yo|me afecta)\b"
    r"|\bunicamente (?:a mi|yo)\b"
    r"|\bnada mas yo\b"
)
_NOT_ONLY = re.compile(r"\bno (?:es )?solo(?:amente)?\b")
_HIGH = re.compile(
    r"\btod[oa]s? (?:mi|el|la|su|nuestr[oa]) "
    r"(?:area|departamento|oficina|equipo|direccion|piso|edificio|sucursal|planta)\b"
    r"|\btodos\b(?! los dias)"
)
# "tres compañeros", "otros tres compañeros", "4 personas"
_COUNT = re.compile(
    rf"\b(?P<pre>otr[oa]s\s+)?(?P<n>{_NUMBER})\s+(?P<post>otr[oa]s\s+)?(?:de\s+mis\s+)?{_PEOPLE}\b"
)
# "a mí y a otros cuatro": the number follows "otros" and the people word is implied
_OTHERS_COUNT = re.compile(rf"\botr[oa]s\s+(?P<n>{_NUMBER})\b")
_MEDIUM = re.compile(
    rf"\b(?:varios|varias|algunos|algunas|muchos|muchas)\s+(?:de\s+mis\s+)?{_PEOPLE}\b"
    rf"|\b(?:mis|los|las|otr[oa]s?)\s+{_PEOPLE}\b"
    r"|\ba mi y a (?:otros|otras|otro|otra|mis|los|las)\b"
)
_ME = re.compile(r"\ba mi\b|\byo\b")


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn").lower()


def _number(token: str) -> int:
    return int(token) if token.isdigit() else _NUMBER_WORDS[token]


def _headcount(text: str) -> int | None:
    """Largest number of affected people the text states (the writer counts when "otros")."""
    includes_me = bool(_ME.search(text))
    totals: list[int] = []
    for found in _COUNT.finditer(text):
        n = _number(found["n"])
        others = bool(found["pre"] or found["post"])
        totals.append(n + 1 if others and includes_me else n)
    for found in _OTHERS_COUNT.finditer(text):
        totals.append(_number(found["n"]) + (1 if includes_me else 0))
    positive = [t for t in totals if t > 0]
    return max(positive) if positive else None


def _from_headcount(count: int) -> Impact:
    if count >= HIGH_HEADCOUNT:
        return "high"
    return "medium" if count >= 2 else "low"


def _infer_one(text: str) -> Impact | None:
    normalized = _normalize(text)
    if not normalized.strip():
        return None
    # "no solo a mí, también a mis compañeros" is not "solo a mí".
    if _LOW.search(_NOT_ONLY.sub(" ", normalized)):
        return "low"
    if _HIGH.search(normalized):
        return "high"
    count = _headcount(normalized)
    if count is not None:
        return _from_headcount(count)
    if _MEDIUM.search(normalized):
        return "medium"
    return None


def infer_impact(messages: Sequence[str]) -> Impact | None:
    """Impact stated in the person's messages; the latest message that says anything wins."""
    for text in reversed(messages):
        inferred = _infer_one(text)
        if inferred is not None:
            return inferred
    return None


def with_inferred_impact(conv: Conversation) -> Conversation:
    """The conversation with the draft's impact filled in when it is empty and the text says it."""
    if conv.draft.impact is not None:
        return conv
    inferred = infer_impact([m.content for m in conv.history if m.role == "user"])
    if inferred is None:
        return conv
    return replace(conv, draft=replace(conv.draft, impact=inferred))
