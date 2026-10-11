import logging
from typing import Annotated

from fastapi import Depends

from app.modules.assistant.application.ports import (
    AssistantPort,
    RequesterTickets,
    TicketLookup,
    UserLookup,
)
from app.modules.assistant.infrastructure.fake import FakeAssistant
from app.modules.assistant.infrastructure.openai_adapter import OpenAICompatibleAssistant
from app.modules.assistant.infrastructure.user_lookup import AccountUserLookup
from app.modules.auth.api.deps import get_user_repository
from app.modules.auth.application.ports import UserRepository
from app.modules.tickets.api.deps import get_ticket_repository
from app.modules.tickets.application.ports import TicketRepository
from app.modules.tickets.domain.ticket import TicketView
from app.shared.config import get_settings, resolve_assistant_adapter, resolve_assistant_mode

logger = logging.getLogger(__name__)

# Composition root for the assistant module. Tests replace these via app.dependency_overrides.


def get_assistant() -> AssistantPort:
    """Adapter chosen from the environment; a missing configuration never fails the request.

    ASSISTANT_MODE (`single` by default, `agent` opt-in) picks the loop; tools are bound later,
    per request, by the route (the requester id is never known here).
    """
    settings = get_settings()
    mode = resolve_assistant_mode(settings)
    if resolve_assistant_adapter(settings) == "fake":
        if (settings.assistant_adapter or "").strip().lower() == "openai":
            logger.warning("ASSISTANT_ADAPTER=openai lacks LLM_* settings: using the fake adapter")
        return FakeAssistant(mode=mode)
    # resolve_assistant_adapter guarantees the three settings are present here.
    return OpenAICompatibleAssistant(
        base_url=settings.llm_base_url or "",
        model=settings.llm_model or "",
        api_key=settings.llm_api_key or "",
        timeout_seconds=settings.llm_timeout_seconds,
        mode=mode,
    )


def get_ticket_lookup(
    repo: Annotated[TicketRepository, Depends(get_ticket_repository)],
) -> TicketLookup:
    """Read-only view of the tickets repository: the route can only call `get`."""
    return repo


class _LazyRequesterTickets:
    """Opens the tickets repository only when a tool actually runs (never in `single` mode)."""

    async def list_by_requester(self, requester_id: str) -> list[TicketView]:
        return await get_ticket_repository().list_by_requester(requester_id)


def get_requester_tickets() -> RequesterTickets:
    """Read-only view of the tickets repository: the tools can only list a requester's own."""
    return _LazyRequesterTickets()


def get_user_lookup(
    users: Annotated[UserRepository, Depends(get_user_repository)],
) -> UserLookup:
    """Read-only name search over the demo accounts; yields display names only."""
    return AccountUserLookup(users)
