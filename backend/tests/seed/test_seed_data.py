from app.modules.tickets.domain.ticket import format_ticket_id
from app.seed.data import EVENTS, ORGANIZATION, RECEIPTS, TICKETS, USERS


def test_organization_is_the_fictional_regional_center() -> None:
    assert ORGANIZATION == "Centro Administrativo Regional Sur"


def test_three_users_with_one_role_each() -> None:
    by_name = {user.display_name: user.role for user in USERS}
    assert by_name == {"Ana Ruiz": "user", "Luis Herrera": "it", "Sara Molina": "supervisor"}
    assert len({user.id for user in USERS}) == 3


def test_users_match_the_mock_accounts() -> None:
    by_id = {user.id: (user.email, user.area) for user in USERS}
    assert by_id == {
        "ana": ("ana.ruiz@ejemplo.mx", "Finanzas"),
        "luis": ("luis.herrera@ejemplo.mx", "Mesa de ayuda"),
        "sara": ("sara.molina@ejemplo.mx", "Supervisión"),
    }


def test_user_emails_are_unique_and_use_the_fictional_domain() -> None:
    assert len({user.email for user in USERS}) == 3
    assert all(user.email.endswith("@ejemplo.mx") for user in USERS)


def test_eight_tickets_numbered_1053_to_1060() -> None:
    numbers = [ticket.number for ticket in TICKETS]
    assert sorted(numbers) == list(range(1053, 1061))
    assert len(set(numbers)) == 8
    assert [format_ticket_id(n) for n in sorted(numbers)][0] == "INC0001053"
    assert [format_ticket_id(n) for n in sorted(numbers)][-1] == "INC0001060"


def test_requesters_and_assignees_resolve_to_users_with_proper_roles() -> None:
    roles = {user.id: user.role for user in USERS}
    for ticket in TICKETS:
        assert ticket.requester_id in roles
        if ticket.assignee_id is not None:
            assert roles[ticket.assignee_id] == "it"
    assert any(ticket.assignee_id is not None for ticket in TICKETS)
    assert any(ticket.assignee_id is None for ticket in TICKETS)


def test_datetimes_are_timezone_aware_and_ordered() -> None:
    for ticket in TICKETS:
        assert ticket.created_at.tzinfo is not None
        assert ticket.updated_at.tzinfo is not None
        assert ticket.updated_at >= ticket.created_at
        if ticket.sla_due_at is not None:
            assert ticket.sla_due_at.tzinfo is not None
            assert ticket.sla_due_at > ticket.created_at


def test_seed_covers_every_stage_and_the_pending_flag() -> None:
    statuses = {ticket.status for ticket in TICKETS}
    assert statuses == {"new", "assigned", "in_progress", "resolved", "closed"}
    assert any(ticket.awaiting_user for ticket in TICKETS)
    assert any(not ticket.awaiting_user for ticket in TICKETS)
    assert any(ticket.via_ariadna for ticket in TICKETS)
    assert all(ticket.summary.strip() and ticket.description.strip() for ticket in TICKETS)


def test_seed_is_deterministic_across_imports() -> None:
    import importlib

    import app.seed.data as data

    first = data.TICKETS
    reloaded = importlib.reload(data)
    assert first == reloaded.TICKETS


def test_every_ticket_has_a_created_event_by_its_requester_at_creation_time() -> None:
    created = {e.ticket_number: e for e in EVENTS if e.kind == "created"}
    assert set(created) == {t.number for t in TICKETS}
    for ticket in TICKETS:
        event = created[ticket.number]
        assert event.author_id == ticket.requester_id
        assert event.created_at == ticket.created_at
        assert event.visible_to_requester is True


def test_assigned_events_exist_exactly_for_assigned_tickets() -> None:
    assigned = {e.ticket_number for e in EVENTS if e.kind == "assigned"}
    assert assigned == {t.number for t in TICKETS if t.assignee_id is not None}
    assert {1058, 1059}.isdisjoint(assigned)


def test_only_1056_has_a_contact_event_and_it_carries_a_message() -> None:
    contacts = [e for e in EVENTS if e.kind == "contact_requested"]
    assert [e.ticket_number for e in contacts] == [1056]
    assert contacts[0].author_id == "luis"
    assert contacts[0].body


def test_event_ids_are_unique_stable_and_fit_the_column() -> None:
    ids = [e.id for e in EVENTS]
    assert len(set(ids)) == len(ids)
    assert all(e.id.startswith(f"{e.ticket_number}-") and len(e.id) <= 16 for e in EVENTS)


def test_events_stay_between_creation_and_last_update() -> None:
    by_number = {t.number: t for t in TICKETS}
    for event in EVENTS:
        ticket = by_number[event.ticket_number]
        assert ticket.created_at <= event.created_at <= ticket.updated_at


def test_receipts_exist_only_for_the_tickets_that_went_through_ariadna() -> None:
    assert set(RECEIPTS) == {t.number for t in TICKETS if t.via_ariadna} == {1055, 1057, 1059}
    assert all(r.understood and r.reviewed and r.target_group for r in RECEIPTS.values())
