"""GET /api/metrics/agent (S1): supervisor only, static sample data."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.api.deps import get_session_codec, get_user_repository
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository


@pytest.fixture
def client() -> Iterator[TestClient]:
    users, codec = InMemoryUserRepository(), FakeSessionCodec()
    app.dependency_overrides[get_user_repository] = lambda: users
    app.dependency_overrides[get_session_codec] = lambda: codec
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _as(client: TestClient, user_id: str) -> TestClient:
    client.cookies.set("ariadna_session", FakeSessionCodec.PREFIX + user_id)
    return client


def test_requires_a_session(client: TestClient) -> None:
    assert client.get("/api/metrics/agent").status_code == 401


@pytest.mark.parametrize("user_id", ["ana", "luis"])
def test_s_am_3_other_roles_get_the_denial_payload(client: TestClient, user_id: str) -> None:
    response = _as(client, user_id).get("/api/metrics/agent")
    assert response.status_code == 403
    assert response.json() == {
        "allowed": False,
        "section": {"key": "agent-tracking", "label": "Seguimiento del agente"},
        "required_role": {"key": "supervisor", "label": "Supervisor"},
    }


def test_s_am_1_measured_and_estimated_are_separate_fields_with_seven_trend_points(
    client: TestClient,
) -> None:
    body = _as(client, "sara").get("/api/metrics/agent").json()
    assert body["period"] == 7
    assert body["sample"] is True
    assert len(body["trend"]) == 7
    assert {m["kind"] for m in body["measured"]} == {"measured"}
    assert {m["kind"] for m in body["estimated"]["metrics"]} == {"estimated"}
    assert "estimated" not in {m["key"] for m in body["measured"]}
    assert set(body) == {"period", "sample", "measured", "estimated", "trend"}


def test_the_estimated_block_and_every_estimate_say_they_are_not_measured(
    client: TestClient,
) -> None:
    estimated = _as(client, "sara").get("/api/metrics/agent").json()["estimated"]
    assert estimated["label"] == "Estimaciones, no son resultados medidos"
    for metric in estimated["metrics"]:
        assert metric["disclaimer"] == "no son resultados medidos"


def test_s_am_2_period_30_has_thirty_points_and_other_periods_are_422(client: TestClient) -> None:
    _as(client, "sara")
    assert len(client.get("/api/metrics/agent", params={"period": 30}).json()["trend"]) == 30
    assert len(client.get("/api/metrics/agent", params={"period": 7}).json()["trend"]) == 7
    assert client.get("/api/metrics/agent", params={"period": 14}).status_code == 422
    assert client.get("/api/metrics/agent", params={"period": "abc"}).status_code == 422
