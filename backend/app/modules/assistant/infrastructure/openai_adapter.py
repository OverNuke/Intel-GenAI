"""Adapter 1: any OpenAI-compatible chat-completions endpoint (ADR-0002, ADR-0014).

The SDK never retries (`max_retries=0`); the only retry is ours, once, and only when the model
answered with invalid JSON/schema. Rate limit, timeout, connection and HTTP errors degrade
immediately via AssistantUnavailable (the use case turns that into a handoff).

In `agent` mode a bounded, read-only tool loop runs first (ADR-0014); when the endpoint rejects
`tools` or the model overflows the step budget, the single-shot path answers instead.
"""

import copy
import json
import re
from typing import Any, Literal, cast

import httpx
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    RateLimitError,
)
from pydantic import ValidationError

from app.modules.assistant.application.ports import AssistantPort
from app.modules.assistant.application.tools import ToolBox, ToolSpec
from app.modules.assistant.domain.conversation import Conversation
from app.modules.assistant.domain.errors import AssistantUnavailable
from app.modules.assistant.domain.flags import attach_steps, enforce_domain_flags
from app.modules.assistant.domain.turn import MAX_STEPS, AssistantTurn, ToolStep
from app.modules.catalog.domain.services import SERVICES

_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)

# Statuses an endpoint answers when it does not support `tools`: fall back to single-shot.
_TOOLS_UNSUPPORTED = frozenset({400, 422, 501})

_SYSTEM_TEMPLATE = """Eres Ariadna, una asistente que ayuda a preparar una solicitud de TI \
antes de enviarla. Hablas en español de México, con lenguaje claro y sin tecnicismos.

Reglas:
- Haces UNA sola pregunta por turno (como máximo un signo de interrogación en "message").
- Nunca envías, creas, asignas ni cierras tickets: la persona decide y envía. Tú solo preparas.
- Nunca otorgas permisos ni autorizaciones.
- Usa solo estos servicios (clave: nombre -> grupo que lo atiende):
{services}
- Si todos los datos obligatorios están (servicio, resumen, descripción, impacto, urgencia), \
pon "ready": true y en "message" una frase sin pregunta que invite a revisar y enviar.
- Impacto y urgencia solo pueden ser "low", "medium", "high" o null.
- Impacto según cuántas personas afecta: solo la persona que escribe = "low"; ella y otras \
(por ejemplo "a mí y a otros tres compañeros", "varias personas") = "medium"; toda su área, \
departamento u oficina = "high". Si ya lo dijo, no preguntes cuántas personas afecta; si "draft" \
del contexto ya trae impacto, respétalo.
- Aprovecha la primera frase de la persona: infiere todos los campos del borrador que puedas \
(servicio, resumen, descripción, impacto, urgencia) y pregunta solo lo que realmente falta; \
no repitas preguntas sobre datos que ya dijo.
- Si menciona un riesgo de seguridad (cables expuestos o pelados, humo, olor a quemado, \
chispas), marca urgencia alta ("high") y dilo en "reviewed".
- "flags": lista de hallazgos {{field, severity, message}}. Usa solo severity "warning" para \
recomendaciones (por ejemplo, falta el número de inventario AT- de un equipo). Los datos \
obligatorios faltantes (severity "blocking") los calcula el sistema; no los incluyas.
- "proposals": lista (puede estar vacía) de acciones que propones y la persona confirma, con \
"kind": "create_ticket", "add_participants" (names: nombres para mostrar, máximo 8), \
"update_ticket" (ticket_ref y solo los campos que cambian) o "close_ticket" (ticket_ref). \
Solo propones; nunca ejecutas.
- Instalar software requiere la autorización del jefe o encargado: marca \
"needs_authorization": true y explícalo en "permissions_notice".

Responde ÚNICAMENTE con un objeto JSON con exactamente estas claves:
message, understood, reviewed (lista de textos breves de lo que revisaste), \
draft {{service, summary, description, impact, urgency}}, missing_data (lista de textos), \
flags, proposals, target_group, needs_authorization, permissions_notice, ready."""

_TOOLS_SECTION = """

Herramientas: dispones de herramientas de solo lectura para consultar el catálogo, revisar \
los datos obligatorios del borrador, buscar solicitudes parecidas de la propia persona, buscar \
a otras personas por nombre y revisar permisos. Úsalas solo si ayudan (máximo 4 consultas) y no \
inventes resultados. Ninguna puede crear, enviar, cambiar ni cerrar nada. Cuando termines de \
consultar, responde ÚNICAMENTE con el objeto JSON descrito arriba."""


def _system_prompt(*, agent: bool = False) -> str:
    services = "\n".join(f"  - {s.key}: {s.label} -> {s.handled_by}" for s in SERVICES)
    prompt = _SYSTEM_TEMPLATE.format(services=services)
    return prompt + _TOOLS_SECTION if agent else prompt


def _openai_tool(spec: ToolSpec) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": spec.name,
            "description": spec.description,
            "parameters": spec.parameters,
        },
    }


def _context(conv: Conversation) -> dict[str, Any]:
    """The only data that leaves the system: entry context, draft and the conversation."""
    context: dict[str, Any] = {
        "entry": conv.entry.kind,
        "draft": {
            "service": conv.draft.service,
            "summary": conv.draft.summary,
            "description": conv.draft.description,
            "impact": conv.draft.impact,
            "urgency": conv.draft.urgency,
        },
    }
    if conv.entry.kind == "service":
        context["service"] = conv.entry.ref
    if conv.entry.kind == "ticket":
        context["ticket"] = {"summary": conv.ticket_summary, "status": conv.ticket_status}
    return context


def _context_json(conv: Conversation) -> str:
    return json.dumps(_context(conv), ensure_ascii=False)


def _parse(content: str) -> AssistantTurn:
    text = content.strip()
    fenced = _FENCE.match(text)
    if fenced:
        text = fenced.group(1)
    payload = json.loads(text)
    if isinstance(payload, dict):
        payload.pop("steps", None)  # the trail is evidence the tools produced, never model prose
    # Blocking flags and `ready` are the domain's call, never the model's.
    return enforce_domain_flags(AssistantTurn.model_validate(payload))


class _SingleShotFallback(Exception):
    """The tool loop cannot be used (tools rejected or step overflow): answer in one call."""


class _ToolsRejected(Exception):
    """The endpoint refused a request that offered `tools`."""


def _call_parts(call: Any) -> tuple[str, str, str]:
    function = getattr(call, "function", None)
    return (
        str(getattr(call, "id", "")),
        str(getattr(function, "name", "") or ""),
        str(getattr(function, "arguments", "") or ""),
    )


def _arguments(raw: str) -> object:
    """Parsed JSON arguments; unparseable text is passed through so the tool fails softly."""
    try:
        return json.loads(raw) if raw.strip() else {}
    except ValueError:
        return raw


def _assistant_tool_message(message: Any, requested: list[Any]) -> dict[str, Any]:
    calls = []
    for call in requested:
        call_id, name, raw = _call_parts(call)
        calls.append(
            {"id": call_id, "type": "function", "function": {"name": name, "arguments": raw}}
        )
    return {"role": "assistant", "content": message.content, "tool_calls": calls}


class OpenAICompatibleAssistant:
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str,
        timeout_seconds: float,
        http_client: httpx.AsyncClient | None = None,
        mode: Literal["single", "agent"] = "single",
        toolbox: ToolBox | None = None,
    ) -> None:
        self._model = model
        self._mode: Literal["single", "agent"] = mode
        self._toolbox = toolbox
        self._client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key,
            timeout=timeout_seconds,
            max_retries=0,
            http_client=http_client,  # type: ignore[arg-type]  # httpx vs the SDK's httpx2 stubs
        )

    @property
    def max_retries(self) -> int:
        return int(self._client.max_retries)

    @property
    def mode(self) -> Literal["single", "agent"]:
        return self._mode

    def with_tools(self, toolbox: ToolBox) -> AssistantPort:
        """A copy bound to one request's tools. They are only used when the mode is `agent`."""
        bound = copy.copy(self)
        bound._toolbox = toolbox
        return bound

    def _messages(self, conv: Conversation, *, agent: bool = False) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": _system_prompt(agent=agent)},
            {"role": "system", "content": f"Contexto: {_context_json(conv)}"},
        ]
        messages.extend({"role": m.role, "content": m.content} for m in conv.history)
        if not conv.history:
            messages.append({"role": "user", "content": "Hola, quiero preparar una solicitud."})
        return messages

    async def _chat(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None
    ) -> Any:
        """One completion. With `tools` the model may call them (JSON mode is not combined: some
        endpoints reject that); without, the answer is forced to a JSON object."""
        extra: dict[str, Any] = (
            {"tools": tools} if tools else {"response_format": {"type": "json_object"}}
        )
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=cast(Any, messages),
                **extra,
            )
        except RateLimitError as error:
            raise AssistantUnavailable("rate_limited") from error
        except APITimeoutError as error:  # subclass of APIConnectionError: check first
            raise AssistantUnavailable("timeout") from error
        except APIConnectionError as error:
            raise AssistantUnavailable("connection_error") from error
        except APIStatusError as error:
            if tools and error.status_code in _TOOLS_UNSUPPORTED:
                raise _ToolsRejected from error
            raise AssistantUnavailable("http_error") from error
        return response.choices[0].message

    async def _single_shot(self, conv: Conversation) -> AssistantTurn:
        for attempt in range(2):
            message = await self._chat(self._messages(conv), None)
            try:
                return _parse(str(message.content or ""))
            except (ValueError, ValidationError):  # json.JSONDecodeError is a ValueError
                if attempt == 1:
                    break
        raise AssistantUnavailable("invalid_output")

    async def _agent_turn(self, conv: Conversation, toolbox: ToolBox) -> AssistantTurn:
        """Bounded read-only loop: at most MAX_STEPS tool runs, then the final JSON turn."""
        messages = self._messages(conv, agent=True)
        tools = [_openai_tool(spec) for spec in toolbox.specs]
        steps: list[ToolStep] = []
        final_only = False
        retried = False
        while True:
            offer = None if final_only or len(steps) >= MAX_STEPS else tools
            try:
                message = await self._chat(messages, offer)
            except _ToolsRejected as rejected:
                raise _SingleShotFallback from rejected

            requested = list(getattr(message, "tool_calls", None) or [])
            if requested:
                if len(steps) + len(requested) > MAX_STEPS:
                    raise _SingleShotFallback
                messages.append(_assistant_tool_message(message, requested))
                for call in requested:
                    call_id, name, raw = _call_parts(call)
                    outcome = await toolbox.run(name, _arguments(raw))
                    steps.append(outcome.to_step(name))
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call_id,
                            "content": json.dumps(outcome.data, ensure_ascii=False),
                        }
                    )
                continue

            try:
                return attach_steps(_parse(str(message.content or "")), steps)
            except (ValueError, ValidationError):
                if retried:
                    raise AssistantUnavailable("invalid_output") from None
                retried = True
                final_only = True

    async def next_turn(self, conv: Conversation) -> AssistantTurn:
        if self._mode == "agent" and self._toolbox is not None:
            try:
                return await self._agent_turn(conv, self._toolbox)
            except _SingleShotFallback:
                pass
        return await self._single_shot(conv)
