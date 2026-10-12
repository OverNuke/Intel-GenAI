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


# --- One-line intake (slice 2)

ONE_LINER = "Tengo un problema técnico con mi PC, los cables están pelados"


async def test_one_line_intake_fills_the_draft_from_the_first_sentence() -> None:
    turn = await FAKE.next_turn(_conv(ONE_LINER))
    assert turn.draft.service == "hardware"
    assert turn.draft.description == ONE_LINER
    assert turn.draft.summary
    assert turn.target_group == "Soporte a equipos de cómputo"


async def test_exposed_cables_are_a_safety_hint_so_urgency_is_high() -> None:
    turn = await FAKE.next_turn(_conv(ONE_LINER))
    assert turn.draft.urgency == "high"
    assert turn.draft.impact is None


async def test_one_line_intake_blocks_on_impact_and_warns_about_the_asset_number() -> None:
    turn = await FAKE.next_turn(_conv(ONE_LINER))
    blocking = [f.field for f in turn.flags if f.severity == "blocking"]
    warnings = [f.field for f in turn.flags if f.severity == "warning"]
    assert blocking == ["impact"]
    assert warnings == ["asset_number"]
    assert turn.missing_data == ["Impacto"]
    assert turn.ready is False
    assert turn.message.count("?") == 1


async def test_asset_number_in_the_sentence_clears_the_warning() -> None:
    turn = await FAKE.next_turn(_conv(ONE_LINER + ". Equipo AT-004512"))
    assert [f for f in turn.flags if f.severity == "warning"] == []


async def test_safety_hint_beats_a_calm_phrase_but_not_the_users_own_urgency() -> None:
    calm = await FAKE.next_turn(_conv("Hay humo en mi equipo, pero puede esperar"))
    assert calm.draft.urgency == "high"
    edited = await FAKE.next_turn(_conv(ONE_LINER, draft=Draft(urgency="low")))
    assert edited.draft.urgency == "low"


async def test_pc_and_cables_route_to_hardware() -> None:
    for text in ("Mi PC no enciende", "El cable del monitor está roto", "Mi computadora es lenta"):
        assert (await FAKE.next_turn(_conv(text))).draft.service == "hardware"


async def test_words_containing_a_safety_word_do_not_trigger_it() -> None:
    turn = await FAKE.next_turn(_conv("La impresora no imprime, tiene buen humor"))
    assert turn.draft.urgency is None


async def test_blocking_flags_match_the_missing_list_each_turn() -> None:
    turn = await FAKE.next_turn(_conv("La impresora no imprime"))
    assert [f.field for f in turn.flags if f.severity == "blocking"] == ["impact", "urgency"]
    assert turn.missing_data == ["Impacto", "Urgencia"]
