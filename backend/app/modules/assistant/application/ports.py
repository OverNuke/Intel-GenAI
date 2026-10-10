from typing import Protocol

from app.modules.assistant.domain.conversation import Conversation
from app.modules.assistant.domain.turn import AssistantTurn
from app.modules.tickets.domain.ticket import TicketRecord


class AssistantPort(Protocol):
    """The ONLY thing the assistant can do: answer the next turn.

    Ariadna prepares; the person submits. Deliberately no submit/create/close here (ADR-0003).
    Raises AssistantUnavailable when no valid turn could be produced.
    """

    async def next_turn(self, conv: Conversation) -> AssistantTurn: ...


class TicketLookup(Protocol):
    """Read-only access to one ticket, to give ticket-help conversations their context."""

    async def get(self, number: int) -> TicketRecord | None: ...
