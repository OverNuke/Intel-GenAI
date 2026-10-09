import pytest

from app.modules.auth.infrastructure.session_codec import SESSION_MAX_AGE_SECONDS
from app.modules.auth.infrastructure.session_cookie import (
    SESSION_COOKIE_NAME,
    delete_cookie_options,
    set_cookie_options,
)


def test_cookie_name() -> None:
    assert SESSION_COOKIE_NAME == "ariadna_session"


@pytest.mark.parametrize("secure", [True, False])
def test_set_options_are_httponly_lax_site_wide_and_eight_hours(secure: bool) -> None:
    assert set_cookie_options(secure=secure) == {
        "key": "ariadna_session",
        "httponly": True,
        "samesite": "lax",
        "path": "/",
        "max_age": SESSION_MAX_AGE_SECONDS,
        "secure": secure,
    }


@pytest.mark.parametrize("secure", [True, False])
def test_delete_options_mirror_the_set_attributes_without_a_lifetime(secure: bool) -> None:
    options = delete_cookie_options(secure=secure)
    assert options == {
        "key": "ariadna_session",
        "httponly": True,
        "samesite": "lax",
        "path": "/",
        "secure": secure,
    }
    assert "domain" not in options
