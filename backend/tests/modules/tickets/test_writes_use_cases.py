"""Participants, update and close use cases over the in-memory doubles."""

import json
from datetime import UTC, datetime

from app.modules.auth.domain.user import User
from app.modules.tickets.application.writes import (
    CloseDone,
    CloseRefused,
    ParticipantsDone,
    ParticipantsRefused,
    UpdateDone,
    UpdateRefused,
    WriteCommand,
    WriteNotFound,
    add_participants,
    close_ticket,
    update_ticket,
)
from app.seed.data import EVENTS, TICKETS, USERS
from tests.modules.auth.fakes import InMemoryUserDirectory
from tests.modules.tickets.fakes import InMemoryTicketRepository

NOW = datetime(2026, 10, 11, 12, 0, tzinfo=UTC)
ANA, LUIS, SARA = (next(u for u in USERS if u.id == i) for i in ("ana", "luis", "sara"))
OTHER = User(id="otro", display_name="Otra Persona", email="o@x.mx", role="user", area="A")


def _clock() -> datetime:
    return NOW


def _repo(extra_users: tuple[User, ...] = ()) -> InMemoryTicketRepository:
    return InMemoryTicketRepository(users=(*USERS, *extra_users), events=EVENTS)


def _cmd(actor: User = ANA, confirmed: bool = True) -> WriteCommand:
    return WriteCommand(actor=actor, confirmed=confirmed)


# --- add_participants


async def test_participants_resolves_names_server_side_and_logs_the_event() -> None:
    repo = _repo()
    result = await add_participants(
        repo, InMemoryUserDirectory(), "INC0001055", ["sara molina"], _cmd(), _clock
    )
    assert isinstance(result, ParticipantsDone)
    assert result.added == ("Sara Molina",)
    assert result.record.participants == ("sara",)
    last = result.record.events[-1]
    assert (last.kind, last.author_id, last.visible_to_requester) == (
        "participants_added",
        "ana",
        True,
    )
    assert last.body == "Sara Molina"
    assert result.record.view.ticket.updated_at == NOW


async def test_participants_ignores_requester_assignee_and_duplicates_without_an_event() -> None:
    repo = _repo()
    result = await add_participants(
        repo, InMemoryUserDirectory(), "INC0001055", ["Ana", "Luis", "Luis"], _cmd(), _clock
    )
    assert isinstance(result, ParticipantsDone)
    assert result.added == ()
    assert result.record.participants == ()
    assert [e.kind for e in result.record.events] == ["created", "assigned"]


async def test_participants_reports_ambiguous_and_unknown_names_but_adds_the_rest() -> None:
    twin = User(id="ana2", display_name="Ana López", email="a2@x.mx", role="user", area="A")
    repo = _repo((twin,))
    result = await add_participants(
        repo,
        InMemoryUserDirectory((*USERS, twin)),
        "INC0001055",
        ["ana", "Pedro", "Sara"],
        _cmd(),
        _clock,
    )
    assert isinstance(result, ParticipantsDone)
    assert result.added == ("Sara Molina",)
    assert result.unknown == ("Pedro",)
    assert [(a.name, a.candidates) for a in result.ambiguous] == [
        ("ana", ("Ana Ruiz", "Ana López"))
    ]


async def test_participants_are_capped_at_eight_and_the_rest_reported() -> None:
    people = tuple(
        User(id=f"p{i}", display_name=f"Persona{i} Demo", email=f"p{i}@x.mx", role="user", area="A")
        for i in range(10)
    )
    repo = _repo(people)
    directory = InMemoryUserDirectory((*USERS, *people))
    names = [p.display_name for p in people]
    result = await add_participants(repo, directory, "INC0001055", names, _cmd(), _clock)
    assert isinstance(result, ParticipantsDone)
    assert len(result.record.participants) == 8
    assert len(result.added) == 8
    assert result.over_limit == ("Persona8 Demo", "Persona9 Demo")


async def test_participants_need_the_human_confirmation_and_write_nothing() -> None:
    repo = _repo()
    result = await add_participants(
        repo, InMemoryUserDirectory(), "INC0001055", ["Sara"], _cmd(confirmed=False), _clock
    )
    assert result == ParticipantsRefused("missing-human-confirmation")
    record = await repo.get(1055)
    assert record is not None and record.participants == ()


async def test_participants_of_a_foreign_unknown_or_malformed_ticket_are_404() -> None:
    repo = _repo((OTHER,))
    directory = InMemoryUserDirectory()
    cases = ((OTHER, "INC0001055"), (SARA, "INC0001055"), (ANA, "INC0009999"), (ANA, "garbage"))
    for actor, display_id in cases:
        result = await add_participants(repo, directory, display_id, ["Sara"], _cmd(actor), _clock)
        assert isinstance(result, WriteNotFound)


async def test_participants_with_no_usable_names_are_refused() -> None:
    result = await add_participants(
        _repo(), InMemoryUserDirectory(), "INC0001055", ["  ", ""], _cmd(), _clock
    )
    assert result == ParticipantsRefused("no-names")


async def test_participants_cannot_join_a_closed_ticket() -> None:
    result = await add_participants(
        _repo(), InMemoryUserDirectory(), "INC0001053", ["Sara"], _cmd(), _clock
    )
    assert result == ParticipantsRefused("ticket-closed")


# --- update_ticket


async def test_update_changes_the_fields_and_logs_before_and_after_for_the_requester() -> None:
    repo = _repo()
    result = await update_ticket(
        repo, "INC0001055", {"summary": "Correo no sincroniza", "impact": "high"}, _cmd(), _clock
    )
    assert isinstance(result, UpdateDone)
    ticket = result.record.view.ticket
    assert (ticket.summary, ticket.impact, ticket.updated_at) == (
        "Correo no sincroniza",
        "high",
        NOW,
    )
    event = result.record.events[-1]
    assert (event.kind, event.author_id, event.visible_to_requester) == ("updated", "ana", True)
    assert event.body is not None
    body = json.loads(event.body)
    assert body["summary"]["after"] == "Correo no sincroniza"
    assert body["impact"] == {"before": "low", "after": "high"}


async def test_update_rejections_do_not_write() -> None:
    repo = _repo((OTHER,))
    unconfirmed = await update_ticket(
        repo, "INC0001055", {"summary": "x"}, _cmd(confirmed=False), _clock
    )
    assert unconfirmed == UpdateRefused("missing-human-confirmation")
    assert await update_ticket(repo, "INC0001055", {}, _cmd(), _clock) == UpdateRefused(
        "no-changes"
    )
    unknown = await update_ticket(repo, "INC0001055", {"status": "closed"}, _cmd(), _clock)
    assert unknown == UpdateRefused("unknown-field")
    closed = await update_ticket(repo, "INC0001053", {"summary": "x"}, _cmd(), _clock)
    assert closed == UpdateRefused("ticket-closed")
    for actor in (OTHER, SARA, LUIS):
        result = await update_ticket(repo, "INC0001055", {"summary": "x"}, _cmd(actor), _clock)
        assert isinstance(result, WriteNotFound)
    record = await repo.get(1055)
    assert record is not None
    original = next(t for t in TICKETS if t.number == 1055)
    assert record.view.ticket == original


# --- close_ticket


async def test_the_requester_closes_a_resolved_ticket_and_is_the_event_author() -> None:
    repo = _repo()
    result = await close_ticket(repo, "INC0001054", _cmd(ANA), _clock)
    assert isinstance(result, CloseDone)
    assert result.record.view.ticket.status == "closed"
    last = result.record.events[-1]
    assert (last.kind, last.author_id, last.visible_to_requester) == ("closed", "ana", True)


async def test_it_may_close_a_resolved_ticket_too() -> None:
    result = await close_ticket(_repo(), "INC0001054", _cmd(LUIS), _clock)
    assert isinstance(result, CloseDone)
    assert result.record.events[-1].author_id == "luis"
    assert result.record.view.ticket.status == "closed"


async def test_close_is_refused_unless_the_ticket_is_resolved() -> None:
    repo = _repo()
    for number in ("INC0001055", "INC0001058", "INC0001060"):
        assert await close_ticket(repo, number, _cmd(), _clock) == CloseRefused("not-resolved")
    assert await close_ticket(repo, "INC0001053", _cmd(), _clock) == CloseRefused("already-closed")
    assert isinstance(await close_ticket(repo, "INC0001054", _cmd(), _clock), CloseDone)
    assert await close_ticket(repo, "INC0001054", _cmd(), _clock) == CloseRefused("already-closed")


async def test_close_needs_confirmation_and_hides_foreign_tickets() -> None:
    repo = _repo((OTHER,))
    unconfirmed = await close_ticket(repo, "INC0001054", _cmd(confirmed=False), _clock)
    assert unconfirmed == CloseRefused("missing-human-confirmation")
    for actor in (OTHER, SARA):
        result = await close_ticket(repo, "INC0001054", _cmd(actor), _clock)
        assert isinstance(result, WriteNotFound)
    assert isinstance(await close_ticket(repo, "INC0009999", _cmd(), _clock), WriteNotFound)
    record = await repo.get(1054)
    assert record is not None and record.view.ticket.status == "resolved"
