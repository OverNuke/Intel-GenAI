from app.modules.assistant.application.ports import AssistantPort
from app.modules.assistant.domain.conversation import Conversation
from app.modules.assistant.domain.errors import AssistantUnavailable, Handoff
from app.modules.assistant.domain.flags import enforce_domain_flags
from app.modules.assistant.domain.impact import with_inferred_impact
from app.modules.assistant.domain.turn import AssistantTurn


async def converse(port: AssistantPort, conv: Conversation) -> AssistantTurn | Handoff:
    """Next turn, or a Handoff that keeps the draft when the assistant is unavailable.

    Impact is a domain fact read from what the person wrote: the port receives it already in the
    draft (so no adapter asks for it again) and a model that drops it cannot lose it.
    """
    conv = with_inferred_impact(conv)
    try:
        turn = await port.next_turn(conv)
    except AssistantUnavailable as unavailable:
        return Handoff(reason=unavailable.reason, draft=conv.draft)
    if turn.draft.impact is None and conv.draft.impact is not None:
        refilled = turn.draft.model_copy(update={"impact": conv.draft.impact})
        return enforce_domain_flags(turn.model_copy(update={"draft": refilled}))
    return turn
