"""The agent's read-only tool registry (ADR-0014).

Every tool only reads. None submits, creates, updates or closes anything: writes exist solely as
proposals the person confirms (ADR-0003). The requester id lives in `ToolContext`, bound
server-side per request; it is never part of a prompt, a tool argument or a tool result (ADR-0008).
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated, Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.modules.assistant.application.ports import AssistantPort, RequesterTickets, UserLookup
from app.modules.assistant.domain.flags import missing_required, recommended_warnings
from app.modules.assistant.domain.proposal import missing_data_from
from app.modules.assistant.domain.text import words
from app.modules.assistant.domain.turn import MAX_STEP_SUMMARY, ToolStep, TurnDraft
from app.modules.catalog.domain.services import SERVICES, get_service

MANAGER_AUTHORIZATION_NOTICE = "Instalar programas necesita la autorización de tu jefe o encargado."

MAX_SIMILAR_TICKETS = 3
MAX_CATALOG_MATCHES = 3
MAX_QUERY_CHARS = 200
MAX_NAME_QUERY_CHARS = 120

# Words that carry no meaning when comparing two summaries.
_STOPWORDS = frozenset(
    {"los", "las", "una", "uno", "del", "que", "con", "por", "para", "mis", "esta", "este"}
    | {"muy", "hay", "sin", "como", "pero", "mas", "todo", "toda"}
)


@dataclass(frozen=True)
class ToolContext:
    """Per-request server-side binding. Deliberately NOT part of `Conversation`."""

    requester_id: str


@dataclass(frozen=True)
class ToolSpec:
    """What the model is told about a tool: OpenAI function name, description, JSON schema."""

    name: str
    description: str
    parameters: dict[str, Any]


@dataclass(frozen=True)
class ToolOutcome:
    """`data` goes back to the model; `summary` (es-MX) is what the person sees as a step."""

    ok: bool
    data: dict[str, Any]
    summary: str

    def to_step(self, name: str) -> ToolStep:
        return ToolStep(name=name, summary=self.summary[:MAX_STEP_SUMMARY], ok=self.ok)


@runtime_checkable
class ToolAwareAssistant(Protocol):
    """An adapter that can use tools. `AssistantPort` itself stays `next_turn` only."""

    def with_tools(self, toolbox: "ToolBox") -> AssistantPort: ...


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _SearchCatalogArgs(_Strict):
    query: Annotated[str, Field(min_length=1, max_length=MAX_QUERY_CHARS)]


class _CheckRequiredArgs(_Strict):
    draft: TurnDraft


class _FindSimilarArgs(_Strict):
    summary: Annotated[str, Field(min_length=1, max_length=MAX_QUERY_CHARS)]


class _FindUserArgs(_Strict):
    name: Annotated[str, Field(min_length=1, max_length=MAX_NAME_QUERY_CHARS)]


class _CheckPermissionsArgs(_Strict):
    service_key: Annotated[str, Field(min_length=1, max_length=40)]


@dataclass(frozen=True)
class _Tool:
    spec: ToolSpec
    args: type[BaseModel]
    handler: Callable[[Any], Awaitable[ToolOutcome]]
    failed: str  # "No pude {failed}."


def _fit(text: str) -> str:
    return text if len(text) <= MAX_STEP_SUMMARY else text[: MAX_STEP_SUMMARY - 1] + "…"


def _quoted(text: str) -> str:
    return " ".join(text.split())[:40]


class ToolBox:
    """The five read-only tools, bound to one request's requester and its read-only ports."""

    def __init__(self, ctx: ToolContext, *, tickets: RequesterTickets, users: UserLookup) -> None:
        self._ctx = ctx
        self._tickets = tickets
        self._users = users
        self._tools: dict[str, _Tool] = {t.spec.name: t for t in self._build()}

    @property
    def specs(self) -> list[ToolSpec]:
        return [t.spec for t in self._tools.values()]

    async def run(self, name: str, arguments: object) -> ToolOutcome:
        """Never raises: a failing, unknown or badly-called tool is a failed outcome."""
        tool = self._tools.get(name)
        if tool is None:
            return ToolOutcome(False, {"error": "unknown_tool"}, "No pude hacer esa consulta.")
        failed = ToolOutcome(False, {"error": "tool_failed"}, f"No pude {tool.failed}.")
        try:
            parsed = tool.args.model_validate(arguments)
        except ValidationError:
            return failed
        try:
            return await tool.handler(parsed)
        except Exception:  # a tool must never take the turn down; the step records the failure
            return failed

    # --- tools

    async def _search_catalog(self, args: _SearchCatalogArgs) -> ToolOutcome:
        wanted = words(args.query)
        scored: list[tuple[int, int]] = []
        for index, service in enumerate(SERVICES):
            text = " ".join(
                (service.key, service.label, service.description, *service.examples)
            )
            score = len(wanted & words(text))
            if score:
                scored.append((score, index))
        scored.sort(key=lambda pair: (-pair[0], pair[1]))
        found = [SERVICES[index] for _, index in scored[:MAX_CATALOG_MATCHES]]
        services = [
            {"key": s.key, "label": s.label, "handled_by": s.handled_by} for s in found
        ]
        labels = ", ".join(s.label for s in found)
        summary = f"Busqué en el catálogo: {labels or 'sin coincidencias'}"
        return ToolOutcome(True, {"services": services}, _fit(summary))

    async def _check_required_data(self, args: _CheckRequiredArgs) -> ToolOutcome:
        blocking = missing_required(args.draft)
        warnings = recommended_warnings(args.draft)
        data = {
            "blocking": [{"field": f.field, "message": f.message} for f in blocking],
            "warnings": [{"field": f.field, "message": f.message} for f in warnings],
            "ready": not blocking,
        }
        if blocking:
            labels = ", ".join(missing_data_from(blocking))
            summary = f"Datos obligatorios: faltan {len(blocking)} ({labels})"
        else:
            summary = "Datos obligatorios completos"
        return ToolOutcome(True, data, _fit(summary))

    async def _find_similar_tickets(self, args: _FindSimilarArgs) -> ToolOutcome:
        wanted = words(args.summary) - _STOPWORDS
        mine = await self._tickets.list_by_requester(self._ctx.requester_id)
        scored: list[tuple[int, int, str, str, str]] = []
        for view in mine:
            ticket = view.ticket
            score = len(wanted & (words(ticket.summary) - _STOPWORDS))
            if score:
                scored.append(
                    (score, ticket.number, ticket.display_id, ticket.summary, ticket.status)
                )
        scored.sort(key=lambda row: (-row[0], -row[1]))
        top = scored[:MAX_SIMILAR_TICKETS]
        tickets = [
            {"id": display_id, "summary": summary, "status": status}
            for _, _, display_id, summary, status in top
        ]
        if tickets:
            ids = ", ".join(str(t["id"]) for t in tickets)
            summary_line = f"Solicitudes tuyas parecidas: {ids}"
        else:
            summary_line = "No encontré solicitudes tuyas parecidas"
        return ToolOutcome(True, {"tickets": tickets}, _fit(summary_line))

    async def _find_user(self, args: _FindUserArgs) -> ToolOutcome:
        names = await self._users.find_by_name(args.name, exclude_user_id=self._ctx.requester_id)
        found = ", ".join(names) if names else "sin coincidencias"
        summary = f"Busqué a «{_quoted(args.name)}»: {found}"
        return ToolOutcome(True, {"names": list(names)}, _fit(summary))

    async def _check_permissions(self, args: _CheckPermissionsArgs) -> ToolOutcome:
        service = get_service(args.service_key)
        if service is None:
            data: dict[str, Any] = {"known": False}
            return ToolOutcome(True, data, "Permisos: no reconocí ese servicio")
        needs = service.requires_manager_authorization
        data = {
            "known": True,
            "service": service.key,
            "requires_manager_authorization": needs,
            "notice": MANAGER_AUTHORIZATION_NOTICE if needs else None,
        }
        summary = (
            f"Permisos de «{service.label}»: falta la autorización de tu jefe o encargado"
            if needs
            else f"Permisos de «{service.label}»: tu perfil puede pedirlo"
        )
        return ToolOutcome(True, data, _fit(summary))

    def _build(self) -> list[_Tool]:
        def spec(name: str, description: str, properties: dict[str, Any]) -> ToolSpec:
            return ToolSpec(
                name=name,
                description=description,
                parameters={
                    "type": "object",
                    "properties": properties,
                    "required": list(properties),
                    "additionalProperties": False,
                },
            )

        text = {"type": "string"}
        draft_schema = {
            "type": "object",
            "description": "El borrador actual de la solicitud.",
            "properties": {
                "service": {"type": ["string", "null"]},
                "summary": text,
                "description": text,
                "impact": {"type": ["string", "null"], "enum": ["low", "medium", "high", None]},
                "urgency": {"type": ["string", "null"], "enum": ["low", "medium", "high", None]},
            },
        }
        return [
            _Tool(
                spec("search_catalog", "Busca servicios del catálogo por palabras clave.",
                     {"query": {**text, "description": "Palabras de la persona."}}),
                _SearchCatalogArgs,
                self._search_catalog,
                "buscar en el catálogo",
            ),
            _Tool(
                spec("check_required_data",
                     "Revisa qué datos obligatorios faltan en el borrador y qué se recomienda.",
                     {"draft": draft_schema}),
                _CheckRequiredArgs,
                self._check_required_data,
                "revisar los datos obligatorios",
            ),
            _Tool(
                spec("find_similar_tickets",
                     "Busca entre las solicitudes propias de la persona alguna parecida.",
                     {"summary": {**text, "description": "Resumen del problema."}}),
                _FindSimilarArgs,
                self._find_similar_tickets,
                "revisar tus solicitudes",
            ),
            _Tool(
                spec("find_user",
                     "Busca a una persona por nombre. Solo devuelve nombres para mostrar.",
                     {"name": {**text, "description": "Nombre o apellido."}}),
                _FindUserArgs,
                self._find_user,
                "buscar a esa persona",
            ),
            _Tool(
                spec("check_permissions",
                     "Dice si el servicio requiere la autorización del jefe o encargado.",
                     {"service_key": {**text, "description": "Clave del servicio del catálogo."}}),
                _CheckPermissionsArgs,
                self._check_permissions,
                "revisar los permisos",
            ),
        ]
