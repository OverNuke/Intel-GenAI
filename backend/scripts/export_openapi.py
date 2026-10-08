"""Dump the FastAPI OpenAPI schema to ``backend/openapi.json`` (the committed contract)."""

import json
from pathlib import Path

from app.main import app

DEFAULT_PATH = Path(__file__).resolve().parents[1] / "openapi.json"


def export(path: Path = DEFAULT_PATH) -> Path:
    path.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
    return path


if __name__ == "__main__":
    print(f"wrote {export()}")
