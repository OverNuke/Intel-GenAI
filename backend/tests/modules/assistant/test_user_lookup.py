"""The UserLookup adapter over the auth module's demo accounts: names out, nothing else."""

from app.modules.assistant.infrastructure.user_lookup import AccountUserLookup
from app.modules.auth.domain.user import User

ACCOUNTS = [
    User(id="u1", display_name="Ana Ruiz", email="ana.ruiz@x.mx", role="user", area="Captura"),
    User(id="u2", display_name="Luis Herrera", email="luis@x.mx", role="it", area="TI"),
    User(id="u3", display_name="Sara Molina", email="sara@x.mx", role="supervisor", area="TI"),
    User(id="u4", display_name="Álvaro Luján", email="alvaro@x.mx", role="user", area="Obras"),
]


class _Users:
    async def get(self, user_id: str) -> User | None:
        return next((u for u in ACCOUNTS if u.id == user_id), None)

    async def list(self) -> list[User]:
        return list(ACCOUNTS)

    async def find_by_email(self, email: str) -> User | None:
        return None


LOOKUP = AccountUserLookup(_Users())


async def test_matches_by_first_name_ignoring_case_and_accents() -> None:
    assert await LOOKUP.find_by_name("luis") == ["Luis Herrera"]
    assert await LOOKUP.find_by_name("ALVARO") == ["Álvaro Luján"]
    assert await LOOKUP.find_by_name("lujan") == ["Álvaro Luján"]


async def test_matches_a_full_name_and_returns_only_display_names() -> None:
    result = await LOOKUP.find_by_name("Sara Molina")
    assert result == ["Sara Molina"]
    assert all("@" not in name and not name.startswith("u") for name in result)


async def test_excluded_user_is_never_returned() -> None:
    assert await LOOKUP.find_by_name("Ana", exclude_user_id="u1") == []


async def test_no_match_and_blank_queries_return_nothing() -> None:
    assert await LOOKUP.find_by_name("Zacarias") == []
    assert await LOOKUP.find_by_name("   ") == []


async def test_a_short_fragment_does_not_match_everyone() -> None:
    assert await LOOKUP.find_by_name("a") == []
