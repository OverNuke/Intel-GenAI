"""Cookie attributes for the session, shared by set and delete so they always match.

HttpOnly, SameSite=Lax, Path=/, no Domain; Secure only when served over HTTPS (on Vercel).
"""

from typing import Any

from app.modules.auth.infrastructure.session_codec import SESSION_MAX_AGE_SECONDS

SESSION_COOKIE_NAME = "ariadna_session"


def delete_cookie_options(*, secure: bool) -> dict[str, Any]:
    return {
        "key": SESSION_COOKIE_NAME,
        "httponly": True,
        "samesite": "lax",
        "path": "/",
        "secure": secure,
    }


def set_cookie_options(*, secure: bool) -> dict[str, Any]:
    return {**delete_cookie_options(secure=secure), "max_age": SESSION_MAX_AGE_SECONDS}
