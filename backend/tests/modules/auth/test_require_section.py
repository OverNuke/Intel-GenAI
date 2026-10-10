"""`get_current_user` / `require_section`: the 401/403 bodies must equal the /auth/access ones."""

from collections.abc import Iterator
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.main import app as main_app
from app.modules.auth.api.deps import (
    get_current_user,
    get_session_codec,
    get_user_repository,
    require_section,
)
from app.modules.auth.api.errors import register_auth_error_handlers
from app.modules.auth.domain.user import User
from tests.modules.auth.fakes import FakeSessionCodec, InMemoryUserRepository


@pytest.fixture
def client() -> Iterator[TestClient]:
    probe = FastAPI()
    register_auth_error_handlers(probe)

    @probe.get("/whoami")
    async def whoami(user: Annotated[User, Depends(get_current_user)]) -> dict[str, str]:
        return {"id": user.id}

    @probe.get("/it-only")
    async def it_only(
        user: Annotated[User, Depends(require_section("ticket-tracking"))],
    ) -> dict[str, str]:
        return {"id": user.id}

    @probe.get("/everyone")
    async def everyone(
        user: Annotated[User, Depends(require_section("my-tickets"))],
    ) -> dict[str, str]:
        return {"id": user.id}

    repo, codec = InMemoryUserRepository(), FakeSessionCodec()
    for target in (probe, main_app):
        target.dependency_overrides[get_user_repository] = lambda: repo
        target.dependency_overrides[get_session_codec] = lambda: codec
    try:
        yield TestClient(probe)
    finally:
        main_app.dependency_overrides.clear()


def _as(client: TestClient, user_id: str) -> None:
    client.cookies.set("ariadna_session", FakeSessionCodec.PREFIX + user_id)


def test_no_session_is_the_same_401_body_as_auth_access(client: TestClient) -> None:
    expected = TestClient(main_app).get("/api/auth/access", params={"section": "home"})
    response = client.get("/whoami")
    assert response.status_code == 401
    assert response.json() == expected.json() == {"detail": "No hay una sesión activa."}


def test_tampered_cookie_is_401(client: TestClient) -> None:
    client.cookies.set("ariadna_session", "garbage")
    assert client.get("/everyone").status_code == 401


def test_allowed_role_reaches_the_handler_with_the_user(client: TestClient) -> None:
    _as(client, "luis")
    response = client.get("/it-only")
    assert response.status_code == 200
    assert response.json() == {"id": "luis"}


def test_every_role_may_open_my_tickets(client: TestClient) -> None:
    for user_id in ("ana", "luis", "sara"):
        _as(client, user_id)
        assert client.get("/everyone").json() == {"id": user_id}


def test_denied_role_gets_the_exact_access_denied_body(client: TestClient) -> None:
    _as(client, "ana")
    expected = TestClient(main_app)
    expected.cookies.set("ariadna_session", FakeSessionCodec.PREFIX + "ana")
    reference = expected.get("/api/auth/access", params={"section": "ticket-tracking"})
    response = client.get("/it-only")
    assert response.status_code == 403
    assert response.json() == reference.json()
    assert response.json()["required_role"] == {"key": "it", "label": "TI"}
    section = response.json()["section"]
    assert section == {"key": "ticket-tracking", "label": "Seguimiento de tickets"}
