"""Bounded read-only tool loop of the OpenAI-compatible adapter (ADR-0014).

httpx.MockTransport only: no network, no assertions on model prose.
"""

import json
from typing import Any

import httpx
import pytest

from app.modules.assistant.application.tools import ToolBox, ToolContext
from app.modules.assistant.domain.conversation import Conversation, Draft, Entry, Message
from app.modules.assistant.domain.errors import AssistantUnavailable
from app.modules.assistant.infrastructure.openai_adapter import OpenAICompatibleAssistant
from tests.modules.assistant.stubs import (
    StubRequesterTickets,
    StubUserLookup,
    completion_payload,
    make_ticket,
)
from tests.modules.assistant.test_openai_adapter import VALID_TURN, Script, ok, raises, status

REQUESTER = "u-9f3a"


def calls(*tool_calls: tuple[str, str, Any]) -> Any:
    return lambda _: httpx.Response(200, json=completion_payload(tool_calls=list(tool_calls)))


def _toolbox(tickets: StubRequesterTickets | None = None) -> ToolBox:
    mine = {REQUESTER: [make_ticket(7, "Red lenta en toda el area", "in_progress", REQUESTER)]}
    return ToolBox(
        ToolContext(requester_id=REQUESTER),
        tickets=tickets or StubRequesterTickets(mine),
        users=StubUserLookup(["Luis Herrera", "Sara Molina"]),
    )


def _agent(
    script: Script, *, mode: str = "agent", toolbox: ToolBox | None = None
) -> OpenAICompatibleAssistant:
    client = httpx.AsyncClient(transport=httpx.MockTransport(script))
    adapter = OpenAICompatibleAssistant(
        base_url="https://llm.example/v1",
        model="test-model",
        api_key="sk-test",
        timeout_seconds=5,
        http_client=client,
        mode=mode,  # type: ignore[arg-type]
    )
    return adapter.with_tools(toolbox or _toolbox())  # type: ignore[return-value]


CONVERSATION = Conversation(
    entry=Entry("new"),
    history=(Message("user", "La red está lenta en toda mi área"),),
    draft=Draft(service="network", summary="Red lenta", description="Red lenta en el área"),
)

CHECK = ("c1", "check_required_data", {"draft": {"service": "network"}})
SIMILAR = ("c2", "find_similar_tickets", {"summary": "red lenta"})


def _body(script: Script, index: int) -> dict[str, Any]:
    return json.loads(script.requests[index].content)  # type: ignore[no-any-return]


async def test_single_mode_never_sends_tools() -> None:
    script = Script(ok())
    await _agent(script, mode="single").next_turn(CONVERSATION)
    assert "tools" not in _body(script, 0)
    assert script.calls == 1


async def test_agent_mode_without_a_toolbox_never_sends_tools() -> None:
    script = Script(ok())
    client = httpx.AsyncClient(transport=httpx.MockTransport(script))
    adapter = OpenAICompatibleAssistant(
        base_url="https://llm.example/v1",
        model="m",
        api_key="k",
        timeout_seconds=5,
        http_client=client,
        mode="agent",
    )
    await adapter.next_turn(CONVERSATION)
    assert "tools" not in _body(script, 0)


async def test_agent_mode_advertises_the_read_only_tools() -> None:
    script = Script(ok())
    await _agent(script).next_turn(CONVERSATION)
    tools = _body(script, 0)["tools"]
    names = {t["function"]["name"] for t in tools}
    assert names == {
        "search_catalog",
        "check_required_data",
        "find_similar_tickets",
        "find_user",
        "check_permissions",
    }
    assert all(t["type"] == "function" for t in tools)


async def test_tool_results_are_fed_back_and_become_the_steps() -> None:
    script = Script(calls(CHECK, SIMILAR), ok())
    turn = await _agent(script).next_turn(CONVERSATION)
    assert [s.name for s in turn.steps] == ["check_required_data", "find_similar_tickets"]
    assert all(s.ok for s in turn.steps)
    assert turn.reviewed == [s.summary for s in turn.steps]
    assert script.calls == 2
    follow_up = _body(script, 1)["messages"]
    assistant = next(m for m in follow_up if m["role"] == "assistant" and m.get("tool_calls"))
    assert [c["id"] for c in assistant["tool_calls"]] == ["c1", "c2"]
    tool_messages = [m for m in follow_up if m["role"] == "tool"]
    assert [m["tool_call_id"] for m in tool_messages] == ["c1", "c2"]
    similar = json.loads(tool_messages[1]["content"])
    assert similar["tickets"][0]["id"] == "INC0000007"


async def test_the_requester_id_never_reaches_the_model() -> None:
    tickets = StubRequesterTickets(
        {REQUESTER: [make_ticket(7, "Red lenta en toda el area", "in_progress", REQUESTER)]}
    )
    script = Script(calls(SIMILAR, ("c3", "find_user", {"name": "luis"})), ok())
    await _agent(script, toolbox=_toolbox(tickets)).next_turn(CONVERSATION)
    assert tickets.asked_for == [REQUESTER]
    for request in script.requests:
        assert REQUESTER not in request.content.decode("utf8")


async def test_the_model_can_chain_tool_rounds_up_to_the_budget() -> None:
    catalog = ("c3", "search_catalog", {"query": "red"})
    script = Script(calls(CHECK), calls(SIMILAR), calls(catalog), ok())
    turn = await _agent(script).next_turn(CONVERSATION)
    assert len(turn.steps) == 3
    assert script.calls == 4
    assert all("tools" in _body(script, i) for i in range(3))


async def test_after_four_steps_the_final_request_offers_no_tools() -> None:
    four = [
        calls(("a", "search_catalog", {"query": "red"})),
        calls(("b", "search_catalog", {"query": "wifi"})),
        calls(("c", "check_permissions", {"service_key": "network"})),
        calls(("d", "check_permissions", {"service_key": "email"})),
    ]
    script = Script(*four, ok())
    turn = await _agent(script).next_turn(CONVERSATION)
    assert len(turn.steps) == 4
    assert script.calls == 5
    assert "tools" not in _body(script, 4)


async def test_step_overflow_falls_back_to_single_shot() -> None:
    five = [(f"t{i}", "search_catalog", {"query": "red"}) for i in range(5)]
    script = Script(calls(*five), ok())
    turn = await _agent(script).next_turn(CONVERSATION)
    assert turn.steps == []
    assert script.calls == 2
    assert "tools" in _body(script, 0)
    assert "tools" not in _body(script, 1)
    assert _body(script, 1)["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize("code", [400, 422, 501])
async def test_an_endpoint_that_rejects_tools_falls_back_to_single_shot(code: int) -> None:
    script = Script(status(code), ok())
    turn = await _agent(script).next_turn(CONVERSATION)
    assert turn.draft.service == "network"
    assert turn.steps == []
    assert script.calls == 2
    assert "tools" not in _body(script, 1)


async def test_rejected_tools_then_failing_single_shot_degrades() -> None:
    script = Script(status(400), status(500))
    with pytest.raises(AssistantUnavailable) as caught:
        await _agent(script).next_turn(CONVERSATION)
    assert caught.value.reason == "http_error"
    assert script.calls == 2


async def test_a_failing_tool_is_recorded_and_the_loop_continues() -> None:
    boom = StubRequesterTickets({}, error=RuntimeError("db down"))
    script = Script(calls(SIMILAR, CHECK), ok())
    turn = await _agent(script, toolbox=_toolbox(boom)).next_turn(CONVERSATION)
    assert [(s.name, s.ok) for s in turn.steps] == [
        ("find_similar_tickets", False),
        ("check_required_data", True),
    ]
    assert turn.reviewed == [turn.steps[1].summary]
    assert "db down" not in script.requests[1].content.decode("utf8")


async def test_an_unknown_tool_or_malformed_arguments_are_failed_steps() -> None:
    script = Script(
        calls(("x", "submit_ticket", {}), ("y", "find_user", "{not json")),
        ok(),
    )
    turn = await _agent(script).next_turn(CONVERSATION)
    assert [s.ok for s in turn.steps] == [False, False]
    assert script.calls == 2


@pytest.mark.parametrize(
    ("step", "reason"),
    [
        (status(429), "rate_limited"),
        (raises(httpx.ReadTimeout("slow")), "timeout"),
        (raises(httpx.ConnectError("down")), "connection_error"),
        (status(500), "http_error"),
    ],
)
async def test_unavailability_degrades_without_a_fallback_call(
    step: Any, reason: str
) -> None:
    script = Script(step, ok())
    with pytest.raises(AssistantUnavailable) as caught:
        await _agent(script).next_turn(CONVERSATION)
    assert caught.value.reason == reason
    assert script.calls == 1


async def test_rate_limit_in_the_middle_of_the_loop_degrades() -> None:
    script = Script(calls(CHECK), status(429), ok())
    with pytest.raises(AssistantUnavailable) as caught:
        await _agent(script).next_turn(CONVERSATION)
    assert caught.value.reason == "rate_limited"
    assert script.calls == 2


async def test_invalid_final_output_retries_once_then_degrades() -> None:
    script = Script(calls(CHECK), ok("not json"), ok())
    turn = await _agent(script).next_turn(CONVERSATION)
    assert [s.name for s in turn.steps] == ["check_required_data"]
    assert script.calls == 3

    twice = Script(calls(CHECK), ok("nope"), ok("still nope"))
    with pytest.raises(AssistantUnavailable) as caught:
        await _agent(twice).next_turn(CONVERSATION)
    assert caught.value.reason == "invalid_output"


async def test_a_direct_json_answer_needs_no_tools_and_still_enforces_domain_flags() -> None:
    script = Script(ok({**VALID_TURN, "ready": True}))
    turn = await _agent(script).next_turn(CONVERSATION)
    assert turn.steps == []
    assert turn.ready is False
    assert [f.field for f in turn.flags if f.severity == "blocking"] == ["impact", "urgency"]


async def test_the_bound_adapter_keeps_sdk_retries_off() -> None:
    assert _agent(Script(ok())).max_retries == 0


async def test_the_agent_prompt_mentions_tools_and_the_single_prompt_does_not() -> None:
    agent_script, single_script = Script(ok()), Script(ok())
    await _agent(agent_script).next_turn(CONVERSATION)
    await _agent(single_script, mode="single").next_turn(CONVERSATION)
    agent_system = _body(agent_script, 0)["messages"][0]["content"]
    single_system = _body(single_script, 0)["messages"][0]["content"]
    assert "herramientas" in agent_system
    assert "herramientas" not in single_system
