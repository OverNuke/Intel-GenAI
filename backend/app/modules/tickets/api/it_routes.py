"""IT desk API (T1/T2). Every route needs the `ticket-tracking` section (role TI)."""

from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.modules.auth.api.deps import require_section
from app.modules.auth.api.schemas import AccessDenied, ErrorBody
from app.modules.auth.domain.user import User
from app.modules.tickets.api.deps import get_clock, get_ticket_repository
from app.modules.tickets.api.schemas import (
    ContactErrorOut,
    ContactIn,
    ItTicketOut,
    QueueOut,
    it_record_out,
    queue_out,
)
from app.modules.tickets.application.contact import (
    ContactDone,
    ContactNotFound,
    contact_requester,
)
from app.modules.tickets.application.ports import TicketRepository
from app.modules.tickets.application.queue import list_queue
from app.modules.tickets.domain.access import can_view, parse_ticket_id

router = APIRouter(prefix="/it", tags=["it-desk"])

Repo = Annotated[TicketRepository, Depends(get_ticket_repository)]
Clock = Annotated[Callable[[], datetime], Depends(get_clock)]
ItUser = Annotated[User, Depends(require_section("ticket-tracking"))]

_AUTH_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorBody},
    403: {"model": AccessDenied},
}


@router.get("/tickets", response_model=QueueOut, responses=_AUTH_ERRORS)
async def get_queue(user: ItUser, repo: Repo, clock: Clock) -> QueueOut:
    """Full queue plus its counters; tabs, filters and sorting are applied client-side."""
    return queue_out(await list_queue(repo, user.id, clock))


_NOT_FOUND = "No encontramos ese ticket."


@router.get(
    "/tickets/{display_id}",
    response_model=ItTicketOut,
    responses={**_AUTH_ERRORS, 404: {"model": ErrorBody}},
)
async def get_record(display_id: str, user: ItUser, repo: Repo, clock: Clock) -> ItTicketOut:
    number = parse_ticket_id(display_id)
    record = await repo.get(number) if number is not None else None
    if record is None or not can_view(user, record.view.ticket):
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    return it_record_out(record, clock())


@router.post(
    "/tickets/{display_id}/contact",
    response_model=ItTicketOut,
    responses={
        **_AUTH_ERRORS,
        404: {"model": ErrorBody},
        409: {"model": ContactErrorOut},
        422: {"model": ContactErrorOut},
    },
)
async def post_contact(
    display_id: str, body: ContactIn, user: ItUser, repo: Repo, clock: Clock
) -> ItTicketOut | JSONResponse:
    """"Contactar al usuario": sets Pendiente, logs the contact, never changes the status."""
    result = await contact_requester(repo, user.id, display_id, body.message, clock)
    if isinstance(result, ContactNotFound):
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    if isinstance(result, ContactDone):
        return it_record_out(result.record, clock())
    status = 409 if result.reason == "ticket-finished" else 422
    return JSONResponse(
        status_code=status, content=ContactErrorOut(reason=result.reason).model_dump()
    )
