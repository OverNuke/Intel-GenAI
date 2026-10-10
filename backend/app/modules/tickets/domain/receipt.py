"""The "Constancia de Ariadna": what Ariadna understood and checked, stored as submitted."""

from dataclasses import dataclass, replace
from typing import Any

# Fixed server-side statement that the person, not Ariadna, sent the ticket (REQ-TS-6).
SUBMITTED_BY_PERSON = "La persona revisó y presionó «Enviar solicitud». Ariadna no envía nada."

MAX_TEXT = 500
MAX_ITEMS = 8
MAX_ITEM_TEXT = 200


@dataclass(frozen=True)
class AriadnaReceipt:
    understood: str
    reviewed: tuple[str, ...]
    not_done: tuple[str, ...]
    permissions_notice: str | None
    missing_data: tuple[str, ...]
    target_group: str


def receipt_to_json(receipt: AriadnaReceipt) -> dict[str, Any]:
    return {
        "understood": receipt.understood,
        "reviewed": list(receipt.reviewed),
        "not_done": list(receipt.not_done),
        "permissions_notice": receipt.permissions_notice,
        "missing_data": list(receipt.missing_data),
        "target_group": receipt.target_group,
    }


def receipt_from_json(payload: dict[str, Any]) -> AriadnaReceipt:
    understood = payload.get("understood")
    if not isinstance(understood, str) or not understood.strip():
        raise ValueError("receipt without `understood`")
    return AriadnaReceipt(
        understood=understood,
        reviewed=tuple(str(item) for item in payload.get("reviewed") or ()),
        not_done=tuple(str(item) for item in payload.get("not_done") or ()),
        permissions_notice=payload.get("permissions_notice"),
        missing_data=tuple(str(item) for item in payload.get("missing_data") or ()),
        target_group=str(payload.get("target_group") or ""),
    )


def with_person_statement(receipt: AriadnaReceipt) -> AriadnaReceipt:
    """Appends the fixed "the person submitted" sentence (once)."""
    if SUBMITTED_BY_PERSON in receipt.not_done:
        return receipt
    return replace(receipt, not_done=(*receipt.not_done, SUBMITTED_BY_PERSON))
