"""What the assistant may *propose*: pure value objects, never a write (ADR-0003, ADR-0008).

The agent proposes, the human confirms. A proposal holds no callable and no resolved id:
participants are display names the backend resolves server-side when the person confirms.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.tickets.domain.ticket import Impact, Urgency

MAX_FLAG_MESSAGE = 200
MAX_PARTICIPANTS = 8
MAX_NAME_CHARS = 80
MAX_TICKET_REF = 64

# Draft field -> label shown in the "falta" list (the legacy `missing_data` strings).
FIELD_LABELS: dict[str, str] = {
    "description": "Descripción",
    "service": "Servicio",
    "summary": "Resumen",
    "impact": "Impacto",
    "urgency": "Urgencia",
}


class _Value(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class Flag(_Value):
    """A finding about the draft. `blocking` prevents sending; `warning` only recommends."""

    field: str = Field(min_length=1, max_length=40)
    severity: Literal["blocking", "warning"]
    message: str = Field(min_length=1, max_length=MAX_FLAG_MESSAGE)


def missing_data_from(flags: list[Flag]) -> list[str]:
    """The legacy `missing_data` list, derived from the blocking flags."""
    return [FIELD_LABELS.get(f.field, f.field) for f in flags if f.severity == "blocking"]


class CreateTicket(_Value):
    """Prepare the current draft as a new request. The person still presses send."""

    kind: Literal["create_ticket"] = "create_ticket"


class AddParticipants(_Value):
    """Add people (display names) to the request being prepared or to `ticket_ref`."""

    kind: Literal["add_participants"] = "add_participants"
    names: list[Annotated[str, Field(min_length=1, max_length=MAX_NAME_CHARS)]] = Field(
        min_length=1, max_length=MAX_PARTICIPANTS
    )
    ticket_ref: str | None = Field(default=None, max_length=MAX_TICKET_REF)

    @field_validator("names")
    @classmethod
    def _no_blank_names(cls, value: list[str]) -> list[str]:
        if any(not name.strip() for name in value):
            raise ValueError("participant names must not be blank")
        return value


class UpdateTicket(_Value):
    """Change fields of an own ticket. Only the fields that change are set."""

    kind: Literal["update_ticket"] = "update_ticket"
    ticket_ref: str = Field(min_length=1, max_length=MAX_TICKET_REF)
    summary: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    impact: Impact | None = None
    urgency: Urgency | None = None

    @model_validator(mode="after")
    def _at_least_one_change(self) -> "UpdateTicket":
        if all(v is None for v in (self.summary, self.description, self.impact, self.urgency)):
            raise ValueError("an update must change at least one field")
        return self


class CloseTicket(_Value):
    """Close an own ticket that IT already resolved."""

    kind: Literal["close_ticket"] = "close_ticket"
    ticket_ref: str = Field(min_length=1, max_length=MAX_TICKET_REF)


ActionProposal = Annotated[
    CreateTicket | AddParticipants | UpdateTicket | CloseTicket,
    Field(discriminator="kind"),
]
