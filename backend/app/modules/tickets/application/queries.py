from app.modules.auth.domain.user import User
from app.modules.tickets.application.ports import TicketRepository
from app.modules.tickets.domain.access import owns_ticket, parse_ticket_id
from app.modules.tickets.domain.ticket import TicketRecord, TicketView


async def list_mine(repo: TicketRepository, requester_id: str) -> list[TicketView]:
    """The requester's own tickets, newest first (a new ticket is therefore the first row)."""
    views = await repo.list_by_requester(requester_id)
    return sorted(views, key=lambda v: (v.ticket.created_at, v.ticket.number), reverse=True)


async def get_for_viewer(
    repo: TicketRepository, user: User, display_id: str
) -> TicketRecord | None:
    """None for malformed, unknown and foreign ids alike: callers answer 404 (REQ-UT-6)."""
    number = parse_ticket_id(display_id)
    if number is None:
        return None
    record = await repo.get(number)
    if record is None or not owns_ticket(user, record.view.ticket):
        return None
    return record
