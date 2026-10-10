"""Deterministic assistant for tests, CI and offline demos (ADR-0002, adapter 2).

Pure function of the conversation: keyword -> catalog service, one missing field asked per turn.
No network, clock or randomness. Production code on purpose: it is also the fallback adapter.
"""

import re
import unicodedata

from app.modules.assistant.domain.conversation import Conversation
from app.modules.assistant.domain.turn import AssistantTurn, TurnDraft
from app.modules.catalog.domain.services import get_service
from app.modules.tickets.domain.ticket import Impact, Urgency

# Order matters: the first service with a matching word wins.
_KEYWORDS: tuple[tuple[str, frozenset[str]], ...] = (
    ("network", frozenset({"vpn", "wifi", "red", "internet", "conexion"})),
    ("printing", frozenset({"impresora", "imprimir", "imprime", "escaner", "impresion", "tinta"})),
    ("hardware", frozenset({"laptop", "monitor", "pantalla", "equipo", "teclado", "mouse"})),
    ("software", frozenset({"instalar", "programa", "software", "licencia"})),
    ("email", frozenset({"correo", "email", "buzon"})),
    ("access", frozenset({"contrasena", "acceso", "cuenta", "carpeta", "permiso", "usuario"})),
)

_IMPACT: tuple[tuple[Impact, tuple[str, ...]], ...] = (
    ("low", ("solo me afecta", "solo a mi", "solo yo")),
    ("medium", ("varias personas", "varios compañeros")),
    ("high", ("toda mi area", "toda el area", "todos")),
)
_URGENCY: tuple[tuple[Urgency, tuple[str, ...]], ...] = (
    ("low", ("puede esperar", "sin prisa")),
    ("medium", ("con dificultad",)),
    ("high", ("no puedo trabajar", "urgente")),
)

_QUESTIONS = {
    "Descripción": "¿Qué está pasando? Cuéntamelo con tus palabras.",
    "Servicio": "¿Con qué se relaciona: impresión, red, correo, acceso, equipo o software?",
    "Impacto": "¿A cuántas personas afecta: solo a ti, a varias personas o a toda tu área?",
    "Urgencia": "¿Qué tan urgente es: puede esperar, trabajas con dificultad o no puedes trabajar?",
}
_READY = (
    "Revisé tu solicitud. Si todo está bien, tú decides: "
    "presiona «Enviar solicitud». Yo no envío nada."
)
_MANAGER_NOTICE = "Instalar programas necesita la autorización de tu jefe o encargado."
_SUMMARY_MAX = 80


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn").lower()


def _route(texts: list[str]) -> str | None:
    words = set(re.split(r"[^a-z0-9]+", _normalize(" ".join(texts))))
    for service, keywords in _KEYWORDS:
        if words & keywords:
            return service
    return None


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


class FakeAssistant:
    async def next_turn(self, conv: Conversation) -> AssistantTurn:
        texts = [m.content for m in conv.history if m.role == "user"]
        context = texts + ([conv.ticket_summary] if conv.ticket_summary else [])
        draft = conv.draft

        entry_service = conv.entry.ref if conv.entry.kind == "service" else None
        service = draft.service or entry_service or _route(context)
        description = draft.description or (texts[0] if texts else "")
        summary = draft.summary or (_truncate(texts[0]) if texts else "")
        impact = draft.impact or _infer(texts, _IMPACT)
        urgency = draft.urgency or _infer(texts, _URGENCY)

        missing = [
            label
            for label, absent in (
                ("Descripción", not description.strip()),
                ("Servicio", service is None),
                ("Impacto", impact is None),
                ("Urgencia", urgency is None),
            )
            if absent
        ]
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
        reviewed.append("Adjuntos: ninguno (opcional)")

        return AssistantTurn(
            message=_READY if ready else _QUESTIONS[missing[0]],
            understood=f"Entendí que {summary[0].lower()}{summary[1:]}" if summary else "",
            reviewed=reviewed,
            draft=TurnDraft(
                service=service,
                summary=summary,
                description=description,
                impact=impact,
                urgency=urgency,
            ),
            missing_data=missing,
            target_group=group,
            needs_authorization=needs_authorization,
            permissions_notice=_MANAGER_NOTICE if needs_authorization else None,
            ready=ready,
        )
