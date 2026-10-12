"""Impact is a domain fact inferred from what the person wrote, never left to an adapter."""

from dataclasses import replace

import pytest

from app.modules.assistant.application.converse import converse
from app.modules.assistant.domain.conversation import Conversation, Draft, Entry, Message
from app.modules.assistant.domain.impact import infer_impact, with_inferred_impact
from app.modules.assistant.domain.turn import AssistantTurn, TurnDraft
from app.modules.assistant.infrastructure.fake import FakeAssistant
from app.modules.tickets.domain.ticket import Impact

SCREENSHOT = (
    "Hola necesito crear un ticket para el area de contabilidad, el internet se encuentra "
    "inestable y no me permite trabajar a mí y a otros tres compañeros"
)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        (SCREENSHOT, "medium"),
        ("no me deja trabajar a mí y a otros tres compañeros", "medium"),
        ("nos afecta a mí y a otro compañero", "medium"),
        ("somos 4 personas sin internet", "medium"),
        ("a mí y a otros cuatro", "medium"),
        ("Afecta a varias personas", "medium"),
        ("Afecta a varios compañeros", "medium"),
        ("también a mis compañeros", "medium"),
        ("no solo a mí, también a mis compañeros", "medium"),
        ("Solo me afecta a mí", "low"),
        ("solo yo no puedo imprimir", "low"),
        ("Afecta a toda mi área", "high"),
        ("toda el área de captura", "high"),
        ("todo el departamento de contabilidad", "high"),
        ("a mí y a otros nueve compañeros", "high"),
        ("somos 25 personas", "high"),
        ("La impresora no imprime", None),
        ("varios errores en el programa", None),
        ("todos los días falla la VPN", None),
        ("", None),
    ],
)
def test_infers_impact_from_a_single_message(text: str, expected: Impact | None) -> None:
    assert infer_impact([text]) == expected


def test_the_latest_message_wins() -> None:
    assert infer_impact(["Solo me afecta a mí", "perdón, nos pasa a toda mi área"]) == "high"


def test_accents_and_case_do_not_matter() -> None:
    assert infer_impact(["A MÍ Y A OTROS TRES COMPAÑEROS"]) == infer_impact(
        ["a mi y a otros tres companeros"]
    )


def _conv(*messages: str, draft: Draft | None = None) -> Conversation:
    return Conversation(
        entry=Entry("new"),
        history=tuple(Message("user", m) for m in messages),
        draft=draft or Draft(),
    )


def test_with_inferred_impact_fills_only_an_empty_impact() -> None:
    filled = with_inferred_impact(_conv(SCREENSHOT))
    assert filled.draft.impact == "medium"
    kept = with_inferred_impact(_conv(SCREENSHOT, draft=Draft(impact="high")))
    assert kept.draft.impact == "high"


def test_with_inferred_impact_ignores_assistant_messages() -> None:
    conv = replace(
        _conv("La impresora no imprime"),
        history=(
            Message("user", "La impresora no imprime"),
            Message("assistant", "¿Afecta a toda tu área o a varias personas?"),
        ),
    )
    assert with_inferred_impact(conv).draft.impact is None


async def test_fake_does_not_re_ask_impact_for_the_screenshot_sentence() -> None:
    turn = await FakeAssistant().next_turn(_conv(SCREENSHOT))
    assert turn.draft.impact == "medium"
    assert turn.draft.service == "network"
    assert "Impacto" not in turn.missing_data
    assert turn.missing_data[0] == "Urgencia"


class _Spy:
    """Records the conversation it was handed and answers with a null impact (weak model)."""

    def __init__(self) -> None:
        self.seen: Conversation | None = None

    async def next_turn(self, conv: Conversation) -> AssistantTurn:
        self.seen = conv
        return AssistantTurn(
            message="¿Qué tan urgente es?",
            draft=TurnDraft(service="network", summary="Internet", description="Inestable"),
        )


async def test_converse_hands_the_port_a_draft_with_the_inferred_impact() -> None:
    spy = _Spy()
    await converse(spy, _conv(SCREENSHOT))
    assert spy.seen is not None
    assert spy.seen.draft.impact == "medium"


async def test_converse_refills_a_null_impact_the_model_dropped() -> None:
    result = await converse(_Spy(), _conv(SCREENSHOT))
    assert isinstance(result, AssistantTurn)
    assert result.draft.impact == "medium"
    assert [f.field for f in result.flags if f.severity == "blocking"] == ["urgency"]
