import json
from pathlib import Path

from app.main import app

COMMITTED = Path(__file__).resolve().parents[3] / "openapi.json"


def _spec() -> dict[str, object]:
    return json.loads(COMMITTED.read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def test_committed_openapi_exposes_every_auth_operation() -> None:
    paths = _spec()["paths"]
    assert isinstance(paths, dict)
    assert set(paths["/api/auth/login"]) == {"post"}
    assert set(paths["/api/auth/me"]) == {"get"}
    assert set(paths["/api/auth/logout"]) == {"post"}
    assert set(paths["/api/auth/access"]) == {"get"}
    assert set(paths["/api/auth/accounts"]) == {"get"}


def test_status_codes_match_the_contract() -> None:
    paths = app.openapi()["paths"]
    assert {"200", "400", "401"} <= set(paths["/api/auth/login"]["post"]["responses"])
    assert {"200", "401"} <= set(paths["/api/auth/me"]["get"]["responses"])
    assert "204" in paths["/api/auth/logout"]["post"]["responses"]
    assert {"200", "401", "403"} <= set(paths["/api/auth/access"]["get"]["responses"])
    assert "200" in paths["/api/auth/accounts"]["get"]["responses"]


def test_user_schema_exposes_email_area_and_role_but_no_secret() -> None:
    schemas = app.openapi()["components"]["schemas"]
    assert set(schemas["UserOut"]["properties"]) == {"id", "name", "email", "area", "role"}
    assert "password" not in json.dumps(schemas["UserOut"])
    assert set(schemas["LoginRequestBody"]["properties"]) == {"method", "email", "password"}


def test_access_denied_schema_carries_section_and_required_role() -> None:
    schemas = app.openapi()["components"]["schemas"]
    assert set(schemas["AccessDenied"]["properties"]) == {"allowed", "section", "required_role"}
    assert set(schemas["SectionOut"]["properties"]) == {"key", "label"}
    assert set(schemas["RoleOut"]["properties"]) == {"key", "label"}
