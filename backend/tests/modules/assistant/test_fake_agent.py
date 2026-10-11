"""The fake in `agent` mode runs the same registry deterministically (CI exercises the loop)."""

from app.modules.assistant.application.ports import AssistantPort
from app.modules.assistant.application.tools import ToolBox, ToolContext
from app.modules.assistant.domain.conversation import Conversation, Draft, Entry, Message
from app.modules.assistant.domain.proposal import AddParticipants
from app.modules.assistant.infrastructure.fake import FakeAssistant
from tests.modules.assistant.stubs import StubRequesterTickets, StubUserLookup, make_ticket

REQUESTER = "u-requester"
NAMES = ["Ana Ruiz", "Luis Herrera", "Sara Molina"]


def _box(names: list[str] | None = None, tickets: StubRequesterTickets | None = None) -> ToolBox:
    mine = {REQUESTER: [make_ticket(9, "Red lenta en toda el area", "new", REQUESTER)]}
    return ToolBox(
        ToolContext(requester_id=REQUESTER),
        tickets=tickets or StubRequesterTickets(mine),
        users=StubUserLookup(names if names is not None else NAMES),
    )


def _agent(box: ToolBox | None = None) -> AssistantPort:
    return FakeAssistant(mode="agent").with_tools(box or _box())


def _conv(*messages: str, entry: Entry | None = None, draft: Draft | None = None) -> Conversation:
    return Conversation(
        entry=entry or Entry("new"),
        history=tuple(Message("user", m) for m in messages),
        draft=draft or Draft(),
    )


async def test_single_mode_is_byte_for_byte_the_slice_two_behaviour() -> None:
    conv = _conv("Tengo un problema con mi PC, los cables están pelados")
    plain = await FakeAssistant().next_turn(conv)
    bound = await FakeAssistant(mode="single").with_tools(_box()).next_turn(conv)
    assert bound == plain
    assert bound.steps == []


async def test_agent_mode_without_a_toolbox_behaves_like_single() -> None:
    conv = _conv("La impresora no imprime")
    assert await FakeAssistant(mode="agent").next_turn(conv) == await FakeAssistant().next_turn(
        conv
    )


async def test_agent_mode_always_checks_required_data_and_derives_reviewed() -> None:
    turn = await _agent().next_turn(_conv("La impresora del piso 2 no imprime"))
    assert turn.steps[0].name == "check_required_data"
    assert turn.reviewed == [s.summary for s in turn.steps if s.ok]
    assert turn.proposals == []


async def test_same_input_gives_the_same_trail() -> None:
    conv = _conv("La red está lenta en toda mi área", "agrega a Luis y a Sara")
    assert await _agent().next_turn(conv) == await _agent().next_turn(conv)


async def test_similar_own_tickets_are_checked_when_a_requester_is_bound() -> None:
    turn = await _agent().next_turn(_conv("La red está lenta en toda mi área"))
    names = [s.name for s in turn.steps]
    assert "find_similar_tickets" in names
    assert any("INC0000009" in s.summary for s in turn.steps)


async def test_adding_people_proposes_the_display_names_found() -> None:
    turn = await _agent().next_turn(_conv("No conecta la VPN", "Agrega a Luis y a Sara"))
    [proposal] = turn.proposals
    assert isinstance(proposal, AddParticipants)
    assert proposal.names == ["Luis Herrera", "Sara Molina"]
    assert proposal.ticket_ref is None
    assert [s.name for s in turn.steps].count("find_user") == 2


async def test_participants_on_a_ticket_conversation_carry_the_ticket_ref() -> None:
    entry = Entry("ticket", "INC0001056")
    conv = Conversation(
        entry=entry,
        history=(Message("user", "Por favor agrega a Sara a la solicitud"),),
        ticket_summary="Red lenta",
        ticket_status="new",
    )
    [proposal] = (await _agent().next_turn(conv)).proposals
    assert isinstance(proposal, AddParticipants)
    assert proposal.names == ["Sara Molina"]
    assert proposal.ticket_ref == "INC0001056"


async def test_unknown_names_become_a_warning_not_a_proposal_entry() -> None:
    turn = await _agent().next_turn(_conv("No conecta la VPN", "agrega a Luis y a Zacarias"))
    [proposal] = turn.proposals
    assert isinstance(proposal, AddParticipants)
    assert proposal.names == ["Luis Herrera"]
    warnings = [f for f in turn.flags if f.severity == "warning" and f.field == "participants"]
    assert len(warnings) == 1
    assert "Zacarias" in warnings[0].message


async def test_only_unknown_names_produce_no_proposal_at_all() -> None:
    turn = await _agent().next_turn(_conv("No conecta la VPN", "agrega a Zacarias"))
    assert turn.proposals == []
    assert any(f.field == "participants" and f.severity == "warning" for f in turn.flags)


async def test_ambiguous_names_are_flagged_and_not_guessed() -> None:
    box = _box(names=["Luis Herrera", "Luis Ortega"])
    turn = await _agent(box).next_turn(_conv("No conecta la VPN", "agrega a Luis"))
    assert turn.proposals == []
    assert any(f.field == "participants" and f.severity == "warning" for f in turn.flags)


async def test_the_requester_cannot_add_themselves() -> None:
    class _SelfAware(StubUserLookup):
        async def find_by_name(
            self, query: str, *, exclude_user_id: str | None = None
        ) -> list[str]:
            found = await super().find_by_name(query, exclude_user_id=exclude_user_id)
            return [] if exclude_user_id == REQUESTER and query.lower() == "ana" else found

    box = ToolBox(
        ToolContext(requester_id=REQUESTER),
        tickets=StubRequesterTickets({}),
        users=_SelfAware(NAMES),
    )
    turn = await _agent(box).next_turn(_conv("No conecta la VPN", "agrega a Ana"))
    assert turn.proposals == []


async def test_the_step_budget_is_respected_with_many_names() -> None:
    turn = await _agent().next_turn(
        _conv("No conecta la VPN", "agrega a Luis, Sara, Ana y Zacarias")
    )
    assert len(turn.steps) <= 4
    assert any(f.field == "participants" and f.severity == "warning" for f in turn.flags)


async def test_no_participant_phrase_means_no_user_lookup() -> None:
    turn = await _agent().next_turn(_conv("Necesito instalar un programa"))
    assert "find_user" not in [s.name for s in turn.steps]


async def test_a_failing_tool_does_not_break_the_turn() -> None:
    boom = StubRequesterTickets({}, error=RuntimeError("db down"))
    turn = await _agent(_box(tickets=boom)).next_turn(_conv("La red está lenta"))
    failed = [s for s in turn.steps if not s.ok]
    assert [s.name for s in failed] == ["find_similar_tickets"]
    assert failed[0].summary not in turn.reviewed
    assert turn.message


async def test_domain_flags_still_decide_readiness_in_agent_mode() -> None:
    turn = await _agent().next_turn(_conv("La impresora no imprime"))
    assert turn.ready is False
    assert [f.field for f in turn.flags if f.severity == "blocking"] == ["impact", "urgency"]
