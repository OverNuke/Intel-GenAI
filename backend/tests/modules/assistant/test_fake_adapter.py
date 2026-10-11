"""The fake is deterministic and rule-based: tests assert fields and control flow, never prose."""

from app.modules.assistant.domain.conversation import Conversation, Draft, Entry, Message
from app.modules.assistant.infrastructure.fake import FakeAssistant

FAKE = FakeAssistant()


def _conv(
    *messages: str, entry: Entry | None = None, draft: Draft | None = None
) -> Conversation:
    return Conversation(
        entry=entry or Entry("new"),
        history=tuple(Message("user", m) for m in messages),
        draft=draft or Draft(),
    )


async def test_same_input_gives_the_same_output() -> None:
    conv = _conv("La impresora del piso 2 no imprime")
    assert await FAKE.next_turn(conv) == await FAKE.next_turn(conv)


async def test_routes_keywords_to_the_catalog_service_and_its_group() -> None:
    turn = await FAKE.next_turn(_conv("La impresora del piso 2 no imprime"))
    assert turn.draft.service == "printing"
    assert turn.target_group == "Soporte de impresión"
    assert turn.draft.summary
    assert turn.draft.description


async def test_different_text_routes_elsewhere() -> None:
    for text, service in (
        ("No conecta la VPN desde casa", "network"),
        ("Necesito instalar un programa", "software"),
        ("Olvidé mi contraseña", "access"),
    ):
        assert (await FAKE.next_turn(_conv(text))).draft.service == service


async def test_scoped_entry_keeps_the_chosen_service_over_keywords() -> None:
    turn = await FAKE.next_turn(_conv("No conecta la VPN", entry=Entry("service", "hardware")))
    assert turn.draft.service == "hardware"


async def test_asks_exactly_one_missing_thing_per_turn_and_lists_it() -> None:
    first = await FAKE.next_turn(_conv("La impresora no imprime"))
    assert first.ready is False
    assert first.message.count("?") == 1
    assert first.missing_data[0] == "Impacto"

    second = await FAKE.next_turn(
        _conv("La impresora no imprime", "Afecta a varias personas")
    )
    assert second.draft.impact == "medium"
    assert second.missing_data[0] == "Urgencia"
    assert second.message.count("?") == 1
    assert second.message != first.message


async def test_is_ready_once_impact_and_urgency_are_known() -> None:
    turn = await FAKE.next_turn(
        _conv(
            "La impresora no imprime",
            "Solo me afecta a mí",
            "Puede esperar",
        )
    )
    assert turn.draft.impact == "low"
    assert turn.draft.urgency == "low"
    assert turn.ready is True
    assert turn.missing_data == []
    assert "?" not in turn.message


async def test_user_edits_in_the_draft_win_over_inferred_values() -> None:
    draft = Draft(service="network", summary="Mi resumen", description="Mi texto", impact="high")
    turn = await FAKE.next_turn(_conv("La impresora no imprime", draft=draft))
    assert turn.draft.summary == "Mi resumen"
    assert turn.draft.description == "Mi texto"
    assert turn.draft.impact == "high"
    assert turn.draft.service == "network"


async def test_software_flags_the_manager_authorization_notice() -> None:
    turn = await FAKE.next_turn(_conv("Necesito instalar un programa"))
    assert turn.needs_authorization is True
    assert turn.permissions_notice
    plain = await FAKE.next_turn(_conv("La impresora no imprime"))
    assert plain.needs_authorization is False
    assert plain.permissions_notice is None


async def test_ticket_help_entry_uses_the_ticket_summary_as_context() -> None:
    conv = Conversation(
        entry=Entry("ticket", "INC0001056"),
        history=(),
        ticket_summary="Red lenta en toda el área de captura",
        ticket_status="in_progress",
    )
    turn = await FAKE.next_turn(conv)
    assert turn.draft.service == "network"
    assert turn.ready is False
