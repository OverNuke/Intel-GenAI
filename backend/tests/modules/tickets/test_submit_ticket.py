from app.modules.tickets.domain.submit_ticket import (
    Confirmation,
    SubmitFailure,
    SubmitSuccess,
    TicketDraft,
    submit_ticket,
)

DRAFT = TicketDraft(
    requester_id="ana",
    service="network",
    summary="Nodo de red para teléfono IP nuevo",
    description="Contabilidad necesita un nodo en la oficina 3.",
)


def test_rejects_submit_without_human_confirmation() -> None:
    assert submit_ticket(DRAFT, None) == SubmitFailure("missing-human-confirmation")


def test_rejects_confirmation_made_by_the_assistant() -> None:
    result = submit_ticket(DRAFT, Confirmation(by="assistant", requester_id="ana"))
    assert result == SubmitFailure("missing-human-confirmation")


def test_rejects_confirmation_from_someone_other_than_the_requester() -> None:
    result = submit_ticket(DRAFT, Confirmation(by="human", requester_id="luis"))
    assert result == SubmitFailure("confirmation-not-from-requester")


def test_rejects_incomplete_draft_even_when_confirmed() -> None:
    draft = TicketDraft(
        requester_id="ana", service="network", summary="  ", description="x"
    )
    result = submit_ticket(draft, Confirmation(by="human", requester_id="ana"))
    assert result == SubmitFailure("incomplete-draft")


def test_submits_when_requester_confirms_a_complete_draft() -> None:
    result = submit_ticket(DRAFT, Confirmation(by="human", requester_id="ana"))
    assert result == SubmitSuccess(draft=DRAFT, status="new")
