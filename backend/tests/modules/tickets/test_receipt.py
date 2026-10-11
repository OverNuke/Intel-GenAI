import pytest

from app.modules.tickets.domain.receipt import (
    SUBMITTED_BY_PERSON,
    AriadnaReceipt,
    receipt_from_json,
    receipt_to_json,
    with_person_statement,
)

RECEIPT = AriadnaReceipt(
    understood="La impresora del piso 2 no imprime.",
    reviewed=("Datos obligatorios completos", "Destino sugerido: Soporte de impresión"),
    not_done=("No asigné el ticket a nadie.",),
    permissions_notice=None,
    missing_data=("asset",),
    target_group="Soporte de impresión",
)


def test_json_round_trip_preserves_every_field() -> None:
    payload = receipt_to_json(RECEIPT)
    assert payload["understood"] == "La impresora del piso 2 no imprime."
    assert payload["reviewed"] == [
        "Datos obligatorios completos",
        "Destino sugerido: Soporte de impresión",
    ]
    assert payload["permissions_notice"] is None
    assert receipt_from_json(payload) == RECEIPT


def test_from_json_tolerates_missing_optional_keys() -> None:
    receipt = receipt_from_json({"understood": "x", "target_group": "Soporte de redes"})
    assert receipt == AriadnaReceipt(
        understood="x",
        reviewed=(),
        not_done=(),
        permissions_notice=None,
        missing_data=(),
        target_group="Soporte de redes",
    )


def test_from_json_rejects_a_payload_without_the_required_text() -> None:
    with pytest.raises(ValueError):
        receipt_from_json({"reviewed": []})


def test_with_person_statement_appends_the_fixed_sentence_once() -> None:
    once = with_person_statement(RECEIPT)
    assert once.not_done == ("No asigné el ticket a nadie.", SUBMITTED_BY_PERSON)
    assert with_person_statement(once).not_done == once.not_done
