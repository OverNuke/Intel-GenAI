from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse

from app.modules.auth.api.deps import require_section
from app.modules.auth.api.schemas import AccessDenied, ErrorBody
from app.modules.auth.domain.user import User
from app.modules.tickets.api.deps import get_clock, get_ticket_repository
from app.modules.tickets.api.schemas import (
    MyTicketsOut,
    SubmitErrorOut,
    SubmitTicketIn,
    TicketDetailOut,
    detail_out,
    summary_out,
    ticket_out,
)
from app.modules.tickets.application.ports import TicketRepository
from app.modules.tickets.application.queries import get_for_viewer, list_mine
from app.modules.tickets.application.submit import SubmitCommand, SubmitFailed, submit
from app.modules.tickets.domain.access import summarize_mine

router = APIRouter(prefix="/tickets", tags=["tickets"])

Repo = Annotated[TicketRepository, Depends(get_ticket_repository)]
Clock = Annotated[Callable[[], datetime], Depends(get_clock)]
MyTicketsUser = Annotated[User, Depends(require_section("my-tickets"))]
NewRequestUser = Annotated[User, Depends(require_section("new-request"))]

_AUTH_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorBody},
    403: {"model": AccessDenied},
}
_NOT_FOUND = "No encontramos ese ticket."
_FAILURE_STATUS = {
    "missing-human-confirmation": 400,
    "confirmation-not-from-requester": 403,
    "incomplete-draft": 422,
    "unknown-service": 422,
}


@router.get("/mine", response_model=MyTicketsOut, responses=_AUTH_ERRORS)
async def get_my_tickets(user: MyTicketsUser, repo: Repo) -> MyTicketsOut:
    views = await list_mine(repo, user.id)
    return MyTicketsOut(
        summary=summary_out(summarize_mine([v.ticket for v in views])),
        tickets=[ticket_out(v) for v in views],
    )


@router.post(
    "",
    response_model=TicketDetailOut,
    status_code=201,
    responses={
        **_AUTH_ERRORS,
        200: {"model": TicketDetailOut, "description": "Earlier submission with the same key"},
        400: {"model": SubmitErrorOut},
        422: {"model": SubmitErrorOut},
    },
)
async def post_ticket(
    body: SubmitTicketIn, user: NewRequestUser, repo: Repo, clock: Clock, response: Response
) -> TicketDetailOut | JSONResponse:
    """Creates a ticket for the session user from a draft the person confirmed.

    The requester is never read from the body and Ariadna has no route to this endpoint.
    """
    result = await submit(
        repo,
        SubmitCommand(
            requester_id=user.id,
            service=body.draft.service,
            summary=body.draft.summary,
            description=body.draft.description,
            impact=body.draft.impact,
            urgency=body.draft.urgency,
            confirmed=body.confirmed,
            receipt=body.receipt.to_domain() if body.receipt else None,
            idempotency_key=body.idempotency_key,
        ),
        clock,
    )
    if isinstance(result, SubmitFailed):
        return JSONResponse(
            status_code=_FAILURE_STATUS[result.reason],
            content=SubmitErrorOut(reason=result.reason).model_dump(),
        )
    response.status_code = 201 if result.created else 200
    return detail_out(result.record)


@router.get(
    "/{display_id}",
    response_model=TicketDetailOut,
    responses={**_AUTH_ERRORS, 404: {"model": ErrorBody}},
)
async def get_ticket(display_id: str, user: MyTicketsUser, repo: Repo) -> TicketDetailOut:
    record = await get_for_viewer(repo, user, display_id)
    if record is None:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    return detail_out(record)
