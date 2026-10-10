"""Auth API through TestClient with the repository/codec/secure-flag dependencies overridden:
no database is touched. VERCEL_ENV must be unset."""

import time
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.api.deps import get_cookie_secure, get_session_codec, get_user_repository
from app.modules.auth.infrastructure.session_codec import (
    SESSION_MAX_AGE_SECONDS,
    ItsDangerousSessionCodec,
)
from tests.modules.auth.fakes import InMemoryUserRepository

SECRET = "route-test-secret"
ANA = {"id": "ana", "name": "Ana Ruiz", "email": "ana.ruiz@ejemplo.mx", "area": "Finanzas"}


class Clock:
    def __init__(self) -> None:
        self.now = time.time()

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def secure() -> dict[str, bool]:
    return {"value": False}


@pytest.fixture
def client(clock: Clock, secure: dict[str, bool]) -> Iterator[TestClient]:
    repo = InMemoryUserRepository()
    codec = ItsDangerousSessionCodec(SECRET, clock=clock)
    app.dependency_overrides[get_user_repository] = lambda: repo
    app.dependency_overrides[get_session_codec] = lambda: codec
    app.dependency_overrides[get_cookie_secure] = lambda: secure["value"]
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _pick(client: TestClient, email: str) -> Any:
    return client.post("/api/auth/login", json={"method": "account", "email": email})


def _login_as(client: TestClient, email: str) -> None:
    assert _pick(client, email).status_code == 200


# --- POST /login: account selection (S-DS-1, S-DS-2, S-DS-9)


def test_picker_login_returns_the_user_and_sets_the_session_cookie(client: TestClient) -> None:
    response = _pick(client, "luis.herrera@ejemplo.mx")
    assert response.status_code == 200
    assert response.json() == {
        "id": "luis",
        "name": "Luis Herrera",
        "email": "luis.herrera@ejemplo.mx",
        "area": "Mesa de ayuda",
        "role": "it",
    }
    assert "ariadna_session" in response.cookies
    assert client.get("/api/auth/me").json()["id"] == "luis"


@pytest.mark.parametrize(
    ("email", "role"),
    [
        ("ana.ruiz@ejemplo.mx", "user"),
        ("luis.herrera@ejemplo.mx", "it"),
        ("sara.molina@ejemplo.mx", "supervisor"),
    ],
)
def test_each_demo_account_gets_its_role_from_me(
    client: TestClient, email: str, role: str
) -> None:
    _login_as(client, email)
    assert client.get("/api/auth/me").json()["role"] == role


def test_picker_with_unknown_email_is_401_with_no_cookie(client: TestClient) -> None:
    response = _pick(client, "mallory@ejemplo.mx")
    assert response.status_code == 401
    assert response.json() == {"errors": [{"field": "email", "code": "unknown_account"}]}
    assert "set-cookie" not in response.headers


# --- POST /login: credentials (S-DS-3, S-DS-4, S-DS-5)


def test_credentials_login_accepts_messy_email_for_ana(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"method": "credentials", "email": "  ANA.Ruiz@Ejemplo.MX ", "password": "demo2026"},
    )
    assert response.status_code == 200
    assert response.json() == {**ANA, "role": "user"}


@pytest.mark.parametrize(
    ("email", "password"),
    [
        ("ana.ruiz@ejemplo.mx", "wrong"),
        ("luis.herrera@ejemplo.mx", "demo2026"),
        ("nadie@ejemplo.mx", "demo2026"),
    ],
)
def test_bad_credentials_are_a_generic_401_with_no_cookie(
    client: TestClient, email: str, password: str
) -> None:
    response = client.post(
        "/api/auth/login", json={"method": "credentials", "email": email, "password": password}
    )
    assert response.status_code == 401
    assert response.json() == {"errors": [{"field": "form", "code": "invalid_credentials"}]}
    assert "set-cookie" not in response.headers


# --- POST /login: lenient body, field-level 400


def test_empty_body_is_400_not_422(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={})
    assert response.status_code == 400
    assert response.json() == {"errors": [{"field": "method", "code": "required"}]}


def test_missing_body_is_400_not_422(client: TestClient) -> None:
    response = client.post("/api/auth/login")
    assert response.status_code == 400
    assert response.json() == {"errors": [{"field": "method", "code": "required"}]}


def test_credentials_validation_lists_each_field_error(client: TestClient) -> None:
    both = client.post("/api/auth/login", json={"method": "credentials"})
    assert both.status_code == 400
    assert both.json() == {
        "errors": [
            {"field": "email", "code": "required"},
            {"field": "password", "code": "required"},
        ]
    }
    bad_email = client.post(
        "/api/auth/login", json={"method": "credentials", "email": "ana", "password": "x"}
    )
    assert bad_email.status_code == 400
    assert bad_email.json() == {"errors": [{"field": "email", "code": "invalid_email"}]}
    assert "set-cookie" not in bad_email.headers


# --- Cookie attributes (REQ-DS-4)


def test_cookie_is_httponly_lax_site_wide_with_eight_hour_lifetime_and_not_secure_locally(
    client: TestClient,
) -> None:
    header = _pick(client, "ana.ruiz@ejemplo.mx").headers["set-cookie"]
    assert header.startswith("ariadna_session=")
    assert "HttpOnly" in header
    assert "SameSite=lax" in header
    assert "Path=/" in header
    assert f"Max-Age={SESSION_MAX_AGE_SECONDS}" in header
    assert "Secure" not in header
    assert "Domain" not in header


def test_cookie_is_secure_when_the_deployment_is_on_vercel(
    client: TestClient, secure: dict[str, bool]
) -> None:
    secure["value"] = True
    header = _pick(client, "ana.ruiz@ejemplo.mx").headers["set-cookie"]
    assert "Secure" in header


def test_cookie_value_does_not_contain_the_role_or_password(client: TestClient) -> None:
    token = _pick(client, "sara.molina@ejemplo.mx").cookies["ariadna_session"]
    assert "supervisor" not in token
    assert "sara.molina" not in token


# --- GET /me (S-DS-6, S-DS-7)


def test_me_without_cookie_is_401_json(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "No hay una sesión activa."}


def test_me_with_tampered_cookie_is_401(client: TestClient) -> None:
    _login_as(client, "ana.ruiz@ejemplo.mx")
    token = client.cookies["ariadna_session"]
    client.cookies.set("ariadna_session", token[:-2] + ("AA" if token[-2:] != "AA" else "BB"))
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_garbage_cookie_is_401(client: TestClient) -> None:
    client.cookies.set("ariadna_session", "garbage")
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_expired_cookie_is_401(client: TestClient, clock: Clock) -> None:
    _login_as(client, "ana.ruiz@ejemplo.mx")
    assert client.get("/api/auth/me").status_code == 200
    clock.now += SESSION_MAX_AGE_SECONDS + 5
    assert client.get("/api/auth/me").status_code == 401


# --- POST /logout (S-DS-8)


def test_logout_clears_the_cookie_with_attributes_matching_the_set(client: TestClient) -> None:
    _login_as(client, "ana.ruiz@ejemplo.mx")
    response = client.post("/api/auth/logout")
    assert response.status_code == 204
    assert response.content == b""
    header = response.headers["set-cookie"]
    assert header.startswith('ariadna_session="";') or header.startswith("ariadna_session=;")
    assert "Max-Age=0" in header
    assert "HttpOnly" in header
    assert "SameSite=lax" in header
    assert "Path=/" in header
    assert client.get("/api/auth/me").status_code == 401


def test_logout_without_a_session_is_still_204(client: TestClient) -> None:
    assert client.post("/api/auth/logout").status_code == 204


def test_logout_delete_is_secure_when_the_set_was(
    client: TestClient, secure: dict[str, bool]
) -> None:
    secure["value"] = True
    assert "Secure" in client.post("/api/auth/logout").headers["set-cookie"]


# --- GET /access (S-RA-6, S-RA-7)


def test_access_without_session_is_401(client: TestClient) -> None:
    assert client.get("/api/auth/access", params={"section": "home"}).status_code == 401


def test_access_allowed_returns_200_with_user_and_section(client: TestClient) -> None:
    _login_as(client, "luis.herrera@ejemplo.mx")
    response = client.get("/api/auth/access", params={"section": "ticket-tracking"})
    assert response.status_code == 200
    assert response.json() == {
        "allowed": True,
        "user": {
            "id": "luis",
            "name": "Luis Herrera",
            "email": "luis.herrera@ejemplo.mx",
            "area": "Mesa de ayuda",
            "role": "it",
        },
        "section": {"key": "ticket-tracking", "label": "Seguimiento de tickets"},
    }


def test_access_denied_is_403_with_section_and_required_role(client: TestClient) -> None:
    _login_as(client, "sara.molina@ejemplo.mx")
    response = client.get("/api/auth/access", params={"section": "ticket-tracking"})
    assert response.status_code == 403
    assert response.json() == {
        "allowed": False,
        "section": {"key": "ticket-tracking", "label": "Seguimiento de tickets"},
        "required_role": {"key": "it", "label": "TI"},
    }


def test_access_denied_names_supervisor_for_agent_tracking(client: TestClient) -> None:
    _login_as(client, "ana.ruiz@ejemplo.mx")
    response = client.get("/api/auth/access", params={"section": "agent-tracking"})
    assert response.status_code == 403
    assert response.json()["section"] == {
        "key": "agent-tracking",
        "label": "Seguimiento del agente",
    }
    assert response.json()["required_role"] == {"key": "supervisor", "label": "Supervisor"}


def test_access_unknown_section_is_denied_fail_closed(client: TestClient) -> None:
    _login_as(client, "luis.herrera@ejemplo.mx")
    response = client.get("/api/auth/access", params={"section": "nonexistent"})
    assert response.status_code == 403
    assert response.json() == {
        "allowed": False,
        "section": {"key": "nonexistent", "label": None},
        "required_role": None,
    }


# --- GET /accounts (public)


def test_accounts_is_public_and_lists_the_demo_users_with_email(client: TestClient) -> None:
    response = client.get("/api/auth/accounts")
    assert response.status_code == 200
    body = response.json()
    assert [a["email"] for a in body] == [
        "ana.ruiz@ejemplo.mx",
        "luis.herrera@ejemplo.mx",
        "sara.molina@ejemplo.mx",
    ]
    assert body[2] == {
        "id": "sara",
        "name": "Sara Molina",
        "email": "sara.molina@ejemplo.mx",
        "area": "Supervisión",
        "role": "supervisor",
    }
    assert all("password" not in a for a in body)
