from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class TicketDraft:
    requester_id: str
    service: str
    summary: str
    description: str


@dataclass(frozen=True)
class Confirmation:
    """Who confirmed. The assistant may never be `human`: Ariadna prepares, the person sends."""

    by: Literal["human", "assistant"]
    requester_id: str


@dataclass(frozen=True)
class SubmitSuccess:
    draft: TicketDraft
    status: Literal["new"]


@dataclass(frozen=True)
class SubmitFailure:
    reason: Literal[
        "missing-human-confirmation",
        "confirmation-not-from-requester",
        "incomplete-draft",
    ]


def _is_complete(draft: TicketDraft) -> bool:
    return all(
        value.strip()
        for value in (draft.requester_id, draft.service, draft.summary, draft.description)
    )


def submit_ticket(
    draft: TicketDraft, confirmation: Confirmation | None
) -> SubmitSuccess | SubmitFailure:
    if confirmation is None or confirmation.by != "human":
        return SubmitFailure("missing-human-confirmation")
    if confirmation.requester_id != draft.requester_id:
        return SubmitFailure("confirmation-not-from-requester")
    if not _is_complete(draft):
        return SubmitFailure("incomplete-draft")
    return SubmitSuccess(draft=draft, status="new")
