"""Test doubles for the assistant's narrow read-only ports."""

from datetime import UTC, datetime
from typing import Any

from app.modules.tickets.domain.ticket import Ticket, TicketView

_NOW = datetime(2026, 10, 1, tzinfo=UTC)


def make_ticket(number: int, summary: str, status: str, requester_id: str) -> TicketView:
    ticket = Ticket(
        number=number,
        summary=summary,
        description=summary,
        service="network",
        status=status,  # type: ignore[arg-type]
        awaiting_user=False,
        priority="medium",
        impact="low",
        urgency="low",
        assigned_group="Soporte de redes",
        assignee_id=None,
        requester_id=requester_id,
        asset=None,
        via_ariadna=False,
        sla_due_at=None,
        created_at=_NOW,
        updated_at=_NOW,
    )
    return TicketView(ticket=ticket, requester_name="x", assignee_name=None)


class StubRequesterTickets:
    """RequesterTickets over a dict; records which requester ids were asked for."""

    def __init__(
        self, by_requester: dict[str, list[TicketView]], error: Exception | None = None
    ) -> None:
        self._by_requester = by_requester
        self._error = error
        self.asked_for: list[str] = []

    async def list_by_requester(self, requester_id: str) -> list[TicketView]:
        self.asked_for.append(requester_id)
        if self._error is not None:
            raise self._error
        return list(self._by_requester.get(requester_id, []))


class StubUserLookup:
    """UserLookup over display names (case-insensitive containment)."""

    def __init__(self, names: list[str]) -> None:
        self._names = names
        self.excluded: list[str | None] = []

    async def find_by_name(self, query: str, *, exclude_user_id: str | None = None) -> list[str]:
        self.excluded.append(exclude_user_id)
        wanted = query.strip().lower()
        return [n for n in self._names if wanted and wanted in n.lower()]


def completion_payload(
    content: str | None = None, tool_calls: list[tuple[str, str, Any]] | None = None
) -> dict[str, Any]:
    """An OpenAI chat.completion body; tool_calls are (id, name, arguments as object or str)."""
    import json

    message: dict[str, Any] = {"role": "assistant", "content": content}
    if tool_calls:
        message["tool_calls"] = [
            {
                "id": call_id,
                "type": "function",
                "function": {
                    "name": name,
                    "arguments": arguments if isinstance(arguments, str) else json.dumps(arguments),
                },
            }
            for call_id, name, arguments in tool_calls
        ]
    return {
        "id": "chatcmpl-1",
        "object": "chat.completion",
        "created": 0,
        "model": "test-model",
        "choices": [
            {
                "index": 0,
                "finish_reason": "tool_calls" if tool_calls else "stop",
                "message": message,
            }
        ],
    }
