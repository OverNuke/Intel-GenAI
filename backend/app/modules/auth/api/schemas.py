from typing import Literal

from pydantic import BaseModel

from app.modules.auth.domain.login import FieldError
from app.modules.auth.domain.user import Role, User


class LoginRequestBody(BaseModel):
    """Lenient on purpose: every field optional so the use case, not FastAPI (422), reports
    which field is wrong. Do not tighten into a strict union."""

    method: Literal["account", "credentials"] | str | None = None
    email: str | None = None
    password: str | None = None


class FieldErrorBody(BaseModel):
    field: Literal["method", "email", "password", "form"]
    code: Literal["required", "invalid_email", "invalid_credentials", "unknown_account"]


class LoginErrors(BaseModel):
    errors: list[FieldErrorBody]


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    area: str
    role: Role


class SectionOut(BaseModel):
    key: str
    label: str | None  # None for an unknown section key


class RoleOut(BaseModel):
    key: Role
    label: str


class AccessAllowed(BaseModel):
    allowed: Literal[True] = True
    user: UserOut
    section: SectionOut


class AccessDenied(BaseModel):
    allowed: Literal[False] = False
    section: SectionOut
    required_role: RoleOut | None  # None for an unknown section: no role opens it


class ErrorBody(BaseModel):
    detail: str


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id, name=user.display_name, email=user.email, area=user.area, role=user.role
    )


def field_errors(errors: tuple[FieldError, ...]) -> LoginErrors:
    return LoginErrors(errors=[FieldErrorBody(field=e.field, code=e.code) for e in errors])
