"""The structured, schema-validated turn every adapter must return (REQ-AC-2, REQ-AC-3)."""

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.assistant.domain.proposal import ActionProposal, Flag, missing_data_from
from app.modules.tickets.domain.ticket import Impact, Urgency

MAX_MESSAGE = 600
MAX_UNDERSTOOD = 500
MAX_ITEMS = 8
MAX_ITEM_CHARS = 200
MAX_FLAGS = 8
MAX_PROPOSALS = 4
MAX_STEPS = 4
MAX_STEP_SUMMARY = 200


class TurnDraft(BaseModel):
    service: str | None = None
    summary: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=2000)
    impact: Impact | None = None
    urgency: Urgency | None = None


class ToolStep(BaseModel):
    """One read-only check the agent ran: the evidence behind a line of "Lo que revisé"."""

    name: str = Field(min_length=1, max_length=40)
    summary: str = Field(max_length=MAX_STEP_SUMMARY)
    ok: bool = True


class AssistantTurn(BaseModel):
    """One turn: a single question (or a "draft is ready" statement) plus the draft so far."""

    message: str = Field(max_length=MAX_MESSAGE)
    understood: str = Field(default="", max_length=MAX_UNDERSTOOD)
    reviewed: list[str] = Field(default_factory=list, max_length=MAX_ITEMS)
    draft: TurnDraft = Field(default_factory=TurnDraft)
    # Kept for compatibility; derived from the blocking flags (see `enforce_domain_flags`).
    missing_data: list[str] = Field(default_factory=list, max_length=MAX_ITEMS)
    flags: list[Flag] = Field(default_factory=list, max_length=MAX_FLAGS)
    proposals: list[ActionProposal] = Field(default_factory=list, max_length=MAX_PROPOSALS)
    # Empty in single-shot mode. When present, `reviewed` is derived from it (see attach_steps).
    steps: list[ToolStep] = Field(default_factory=list, max_length=MAX_STEPS)
    target_group: str | None = Field(default=None, max_length=80)
    needs_authorization: bool = False
    permissions_notice: str | None = Field(default=None, max_length=MAX_UNDERSTOOD)
    ready: bool = False

    @field_validator("message")
    @classmethod
    def _one_question(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message must not be empty")
        if value.count("?") > 1:
            raise ValueError("a turn carries at most one question")
        return value

    @model_validator(mode="after")
    def _derive_missing_data(self) -> "AssistantTurn":
        if self.flags and not self.missing_data:
            self.missing_data = missing_data_from(self.flags)
        return self

    @field_validator("reviewed", "missing_data")
    @classmethod
    def _bounded_items(cls, value: list[str]) -> list[str]:
        if any(len(item) > MAX_ITEM_CHARS for item in value):
            raise ValueError(f"items are limited to {MAX_ITEM_CHARS} characters")
        return value
