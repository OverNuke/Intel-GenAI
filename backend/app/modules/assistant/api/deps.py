import logging
from typing import Annotated

from fastapi import Depends

from app.modules.assistant.application.ports import AssistantPort, TicketLookup
from app.modules.assistant.infrastructure.fake import FakeAssistant
from app.modules.assistant.infrastructure.openai_adapter import OpenAICompatibleAssistant
from app.modules.tickets.api.deps import get_ticket_repository
from app.modules.tickets.application.ports import TicketRepository
from app.shared.config import get_settings, resolve_assistant_adapter

logger = logging.getLogger(__name__)

# Composition root for the assistant module. Tests replace these via app.dependency_overrides.


def get_assistant() -> AssistantPort:
    """Adapter chosen from the environment; a missing configuration never fails the request."""
    settings = get_settings()
    if resolve_assistant_adapter(settings) == "fake":
        if (settings.assistant_adapter or "").strip().lower() == "openai":
            logger.warning("ASSISTANT_ADAPTER=openai lacks LLM_* settings: using the fake adapter")
        return FakeAssistant()
    # resolve_assistant_adapter guarantees the three settings are present here.
    return OpenAICompatibleAssistant(
        base_url=settings.llm_base_url or "",
        model=settings.llm_model or "",
        api_key=settings.llm_api_key or "",
        timeout_seconds=settings.llm_timeout_seconds,
    )


def get_ticket_lookup(
    repo: Annotated[TicketRepository, Depends(get_ticket_repository)],
) -> TicketLookup:
    """Read-only view of the tickets repository: the route can only call `get`."""
    return repo
