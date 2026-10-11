from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from app.modules.assistant.api.deps import (
    get_assistant,
    get_requester_tickets,
    get_ticket_lookup,
    get_user_lookup,
)
from app.modules.assistant.api.schemas import (
    ConversationIn,
    DraftOut,
    HandoffResult,
    TurnResponse,
    TurnResult,
)
from app.modules.assistant.application.converse import converse
from app.modules.assistant.application.ports import (
    AssistantPort,
    RequesterTickets,
    TicketLookup,
    UserLookup,
)
from app.modules.assistant.application.tools import ToolAwareAssistant, ToolBox, ToolContext
from app.modules.assistant.domain.conversation import Conversation, Entry, Message
from app.modules.assistant.domain.errors import Handoff
from app.modules.auth.api.deps import require_section
from app.modules.auth.api.schemas import AccessDenied, ErrorBody
from app.modules.auth.domain.user import User
from app.modules.catalog.domain.services import get_service
from app.modules.tickets.domain.access import owns_ticket, parse_ticket_id

router = APIRouter(prefix="/assistant", tags=["assistant"])

AssistantUser = Annotated[User, Depends(require_section("new-request"))]

_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorBody},
    403: {"model": AccessDenied},
    404: {"model": ErrorBody},
}
_TICKET_NOT_FOUND = "No encontramos ese ticket."


async def _build_conversation(
    body: ConversationIn, user: User, lookup: TicketLookup
) -> Conversation:
    entry = Entry(kind=body.entry.kind, ref=body.entry.ref)
    ticket_summary: str | None = None
    ticket_status: str | None = None

    if entry.kind == "service" and (entry.ref is None or get_service(entry.ref) is None):
        raise HTTPException(status_code=422, detail="Servicio desconocido.")
    if entry.kind == "ticket":
        if entry.ref is None:
            raise HTTPException(status_code=422, detail="Falta el ticket.")
        number = parse_ticket_id(entry.ref)
        record = await lookup.get(number) if number is not None else None
        # Foreign, unknown and malformed ids are indistinguishable (404).
        if record is None or not owns_ticket(user, record.view.ticket):
            raise HTTPException(status_code=404, detail=_TICKET_NOT_FOUND)
        ticket_summary = record.view.ticket.summary
        ticket_status = record.view.ticket.status

    return Conversation(
        entry=entry,
        history=tuple(Message(role=m.role, content=m.content) for m in body.history),
        draft=body.draft.to_domain(),
        ticket_summary=ticket_summary,
        ticket_status=ticket_status,
    )


@router.post("/turn", response_model=TurnResponse, responses=_ERRORS)
async def post_turn(
    body: ConversationIn,
    user: AssistantUser,
    port: Annotated[AssistantPort, Depends(get_assistant)],
    lookup: Annotated[TicketLookup, Depends(get_ticket_lookup)],
    tickets: Annotated[RequesterTickets, Depends(get_requester_tickets)],
    users: Annotated[UserLookup, Depends(get_user_lookup)],
) -> TurnResult | HandoffResult:
    """Stateless: nothing is stored. LLM failures answer 200 with a handoff, never 5xx."""
    conversation = await _build_conversation(body, user, lookup)
    # The requester is bound here, server-side, from the session: never in the conversation.
    toolbox = ToolBox(ToolContext(requester_id=user.id), tickets=tickets, users=users)
    bound = port.with_tools(toolbox) if isinstance(port, ToolAwareAssistant) else port
    result = await converse(bound, conversation)
    if isinstance(result, Handoff):
        draft = result.draft
        return HandoffResult(
            reason=result.reason,
            draft=DraftOut(
                service=draft.service,
                summary=draft.summary,
                description=draft.description,
                impact=draft.impact,
                urgency=draft.urgency,
            ),
        )
    return TurnResult(turn=result)
