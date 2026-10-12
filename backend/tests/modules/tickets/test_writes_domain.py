"""Pure rules of the three confirmed writes: participants, update, close."""

import json

from app.modules.auth.domain.user import User
from app.modules.tickets.domain.ticket import Ticket
from app.modules.tickets.domain.writes import (
    MAX_PARTICIPANTS,
    WriteConfirmation,
    check_close,
    check_participants_write,
    plan_participants,
    plan_update,
    update_event_body,
)
from app.seed.data import TICKETS

ANA, LUIS, SARA = "ana", "luis", "sara"


def _ticket(number: int) -> Ticket:
    return next(t for t in TICKETS if t.number == number)


def _human(actor_id: str, role: str = "user") -> WriteConfirmation:
    return WriteConfirmation(by="human", actor_id=actor_id, actor_role=role)  # type: ignore[arg-type]


def _user(user_id: str, name: str) -> User:
    return User(id=user_id, display_name=name, email=f"{user_id}@x.mx", role="user", area="A")


# --- participants

OPEN = _ticket(1055)  # in_progress, requester ana, assignee luis


def test_participants_write_needs_a_human_confirmation_from_the_requester() -> None:
    assert check_participants_write(OPEN, None) == "missing-human-confirmation"
    bot = WriteConfirmation(by="assistant", actor_id=ANA, actor_role="user")
    assert check_participants_write(OPEN, bot) == "missing-human-confirmation"
    assert check_participants_write(OPEN, _human(SARA, "supervisor")) == (
        "confirmation-not-from-requester"
    )
    assert check_participants_write(OPEN, _human(ANA)) is None


def test_participants_cannot_be_added_to_a_closed_ticket() -> None:
    assert check_participants_write(_ticket(1053), _human(ANA)) == "ticket-closed"


def test_plan_adds_resolved_users_and_ignores_requester_assignee_and_duplicates() -> None:
    sara = _user("sara", "Sara Molina")
    plan = plan_participants(
        requester_id=ANA,
        assignee_id=LUIS,
        current=(),
        resolved=[
            ("Ana", [_user(ANA, "Ana Ruiz")]),
            ("Luis", [_user(LUIS, "Luis Herrera")]),
            ("Sara", [sara]),
            ("sara molina", [sara]),
        ],
    )
    assert plan.to_add == (sara,)
    assert plan.unknown == () and plan.ambiguous == () and plan.over_limit == ()


def test_plan_ignores_people_already_participating() -> None:
    sara = _user("sara", "Sara Molina")
    plan = plan_participants(
        requester_id=ANA, assignee_id=None, current=("sara",), resolved=[("sara", [sara])]
    )
    assert plan.to_add == ()


def test_plan_reports_unknown_and_ambiguous_names_without_picking_one() -> None:
    candidates = [_user("a1", "Ana Ruiz"), _user("a2", "Ana López")]
    plan = plan_participants(
        requester_id="zzz",
        assignee_id=None,
        current=(),
        resolved=[("Pedro", []), ("Ana", candidates)],
    )
    assert plan.to_add == ()
    assert plan.unknown == ("Pedro",)
    assert [(a.name, a.candidates) for a in plan.ambiguous] == [("Ana", ("Ana Ruiz", "Ana López"))]


def test_plan_caps_the_ticket_at_eight_participants() -> None:
    current = tuple(f"u{i}" for i in range(MAX_PARTICIPANTS - 1))
    extra = [(f"n{i}", [_user(f"x{i}", f"Persona {i}")]) for i in range(3)]
    plan = plan_participants(requester_id=ANA, assignee_id=None, current=current, resolved=extra)
    assert [u.id for u in plan.to_add] == ["x0"]
    assert [u.id for u in plan.over_limit] == ["x1", "x2"]


def test_plan_ignores_blank_names() -> None:
    plan = plan_participants(
        requester_id=ANA, assignee_id=None, current=(), resolved=[("  ", [])]
    )
    assert plan.unknown == () and plan.to_add == ()


# --- update


def test_update_needs_a_human_confirmation_from_the_requester() -> None:
    assert plan_update(OPEN, {"summary": "x"}, None) == "missing-human-confirmation"
    assert plan_update(OPEN, {"summary": "x"}, _human(LUIS, "it")) == (
        "confirmation-not-from-requester"
    )


def test_update_is_rejected_on_a_closed_ticket() -> None:
    assert plan_update(_ticket(1053), {"summary": "x"}, _human(ANA)) == "ticket-closed"


def test_update_rejects_unknown_fields_and_empty_changes() -> None:
    assert plan_update(OPEN, {"status": "closed"}, _human(ANA)) == "unknown-field"
    assert plan_update(OPEN, {"requester_id": "luis"}, _human(ANA)) == "unknown-field"
    assert plan_update(OPEN, {}, _human(ANA)) == "no-changes"


def test_update_rejects_values_that_are_not_valid_for_the_field() -> None:
    for changes in (
        {"summary": "   "},
        {"summary": "x" * 201},
        {"description": ""},
        {"impact": "enormous"},
        {"urgency": None},
    ):
        assert plan_update(OPEN, changes, _human(ANA)) == "invalid-value"


def test_update_keeps_only_what_actually_changes_with_before_and_after() -> None:
    plan = plan_update(
        OPEN,
        {"summary": "  Nuevo resumen  ", "urgency": OPEN.urgency, "impact": "high"},
        _human(ANA),
    )
    assert not isinstance(plan, str)
    assert plan.after == {"summary": "Nuevo resumen", "impact": "high"}
    assert plan.before == {"summary": OPEN.summary, "impact": OPEN.impact}
    body = json.loads(update_event_body(plan))
    assert body == {
        "summary": {"before": OPEN.summary, "after": "Nuevo resumen"},
        "impact": {"before": OPEN.impact, "after": "high"},
    }


def test_update_with_only_identical_values_is_no_changes() -> None:
    assert plan_update(OPEN, {"summary": OPEN.summary}, _human(ANA)) == "no-changes"


# --- close

RESOLVED = _ticket(1054)  # resolved, requester ana, assignee luis


def test_close_needs_a_human_confirmation() -> None:
    assert check_close(RESOLVED, None) == "missing-human-confirmation"
    bot = WriteConfirmation(by="assistant", actor_id=ANA, actor_role="user")
    assert check_close(RESOLVED, bot) == "missing-human-confirmation"


def test_close_is_allowed_to_the_requester_and_to_it_once_resolved() -> None:
    assert check_close(RESOLVED, _human(ANA)) is None
    assert check_close(RESOLVED, _human(LUIS, "it")) is None


def test_close_is_denied_to_anyone_else() -> None:
    assert check_close(RESOLVED, _human(SARA, "supervisor")) == "not-allowed"
    assert check_close(RESOLVED, _human("otro", "user")) == "not-allowed"


def test_close_is_refused_unless_the_ticket_is_resolved() -> None:
    for number in (1055, 1058, 1060):
        assert check_close(_ticket(number), _human(ANA)) == "not-resolved"
    assert check_close(_ticket(1053), _human(ANA)) == "already-closed"
