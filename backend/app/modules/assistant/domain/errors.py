from dataclasses import dataclass
from typing import Literal

from app.modules.assistant.domain.conversation import Draft

UnavailableReason = Literal[
    "rate_limited",  # HTTP 429
    "timeout",
    "connection_error",
    "http_error",  # any other non-2xx
    "invalid_output",  # not valid JSON/schema after the one retry
]


class AssistantUnavailable(Exception):
    """The adapter could not produce a valid turn. The use case turns this into a Handoff."""

    def __init__(self, reason: UnavailableReason) -> None:
        super().__init__(reason)
        self.reason: UnavailableReason = reason


@dataclass(frozen=True)
class Handoff:
    """Degraded outcome: the user is never blocked and the captured draft is preserved."""

    reason: UnavailableReason
    draft: Draft
