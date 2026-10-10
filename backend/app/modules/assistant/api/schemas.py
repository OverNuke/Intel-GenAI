from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.assistant.domain.conversation import (
    MAX_HISTORY,
    MAX_MESSAGE_CHARS,
    Draft,
    EntryKind,
    Role,
)
from app.modules.assistant.domain.errors import UnavailableReason
from app.modules.assistant.domain.turn import AssistantTurn
from app.modules.tickets.domain.ticket import Impact, Urgency


class _Strict(BaseModel):
    """Unknown fields (requester_id, email, ...) are rejected, never ignored."""

    model_config = ConfigDict(extra="forbid")


class EntryIn(_Strict):
    kind: EntryKind
    ref: str | None = Field(default=None, max_length=64)


class MessageIn(_Strict):
    role: Role
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)


class DraftIn(_Strict):
    service: str | None = Field(default=None, max_length=40)
    summary: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=MAX_MESSAGE_CHARS)
    impact: Impact | None = None
    urgency: Urgency | None = None

    def to_domain(self) -> Draft:
        return Draft(
            service=self.service,
            summary=self.summary,
            description=self.description,
            impact=self.impact,
            urgency=self.urgency,
        )


class ConversationIn(_Strict):
    entry: EntryIn
    history: list[MessageIn] = Field(default_factory=list, max_length=MAX_HISTORY)
    draft: DraftIn = Field(default_factory=DraftIn)


class DraftOut(BaseModel):
    service: str | None
    summary: str
    description: str
    impact: Impact | None
    urgency: Urgency | None


class TurnResult(BaseModel):
    kind: Literal["turn"] = "turn"
    turn: AssistantTurn


class HandoffResult(BaseModel):
    kind: Literal["handoff"] = "handoff"
    reason: UnavailableReason
    draft: DraftOut


TurnResponse = Annotated[TurnResult | HandoffResult, Field(discriminator="kind")]
