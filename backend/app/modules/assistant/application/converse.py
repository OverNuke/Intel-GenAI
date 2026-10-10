from app.modules.assistant.application.ports import AssistantPort
from app.modules.assistant.domain.conversation import Conversation
from app.modules.assistant.domain.errors import AssistantUnavailable, Handoff
from app.modules.assistant.domain.turn import AssistantTurn


async def converse(port: AssistantPort, conv: Conversation) -> AssistantTurn | Handoff:
    """Next turn, or a Handoff that keeps the draft when the assistant is unavailable."""
    try:
        return await port.next_turn(conv)
    except AssistantUnavailable as unavailable:
        return Handoff(reason=unavailable.reason, draft=conv.draft)
