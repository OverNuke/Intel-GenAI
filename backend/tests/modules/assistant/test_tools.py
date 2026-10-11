"""The read-only tool registry: typed tools, bound requester, no identifiers to the model."""

import json
from typing import Any

import pytest

from app.modules.assistant.application.tools import ToolBox, ToolContext
from tests.modules.assistant.stubs import StubRequesterTickets, StubUserLookup, make_ticket

REQUESTER = "u-requester"


def _box(
    tickets: StubRequesterTickets | None = None, users: StubUserLookup | None = None
) -> ToolBox:
    return ToolBox(
        ToolContext(requester_id=REQUESTER),
        tickets=tickets or StubRequesterTickets({}),
        users=users or StubUserLookup(["Luis Herrera", "Sara Molina"]),
    )


def test_exposes_exactly_the_five_read_only_tools_with_json_schemas() -> None:
    specs = _box().specs
    assert {s.name for s in specs} == {
        "search_catalog",
        "check_required_data",
        "find_similar_tickets",
        "find_user",
        "check_permissions",
    }
    for spec in specs:
        assert spec.description
        assert spec.parameters["type"] == "object"
        assert spec.parameters["properties"]
        assert spec.parameters["required"]
    banned = ("submit", "create", "close", "send", "confirm", "update", "add_", "write")
    assert not any(b in s.name for s in specs for b in banned)


async def test_search_catalog_finds_services_by_words_ignoring_accents() -> None:
    outcome = await _box().run("search_catalog", {"query": "no imprime la impresión"})
    assert outcome.ok
    first = outcome.data["services"][0]
    assert first["key"] == "printing"
    assert set(first) == {"key", "label", "handled_by"}


async def test_search_catalog_without_matches_is_empty_not_an_error() -> None:
    outcome = await _box().run("search_catalog", {"query": "zzzz qqqq"})
    assert outcome.ok
    assert outcome.data["services"] == []


async def test_check_required_data_reports_what_the_domain_computes() -> None:
    empty = await _box().run("check_required_data", {"draft": {}})
    assert [f["field"] for f in empty.data["blocking"]] == [
        "description",
        "service",
        "summary",
        "impact",
        "urgency",
    ]
    full = await _box().run(
        "check_required_data",
        {
            "draft": {
                "service": "hardware",
                "summary": "Cables pelados",
                "description": "Los cables del equipo AT-1234 están pelados",
                "impact": "low",
                "urgency": "high",
            }
        },
    )
    assert full.data["blocking"] == []
    assert full.data["warnings"] == []


async def test_check_required_data_adds_the_recommended_warnings() -> None:
    outcome = await _box().run(
        "check_required_data",
        {
            "draft": {
                "service": "hardware",
                "summary": "Monitor",
                "description": "El monitor parpadea",
                "impact": "low",
                "urgency": "low",
            }
        },
    )
    assert [f["field"] for f in outcome.data["warnings"]] == ["asset_number"]


async def test_check_required_data_rejects_a_malformed_draft() -> None:
    outcome = await _box().run("check_required_data", {"draft": {"impact": "enormous"}})
    assert not outcome.ok


async def test_find_similar_tickets_only_sees_the_requesters_own_tickets() -> None:
    tickets = StubRequesterTickets(
        {
            REQUESTER: [
                make_ticket(1, "Red lenta en toda el area", "in_progress", REQUESTER),
                make_ticket(2, "Impresora sin tinta", "new", REQUESTER),
            ],
            "someone-else": [make_ticket(3, "Red lenta en la sala", "new", "someone-else")],
        }
    )
    outcome = await _box(tickets).run("find_similar_tickets", {"summary": "La red está lenta"})
    assert tickets.asked_for == [REQUESTER]
    assert outcome.data["tickets"] == [
        {"id": "INC0000001", "summary": "Red lenta en toda el area", "status": "in_progress"}
    ]


async def test_find_similar_tickets_returns_at_most_three() -> None:
    mine = [make_ticket(n, "Red lenta en el piso", "new", REQUESTER) for n in range(1, 7)]
    outcome = await _box(StubRequesterTickets({REQUESTER: mine})).run(
        "find_similar_tickets", {"summary": "red lenta"}
    )
    assert len(outcome.data["tickets"]) == 3


async def test_find_user_returns_display_names_only() -> None:
    users = StubUserLookup(["Luis Herrera", "Sara Molina"])
    outcome = await _box(users=users).run("find_user", {"name": "luis"})
    assert outcome.data == {"names": ["Luis Herrera"]}
    assert users.excluded == [REQUESTER]
    assert "@" not in json.dumps(outcome.data)


async def test_check_permissions_reads_the_catalog() -> None:
    needs = await _box().run("check_permissions", {"service_key": "software"})
    assert needs.data["requires_manager_authorization"] is True
    assert needs.data["notice"]
    free = await _box().run("check_permissions", {"service_key": "hardware"})
    assert free.data["requires_manager_authorization"] is False
    unknown = await _box().run("check_permissions", {"service_key": "nope"})
    assert unknown.ok
    assert unknown.data["known"] is False


@pytest.mark.parametrize(
    ("name", "arguments"),
    [("nope", {}), ("find_user", {}), ("find_user", {"name": 3}), ("search_catalog", {"q": "x"})],
)
async def test_unknown_tool_or_bad_arguments_fail_softly(
    name: str, arguments: dict[str, Any]
) -> None:
    outcome = await _box().run(name, arguments)
    assert not outcome.ok
    assert outcome.summary


async def test_a_raising_tool_becomes_a_failed_outcome() -> None:
    boom = StubRequesterTickets({}, error=RuntimeError("db down"))
    outcome = await _box(boom).run("find_similar_tickets", {"summary": "red"})
    assert not outcome.ok
    assert "db down" not in outcome.summary
    assert "db down" not in json.dumps(outcome.data)


async def test_summaries_fit_the_step_bound_and_the_step_mirrors_the_outcome() -> None:
    outcome = await _box().run("find_user", {"name": "x" * 500})
    assert len(outcome.summary) <= 200
    step = outcome.to_step("find_user")
    assert (step.name, step.summary, step.ok) == ("find_user", outcome.summary, outcome.ok)
