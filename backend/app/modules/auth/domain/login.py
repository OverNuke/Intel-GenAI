"""Login request validation. Lenient on purpose: every field optional so the use case, not the
HTTP layer, reports which field is wrong (the design forbids a strict union that yields 422)."""

import hmac
import re
from dataclasses import dataclass
from typing import Literal

# The credentials path signs in Ana only; the other demo accounts enter through the picker.
DEMO_EMAIL = "ana.ruiz@ejemplo.mx"
DEMO_PASSWORD = "demo2026"

_EMAIL_SHAPE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


@dataclass(frozen=True)
class LoginRequest:
    method: str | None = None
    email: str | None = None
    password: str | None = None


@dataclass(frozen=True)
class FieldError:
    field: Literal["method", "email", "password", "form"]
    code: Literal["required", "invalid_email", "invalid_credentials", "unknown_account"]


@dataclass(frozen=True)
class AccountLogin:
    email: str


@dataclass(frozen=True)
class CredentialsLogin:
    email: str
    password: str


@dataclass(frozen=True)
class LoginInvalid:
    errors: tuple[FieldError, ...]


def normalize_email(raw: str) -> str:
    return raw.strip().casefold()


def is_demo_credentials(email: str, password: str) -> bool:
    """Constant-time on both parts; `email` is expected normalized."""
    email_ok = hmac.compare_digest(email.encode(), DEMO_EMAIL.encode())
    password_ok = hmac.compare_digest(password.encode(), DEMO_PASSWORD.encode())
    return email_ok and password_ok


def _validate_credentials(request: LoginRequest) -> CredentialsLogin | LoginInvalid:
    errors: list[FieldError] = []
    email = normalize_email(request.email or "")
    if not email:
        errors.append(FieldError("email", "required"))
    elif not _EMAIL_SHAPE.fullmatch(email):
        errors.append(FieldError("email", "invalid_email"))
    if not request.password:
        errors.append(FieldError("password", "required"))
    if errors:
        return LoginInvalid(tuple(errors))
    return CredentialsLogin(email=email, password=request.password or "")


def validate_login(request: LoginRequest) -> AccountLogin | CredentialsLogin | LoginInvalid:
    if request.method == "account":
        email = normalize_email(request.email or "")
        if not email:
            return LoginInvalid((FieldError("email", "required"),))
        return AccountLogin(email=email)
    if request.method == "credentials":
        return _validate_credentials(request)
    return LoginInvalid((FieldError("method", "required"),))
