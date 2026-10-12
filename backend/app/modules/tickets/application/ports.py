from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Protocol

from app.modules.tickets.domain.new_ticket import NewTicket
from app.modules.tickets.domain.receipt import AriadnaReceipt
from app.modules.tickets.domain.ticket import TicketRecord, TicketView


class TicketRepository(Protocol):
    async def list_by_requester(self, requester_id: str) -> list[TicketView]: ...

    async def list_all(self) -> list[TicketView]: ...

    async def get(self, number: int) -> TicketRecord | None:
        """The ticket with its events, oldest first; None when it does not exist."""
        ...

    async def create(self, new: NewTicket, receipt: AriadnaReceipt | None) -> TicketRecord:
        """Allocates the next number and writes the ticket, its "created" event and the receipt in
        one transaction. A submission key already stored returns that ticket instead."""
        ...

    async def find_by_submission_key(self, key: str) -> TicketRecord | None: ...

    async def request_contact(
        self, number: int, by: str, message: str | None, at: datetime
    ) -> TicketRecord | None:
        """Sets awaiting_user, bumps updated_at and appends a contact_requested event."""
        ...

    async def add_participants(
        self, number: int, user_ids: Sequence[str], by: str, body: str, at: datetime
    ) -> TicketRecord | None:
        """Adds the users (already-present ones are skipped), bumps updated_at and appends a
        participants_added event. None when the ticket is missing or closed."""
        ...

    async def update_ticket(
        self, number: int, changes: Mapping[str, str], by: str, body: str, at: datetime
    ) -> TicketRecord | None:
        """Applies summary/description/impact/urgency, bumps updated_at and appends an updated
        event. None when the ticket is missing or closed."""
        ...

    async def close(self, number: int, by: str, at: datetime) -> TicketRecord | None:
        """Resuelto -> Cerrado with a closed event, atomically. None when the ticket is missing or
        no longer Resuelto."""
        ...
