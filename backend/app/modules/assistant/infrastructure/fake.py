"""Deterministic assistant for tests, CI and offline demos (ADR-0002, adapter 2).

Pure function of the conversation: keyword -> catalog service, one missing field asked per turn.
No network, clock or randomness. Production code on purpose: it is also the fallback adapter.
"""

import copy
import re
import unicodedata
from typing import Literal

from app.modules.assistant.application.ports import AssistantPort
from app.modules.assistant.application.tools import MANAGER_AUTHORIZATION_NOTICE, ToolBox
from app.modules.assistant.domain.conversation import Conversation
from app.modules.assistant.domain.flags import attach_steps, enforce_domain_flags
from app.modules.assistant.domain.impact import infer_impact
from app.modules.assistant.domain.proposal import ActionProposal, AddParticipants, Flag
from app.modules.assistant.domain.turn import MAX_STEPS, AssistantTurn, ToolStep, TurnDraft
from app.modules.catalog.domain.services import get_service
from app.modules.tickets.domain.ticket import Urgency

# Order matters: the first service with a matching word wins.
_KEYWORDS: tuple[tuple[str, frozenset[str]], ...] = (
    ("network", frozenset({"vpn", "wifi", "red", "internet", "conexion"})),
    ("printing", frozenset({"impresora", "imprimir", "imprime", "escaner", "impresion", "tinta"})),
    (
        "hardware",
        frozenset(
            {
                "laptop",
                "monitor",
                "pantalla",
                "equipo",
                "teclado",
                "mouse",
                "pc",
                "computadora",
                "cable",
                "cables",
            }
        ),
    ),
    ("software", frozenset({"instalar", "programa", "software", "licencia"})),
    ("email", frozenset({"correo", "email", "buzon"})),
    ("access", frozenset({"contrasena", "acceso", "cuenta", "carpeta", "permiso", "usuario"})),
)

_URGENCY: tuple[tuple[Urgency, tuple[str, ...]], ...] = (
    ("low", ("puede esperar", "sin prisa")),
    ("medium", ("con dificultad",)),
    ("high", ("no puedo trabajar", "urgente")),
)

# Safety hints: ALL words of one set must appear (word match, so "humor" is not "humo").
_SAFETY: tuple[frozenset[str], ...] = (
    frozenset({"cables", "pelados"}),
    frozenset({"cable", "pelado"}),
    frozenset({"cables", "expuestos"}),
    frozenset({"cable", "expuesto"}),
    frozenset({"humo"}),
    frozenset({"quemado"}),
    frozenset({"chispas"}),
    frozenset({"cortocircuito"}),
)

_QUESTIONS = {
    "Descripción": "¿Qué está pasando? Cuéntamelo con tus palabras.",
    "Resumen": "¿Cómo resumirías el problema en una frase corta?",
    "Servicio": "¿Con qué se relaciona: impresión, red, correo, acceso, equipo o software?",
    "Impacto": "¿A cuántas personas afecta: solo a ti, a varias personas o a toda tu área?",
    "Urgencia": "¿Qué tan urgente es: puede esperar, trabajas con dificultad o no puedes trabajar?",
}
_READY = (
    "Revisé tu solicitud. Si todo está bien, tú decides: "
    "presiona «Enviar solicitud». Yo no envío nada."
)
_MANAGER_NOTICE = MANAGER_AUTHORIZATION_NOTICE
_SUMMARY_MAX = 80

# "agrega a Luis y a Sara", "por favor añade a Sara a la solicitud"
_ADD_PEOPLE = re.compile(
    r"\b(?:agrega(?:r)?|a[ñn]ade|a[ñn]adir|incluye|incluir|suma|sumar)\s+a\s+(?P<names>[^.;!?\n]+)",
    re.IGNORECASE,
)
_NAMES_END = re.compile(
    r"\s+(?:a la|al|a esta|a este|a mi|a mis|en|como|para|por favor)\b.*$", re.IGNORECASE
)
_NAME_SEPARATOR = re.compile(r"\s*(?:,|\by\b|\be\b)\s*(?:a\s+)?", re.IGNORECASE)
_NAME_WORDS = re.compile(r"^[^\W\d_]+(?: [^\W\d_]+){0,2}$")
# Tool budget: check_required_data and find_similar_tickets are reserved, the rest is find_user.
_USER_LOOKUPS = MAX_STEPS - 2


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn").lower()


def _route(texts: list[str]) -> str | None:
    words = set(re.split(r"[^a-z0-9]+", _normalize(" ".join(texts))))
    for service, keywords in _KEYWORDS:
        if words & keywords:
            return service
    return None


def _safety_hint(texts: list[str]) -> bool:
    words = set(re.split(r"[^a-z0-9]+", _normalize(" ".join(texts))))
    return any(hint <= words for hint in _SAFETY)


def _infer[T](texts: list[str], table: tuple[tuple[T, tuple[str, ...]], ...]) -> T | None:
    for text in reversed(texts):
        normalized = _normalize(text)
        for value, phrases in table:
            if any(phrase in normalized for phrase in phrases):
                return value
    return None


def _truncate(text: str) -> str:
    text = " ".join(text.split())
    if len(text) <= _SUMMARY_MAX:
        return text
    return text[:_SUMMARY_MAX].rsplit(" ", 1)[0].rstrip(",.;:") + "…"


def _participant_names(texts: list[str]) -> list[str]:
    """Names asked to be added in the latest user message (empty when there is no such phrase)."""
    if not texts:
        return []
    found = _ADD_PEOPLE.search(texts[-1])
    if found is None:
        return []
    names = _NAMES_END.sub("", found.group("names")).strip()
    candidates = (" ".join(part.split()) for part in _NAME_SEPARATOR.split(names))
    unique: list[str] = []
    for candidate in candidates:
        if _NAME_WORDS.match(candidate) and candidate not in unique:
            unique.append(candidate)
    return unique


def _warning(message: str) -> Flag:
    return Flag(field="participants", severity="warning", message=message[:200])


class FakeAssistant:
    """`single`: one pure pass (slice 2). `agent` + a toolbox: the same pass, then the registry
    runs a scripted trail so CI exercises the loop without a model."""

    def __init__(
        self, *, mode: Literal["single", "agent"] = "single", toolbox: ToolBox | None = None
    ) -> None:
        self._mode: Literal["single", "agent"] = mode
        self._toolbox = toolbox

    @property
    def mode(self) -> Literal["single", "agent"]:
        return self._mode

    def with_tools(self, toolbox: ToolBox) -> AssistantPort:
        bound = copy.copy(self)
        bound._toolbox = toolbox
        return bound

    async def next_turn(self, conv: Conversation) -> AssistantTurn:
        turn = self._single(conv)
        if self._mode == "agent" and self._toolbox is not None:
            return await self._with_trail(conv, turn, self._toolbox)
        return turn

    async def _with_trail(
        self, conv: Conversation, turn: AssistantTurn, toolbox: ToolBox
    ) -> AssistantTurn:
        texts = [m.content for m in conv.history if m.role == "user"]
        steps: list[ToolStep] = []
        flags: list[Flag] = []
        resolved: list[str] = []

        outcome = await toolbox.run("check_required_data", {"draft": turn.draft.model_dump()})
        steps.append(outcome.to_step("check_required_data"))

        names = _participant_names(texts)
        for name in names[:_USER_LOOKUPS]:
            outcome = await toolbox.run("find_user", {"name": name})
            steps.append(outcome.to_step("find_user"))
            matches: list[str] = outcome.data.get("names", []) if outcome.ok else []
            if not outcome.ok:
                flags.append(_warning(f"No pude buscar a «{name}»."))
            elif len(matches) == 1:
                if matches[0] not in resolved:
                    resolved.append(matches[0])
            elif not matches:
                flags.append(_warning(f"No encontré a «{name}» entre las personas con acceso."))
            else:
                flags.append(
                    _warning(f"Hay más de una persona que coincide con «{name}»: dime su apellido.")
                )
        if len(names) > _USER_LOOKUPS:
            flags.append(_warning(f"Solo revisé los primeros {_USER_LOOKUPS} nombres."))

        query = turn.draft.summary or turn.draft.description
        if query.strip():
            outcome = await toolbox.run("find_similar_tickets", {"summary": query})
            steps.append(outcome.to_step("find_similar_tickets"))

        proposals: list[ActionProposal] = list(turn.proposals)
        if resolved:
            ticket_ref = conv.entry.ref if conv.entry.kind == "ticket" else None
            proposals.append(AddParticipants(names=resolved, ticket_ref=ticket_ref))

        updated = turn.model_copy(update={"flags": [*turn.flags, *flags], "proposals": proposals})
        return attach_steps(enforce_domain_flags(updated), steps)

    def _single(self, conv: Conversation) -> AssistantTurn:
        texts = [m.content for m in conv.history if m.role == "user"]
        context = texts + ([conv.ticket_summary] if conv.ticket_summary else [])
        draft = conv.draft

        entry_service = conv.entry.ref if conv.entry.kind == "service" else None
        service = draft.service or entry_service or _route(context)
        description = draft.description or (texts[0] if texts else "")
        summary = draft.summary or (_truncate(description) if description.strip() else "")
        impact = draft.impact or infer_impact(texts)
        # Safety beats a calm phrase; the person's own edit beats both.
        safety = _safety_hint(texts)
        urgency = draft.urgency or ("high" if safety else _infer(texts, _URGENCY))

        turn_draft = TurnDraft(
            service=service,
            summary=summary,
            description=description,
            impact=impact,
            urgency=urgency,
        )
        # Blocking flags (and the legacy missing list) come from the domain, like for the LLM.
        base = AssistantTurn(message="-", draft=turn_draft)
        flagged = enforce_domain_flags(base)
        missing = flagged.missing_data
        ready = not missing

        catalog = get_service(service) if service else None
        needs_authorization = bool(catalog and catalog.requires_manager_authorization)
        group = catalog.handled_by if catalog else None

        reviewed: list[str] = []
        if ready:
            reviewed.append("Datos obligatorios completos")
        if group:
            reviewed.append(f"Destino sugerido: {group}")
        reviewed.append(
            "Permisos: falta la autorización de tu jefe o encargado, anotado"
            if needs_authorization
            else "Permisos: tu perfil puede pedir esto"
        )
        if safety:
            reviewed.append("Seguridad: lo marqué como urgente por el riesgo que describes")
        reviewed.append("Adjuntos: ninguno (opcional)")

        return AssistantTurn(
            message=_READY if ready else _QUESTIONS[missing[0]],
            understood=f"Entendí que {summary[0].lower()}{summary[1:]}" if summary else "",
            reviewed=reviewed,
            draft=turn_draft,
            missing_data=missing,
            flags=flagged.flags,
            target_group=group,
            needs_authorization=needs_authorization,
            permissions_notice=_MANAGER_NOTICE if needs_authorization else None,
            ready=ready,
        )
