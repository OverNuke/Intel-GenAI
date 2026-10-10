"""Adapter 1: any OpenAI-compatible chat-completions endpoint (ADR-0002).

The SDK never retries (`max_retries=0`); the only retry is ours, once, and only when the model
answered with invalid JSON/schema. Rate limit, timeout, connection and HTTP errors degrade
immediately via AssistantUnavailable (the use case turns that into a handoff).
"""

import json
import re
from typing import Any, cast

import httpx
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    RateLimitError,
)
from pydantic import ValidationError

from app.modules.assistant.domain.conversation import Conversation
from app.modules.assistant.domain.errors import AssistantUnavailable
from app.modules.assistant.domain.turn import AssistantTurn
from app.modules.catalog.domain.services import SERVICES

_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)

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
- Instalar software requiere la autorización del jefe o encargado: marca \
"needs_authorization": true y explícalo en "permissions_notice".

Responde ÚNICAMENTE con un objeto JSON con exactamente estas claves:
message, understood, reviewed (lista de textos breves de lo que revisaste), \
draft {{service, summary, description, impact, urgency}}, missing_data (lista de textos), \
target_group, needs_authorization, permissions_notice, ready."""


def _system_prompt() -> str:
    services = "\n".join(f"  - {s.key}: {s.label} -> {s.handled_by}" for s in SERVICES)
    return _SYSTEM_TEMPLATE.format(services=services)


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
    return AssistantTurn.model_validate(json.loads(text))


class OpenAICompatibleAssistant:
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str,
        timeout_seconds: float,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._model = model
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

    def _messages(self, conv: Conversation) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = [
            {"role": "system", "content": _system_prompt()},
            {"role": "system", "content": f"Contexto: {_context_json(conv)}"},
        ]
        messages.extend({"role": m.role, "content": m.content} for m in conv.history)
        if not conv.history:
            messages.append({"role": "user", "content": "Hola, quiero preparar una solicitud."})
        return messages

    async def _complete(self, conv: Conversation) -> str:
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=cast(Any, self._messages(conv)),
                response_format={"type": "json_object"},
            )
        except RateLimitError as error:
            raise AssistantUnavailable("rate_limited") from error
        except APITimeoutError as error:  # subclass of APIConnectionError: check first
            raise AssistantUnavailable("timeout") from error
        except APIConnectionError as error:
            raise AssistantUnavailable("connection_error") from error
        except APIStatusError as error:
            raise AssistantUnavailable("http_error") from error
        return response.choices[0].message.content or ""

    async def next_turn(self, conv: Conversation) -> AssistantTurn:
        for attempt in range(2):
            content = await self._complete(conv)
            try:
                return _parse(content)
            except (ValueError, ValidationError):  # json.JSONDecodeError is a ValueError
                if attempt == 1:
                    break
        raise AssistantUnavailable("invalid_output")
