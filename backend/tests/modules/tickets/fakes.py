"""Test-only in-memory TicketRepository (production adapter: infrastructure/sqlalchemy_tickets)."""

from collections.abc import Iterable, Mapping
from dataclasses import replace
from datetime import datetime

from app.modules.auth.domain.user import User
from app.modules.tickets.domain.new_ticket import NewTicket
from app.modules.tickets.domain.receipt import AriadnaReceipt
from app.modules.tickets.domain.ticket import Ticket, TicketEvent, TicketRecord, TicketView
from app.seed.data import TICKETS, USERS

FIRST_NEW_NUMBER = 1061  # ticket_number_seq starts here (the seed uses 1053..1060)


class InMemoryTicketRepository:
    def __init__(
        self,
        tickets: Iterable[Ticket] = TICKETS,
        users: Iterable[User] = USERS,
        events: Iterable[TicketEvent] = (),
        receipts: Mapping[int, AriadnaReceipt] | None = None,
    ) -> None:
        self._tickets = {t.number: t for t in tickets}
        self._users = {u.id: u for u in users}
        self._events = list(events)
        self._receipts = dict(receipts or {})
        self._keys: dict[str, int] = {}
        self._next = max(FIRST_NEW_NUMBER, *(n + 1 for n in self._tickets))

    def _view(self, ticket: Ticket) -> TicketView:
        requester = self._users.get(ticket.requester_id)
        assignee = self._users.get(ticket.assignee_id) if ticket.assignee_id else None
        return TicketView(
            ticket=ticket,
            requester_name=requester.display_name if requester else ticket.requester_id,
            assignee_name=assignee.display_name if assignee else None,
        )

    async def list_by_requester(self, requester_id: str) -> list[TicketView]:
        return [self._view(t) for t in self._tickets.values() if t.requester_id == requester_id]

    async def list_all(self) -> list[TicketView]:
        return [self._view(t) for t in self._tickets.values()]

    async def get(self, number: int) -> TicketRecord | None:
        ticket = self._tickets.get(number)
        if ticket is None:
            return None
        events = tuple(
            sorted(
                (e for e in self._events if e.ticket_number == number),
                key=lambda e: e.created_at,
            )
        )
        return TicketRecord(
            view=self._view(ticket),
            events=events,
            receipt=self._receipts.get(number),
            people={u.id: u.display_name for u in self._users.values()},
        )

    async def find_by_submission_key(self, key: str) -> TicketRecord | None:
        number = self._keys.get(key)
        return await self.get(number) if number is not None else None

    async def create(self, new: NewTicket, receipt: AriadnaReceipt | None) -> TicketRecord:
        if new.submission_key and new.submission_key in self._keys:
            existing = await self.find_by_submission_key(new.submission_key)
            assert existing is not None
            return existing
        number = self._next
        self._next += 1
        ticket = Ticket(
            number=number,
            summary=new.summary,
            description=new.description,
            service=new.service,
            status="new",
            awaiting_user=False,
            priority=new.priority,
            impact=new.impact,
            urgency=new.urgency,
            assigned_group=new.assigned_group,
            assignee_id=None,
            requester_id=new.requester_id,
            asset=None,
            via_ariadna=new.via_ariadna,
            sla_due_at=new.sla_due_at,
            created_at=new.created_at,
            updated_at=new.created_at,
        )
        self._tickets[number] = ticket
        self._events.append(
            TicketEvent(
                id=f"{number}-1",
                ticket_number=number,
                kind="created",
                author_id=new.requester_id,
                body=None,
                visible_to_requester=True,
                created_at=new.created_at,
            )
        )
        if receipt is not None:
            self._receipts[number] = receipt
        if new.submission_key:
            self._keys[new.submission_key] = number
        record = await self.get(number)
        assert record is not None
        return record

    async def request_contact(
        self, number: int, by: str, message: str | None, at: datetime
    ) -> TicketRecord | None:
        ticket = self._tickets.get(number)
        if ticket is None:
            return None
        self._tickets[number] = replace(ticket, awaiting_user=True, updated_at=at)
        seq = sum(1 for e in self._events if e.ticket_number == number) + 1
        self._events.append(
            TicketEvent(
                id=f"{number}-{seq}",
                ticket_number=number,
                kind="contact_requested",
                author_id=by,
                body=message,
                visible_to_requester=True,
                created_at=at,
            )
        )
        return await self.get(number)
