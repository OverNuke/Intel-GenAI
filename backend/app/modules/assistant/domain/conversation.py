"""Conversation state handed to the assistant. It carries no name, email or user id (ADR-0008)."""

from dataclasses import dataclass
from typing import Literal

from app.modules.tickets.domain.ticket import Impact, Urgency

MAX_HISTORY = 20
MAX_MESSAGE_CHARS = 2000

EntryKind = Literal["new", "ticket", "service"]
Role = Literal["user", "assistant"]


class ConversationLimitError(ValueError):
    """History or a message exceeds the bounds the endpoint accepts."""


@dataclass(frozen=True)
class Message:
    role: Role
    content: str


@dataclass(frozen=True)
class Entry:
    """How it started: open, help with a ticket (ref = display id) or a service key (ref)."""

    kind: EntryKind
    ref: str | None = None


@dataclass(frozen=True)
class Draft:
    """The editable "Tu solicitud" values captured so far."""

    service: str | None = None
    summary: str = ""
    description: str = ""
    impact: Impact | None = None
    urgency: Urgency | None = None


@dataclass(frozen=True)
class Conversation:
    entry: Entry
    history: tuple[Message, ...] = ()
    draft: Draft = Draft()
    # Only for entry "ticket": summary and status of a ticket the user owns (REQ-AC-8).
    ticket_summary: str | None = None
    ticket_status: str | None = None

    def __post_init__(self) -> None:
        if len(self.history) > MAX_HISTORY:
            raise ConversationLimitError(f"history is limited to {MAX_HISTORY} messages")
        if any(len(m.content) > MAX_MESSAGE_CHARS for m in self.history):
            raise ConversationLimitError(f"messages are limited to {MAX_MESSAGE_CHARS} characters")
