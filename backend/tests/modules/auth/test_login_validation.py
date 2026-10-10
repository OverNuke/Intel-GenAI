import pytest

from app.modules.auth.domain.login import (
    AccountLogin,
    CredentialsLogin,
    FieldError,
    LoginInvalid,
    LoginRequest,
    normalize_email,
    validate_login,
)


def test_normalize_email_trims_and_casefolds() -> None:
    assert normalize_email("  ANA.Ruiz@Ejemplo.MX ") == "ana.ruiz@ejemplo.mx"
    assert normalize_email("luis@ejemplo.mx") == "luis@ejemplo.mx"


def test_empty_request_only_asks_for_the_method() -> None:
    assert validate_login(LoginRequest()) == LoginInvalid((FieldError("method", "required"),))


@pytest.mark.parametrize("method", ["", "sso", "ACCOUNT"])
def test_unknown_method_is_required_error(method: str) -> None:
    result = validate_login(LoginRequest(method=method, email="ana.ruiz@ejemplo.mx"))
    assert result == LoginInvalid((FieldError("method", "required"),))


def test_account_method_needs_an_email() -> None:
    expected = LoginInvalid((FieldError("email", "required"),))
    assert validate_login(LoginRequest(method="account")) == expected
    assert validate_login(LoginRequest(method="account", email="   ")) == expected


def test_account_method_with_email_is_valid_and_normalized() -> None:
    result = validate_login(LoginRequest(method="account", email=" Luis.Herrera@Ejemplo.MX "))
    assert result == AccountLogin(email="luis.herrera@ejemplo.mx")


def test_account_method_ignores_a_password_if_sent() -> None:
    result = validate_login(
        LoginRequest(method="account", email="sara.molina@ejemplo.mx", password="whatever")
    )
    assert result == AccountLogin(email="sara.molina@ejemplo.mx")


def test_credentials_empty_reports_both_fields_in_form_order() -> None:
    result = validate_login(LoginRequest(method="credentials"))
    assert result == LoginInvalid(
        (FieldError("email", "required"), FieldError("password", "required"))
    )


@pytest.mark.parametrize("email", ["ana", "ana@", "@ejemplo.mx", "ana@ejemplo", "a b@ejemplo.mx"])
def test_credentials_malformed_email_is_invalid_email(email: str) -> None:
    result = validate_login(LoginRequest(method="credentials", email=email, password="x"))
    assert result == LoginInvalid((FieldError("email", "invalid_email"),))


def test_credentials_blank_email_is_required_not_invalid() -> None:
    result = validate_login(LoginRequest(method="credentials", email="   ", password="x"))
    assert result == LoginInvalid((FieldError("email", "required"),))


def test_credentials_missing_password_is_required() -> None:
    result = validate_login(
        LoginRequest(method="credentials", email="ana.ruiz@ejemplo.mx", password="")
    )
    assert result == LoginInvalid((FieldError("password", "required"),))


def test_valid_credentials_normalize_the_email_and_keep_the_password_verbatim() -> None:
    result = validate_login(
        LoginRequest(method="credentials", email="  ANA.Ruiz@Ejemplo.MX ", password=" demo2026 ")
    )
    assert result == CredentialsLogin(email="ana.ruiz@ejemplo.mx", password=" demo2026 ")
