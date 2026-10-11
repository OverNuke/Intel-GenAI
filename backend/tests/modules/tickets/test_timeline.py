from datetime import UTC, datetime

from app.modules.tickets.domain.ticket import TicketEvent
from app.modules.tickets.domain.timeline import contact_notice, requester_events


def _event(seq: int, kind: str, body: str | None, hour: int, visible: bool = True) -> TicketEvent:
    return TicketEvent(
        id=f"1056-{seq}",
        ticket_number=1056,
        kind=kind,  # type: ignore[arg-type]
        author_id="luis",
        body=body,
        visible_to_requester=visible,
        created_at=datetime(2026, 1, 8, hour, 0, tzinfo=UTC),
    )


def test_contact_notice_is_the_latest_contact_message_while_awaiting() -> None:
    events = (
        _event(1, "created", None, 9),
        _event(2, "contact_requested", "Primera pregunta", 10),
        _event(3, "contact_requested", "Confirma la extensión", 12),
    )
    assert contact_notice(events, awaiting_user=True) == "Confirma la extensión"


def test_contact_notice_is_none_when_not_awaiting_or_without_a_message() -> None:
    events = (_event(1, "contact_requested", "Confirma la extensión", 10),)
    assert contact_notice(events, awaiting_user=False) is None
    assert contact_notice((_event(1, "contact_requested", None, 10),), awaiting_user=True) is None
    assert contact_notice((_event(1, "created", None, 9),), awaiting_user=True) is None


def test_requester_events_keep_only_visible_ones_oldest_first() -> None:
    events = (
        _event(3, "note", "interna", 12, visible=False),
        _event(2, "assigned", None, 10),
        _event(1, "created", None, 9),
    )
    assert [e.id for e in requester_events(events)] == ["1056-1", "1056-2"]
