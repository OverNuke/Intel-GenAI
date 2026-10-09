from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from app.modules.auth.api.deps import get_cookie_secure, get_session_codec, get_user_repository
from app.modules.auth.api.schemas import (
    AccessAllowed,
    AccessDenied,
    ErrorBody,
    LoginErrors,
    LoginRequestBody,
    RoleOut,
    SectionOut,
    UserOut,
    field_errors,
    user_out,
)
from app.modules.auth.application.ports import SessionCodec, UserRepository
from app.modules.auth.application.use_cases import (
    LoginFailure,
    check_access,
    current_user,
    list_accounts,
    login,
)
from app.modules.auth.domain.login import LoginRequest
from app.modules.auth.domain.policy import ROLE_LABELS, SECTIONS, Allowed
from app.modules.auth.infrastructure.session_cookie import (
    SESSION_COOKIE_NAME,
    delete_cookie_options,
    set_cookie_options,
)

router = APIRouter(prefix="/auth", tags=["auth"])

Users = Annotated[UserRepository, Depends(get_user_repository)]
Codec = Annotated[SessionCodec, Depends(get_session_codec)]
Secure = Annotated[bool, Depends(get_cookie_secure)]

# Errors that mean "those credentials/account do not work" (401); the rest are input errors (400).
_REJECTED_CODES = {"invalid_credentials", "unknown_account"}
_NO_SESSION = ErrorBody(detail="No hay una sesión activa.")


def _no_session() -> JSONResponse:
    return JSONResponse(status_code=401, content=_NO_SESSION.model_dump())


def _token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE_NAME)


@router.post(
    "/login",
    response_model=UserOut,
    responses={400: {"model": LoginErrors}, 401: {"model": LoginErrors}},
)
async def post_login(
    users: Users, codec: Codec, secure: Secure, body: LoginRequestBody | None = None
) -> Response:
    request = body or LoginRequestBody()
    result = await login(
        LoginRequest(method=request.method, email=request.email, password=request.password),
        users,
        codec,
    )
    if isinstance(result, LoginFailure):
        rejected = any(error.code in _REJECTED_CODES for error in result.errors)
        return JSONResponse(
            status_code=401 if rejected else 400,
            content=field_errors(result.errors).model_dump(),
        )
    response = JSONResponse(content=user_out(result.user).model_dump())
    response.set_cookie(value=result.token, **set_cookie_options(secure=secure))
    return response


@router.get("/me", response_model=UserOut, responses={401: {"model": ErrorBody}})
async def get_me(request: Request, users: Users, codec: Codec) -> Response:
    user = await current_user(_token(request), users, codec)
    if user is None:
        return _no_session()
    return JSONResponse(content=user_out(user).model_dump())


@router.post("/logout", status_code=204)
async def post_logout(secure: Secure) -> Response:
    """Idempotent: needs no session. The delete mirrors the attributes used to set."""
    response = Response(status_code=204)
    response.delete_cookie(**delete_cookie_options(secure=secure))
    return response


@router.get(
    "/access",
    response_model=AccessAllowed,
    responses={401: {"model": ErrorBody}, 403: {"model": AccessDenied}},
)
async def get_access(section: str, request: Request, users: Users, codec: Codec) -> Response:
    checked = await check_access(_token(request), section, users, codec)
    if checked is None:
        return _no_session()
    rule = SECTIONS.get(section)
    section_out = SectionOut(key=section, label=rule.label if rule else None)
    decision = checked.decision
    if isinstance(decision, Allowed):
        allowed = AccessAllowed(user=user_out(checked.user), section=section_out)
        return JSONResponse(content=allowed.model_dump())
    role = decision.required_role
    denied = AccessDenied(
        section=section_out,
        required_role=RoleOut(key=role, label=ROLE_LABELS[role]) if role else None,
    )
    return JSONResponse(status_code=403, content=denied.model_dump())


@router.get("/accounts", response_model=list[UserOut])
async def get_accounts(users: Users) -> list[UserOut]:
    """Public: feeds the A2 account picker (demo accounts carry no secrets)."""
    return [user_out(user) for user in await list_accounts(users)]
