"""401/403 raised from dependencies, rendered with the same bodies as GET /auth/access.

A FastAPI dependency cannot return a response, so it raises one of these and
`register_auth_error_handlers` (called from main.py) turns them into the JSON bodies.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.modules.auth.api.schemas import AccessDenied, ErrorBody, RoleOut, SectionOut
from app.modules.auth.domain.policy import ROLE_LABELS, SECTIONS
from app.modules.auth.domain.user import Role

NO_SESSION = ErrorBody(detail="No hay una sesión activa.")


class NoSessionError(Exception):
    """No valid session cookie (401)."""


class SectionDeniedError(Exception):
    """The session user's role does not open the section (403)."""

    def __init__(self, section: str, required_role: Role | None) -> None:
        super().__init__(section)
        self.section = section
        self.required_role = required_role


def denied_body(section: str, required_role: Role | None) -> AccessDenied:
    rule = SECTIONS.get(section)
    return AccessDenied(
        section=SectionOut(key=section, label=rule.label if rule else None),
        required_role=(
            RoleOut(key=required_role, label=ROLE_LABELS[required_role]) if required_role else None
        ),
    )


async def _no_session(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(status_code=401, content=NO_SESSION.model_dump())


async def _denied(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, SectionDeniedError)
    body = denied_body(exc.section, exc.required_role)
    return JSONResponse(status_code=403, content=body.model_dump())


def register_auth_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(NoSessionError, _no_session)
    app.add_exception_handler(SectionDeniedError, _denied)
