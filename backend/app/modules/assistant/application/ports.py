from typing import Protocol

from app.modules.assistant.domain.conversation import Conversation
from app.modules.assistant.domain.turn import AssistantTurn
from app.modules.tickets.domain.ticket import TicketRecord, TicketView


class AssistantPort(Protocol):
    """The ONLY thing the assistant can do: answer the next turn.

    Ariadna prepares; the person submits. Deliberately no submit/create/close here (ADR-0003).
    Raises AssistantUnavailable when no valid turn could be produced.
    """

    async def next_turn(self, conv: Conversation) -> AssistantTurn: ...


class TicketLookup(Protocol):
    """Read-only access to one ticket, to give ticket-help conversations their context."""

    async def get(self, number: int) -> TicketRecord | None: ...


class RequesterTickets(Protocol):
    """Read-only list of ONE requester's own tickets, for `find_similar_tickets`."""

    async def list_by_requester(self, requester_id: str) -> list[TicketView]: ...


class UserLookup(Protocol):
    """Read-only name search over the demo accounts. Returns display names, never ids or emails."""

    async def find_by_name(self, query: str, *, exclude_user_id: str | None = None) -> list[str]:
        """Display names matching `query` (case, accents ignored); `exclude_user_id` is skipped."""
        ...
