import json
from pathlib import Path

from app.main import app
from scripts.export_openapi import export

COMMITTED = Path(__file__).resolve().parents[2] / "openapi.json"


def test_export_writes_valid_json_with_health_path(tmp_path: Path) -> None:
    target = tmp_path / "openapi.json"

    export(target)

    spec = json.loads(target.read_text(encoding="utf-8"))
    assert "/api/health" in spec["paths"]


def test_export_matches_app_openapi(tmp_path: Path) -> None:
    target = tmp_path / "openapi.json"

    export(target)

    assert json.loads(target.read_text(encoding="utf-8")) == app.openapi()


def test_committed_openapi_has_not_drifted() -> None:
    assert json.loads(COMMITTED.read_text(encoding="utf-8")) == app.openapi()
