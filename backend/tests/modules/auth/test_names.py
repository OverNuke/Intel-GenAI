"""Name matching of the UserDirectory: case- and diacritic-insensitive, whole-word."""

from app.modules.auth.domain.names import match_users, normalize_name
from app.modules.auth.domain.user import User
from app.seed.data import USERS


def _user(user_id: str, name: str) -> User:
    return User(id=user_id, display_name=name, email=f"{user_id}@x.mx", role="user", area="A")


def test_normalize_drops_case_accents_and_extra_spaces() -> None:
    assert normalize_name("  María   LÓPEZ ") == "maria lopez"


def test_full_name_first_name_and_last_name_find_the_demo_account() -> None:
    for query in ("Ana Ruiz", "ana", "RUIZ", "  ana  "):
        assert [u.id for u in match_users(USERS, query)] == ["ana"]


def test_accents_are_ignored_in_both_directions() -> None:
    users = [_user("maria", "María López")]
    assert [u.id for u in match_users(users, "maria lopez")] == ["maria"]
    assert [u.id for u in match_users([_user("m", "Maria Lopez")], "María")] == ["m"]


def test_a_shared_first_name_returns_every_candidate() -> None:
    users = [_user("a1", "Ana Ruiz"), _user("a2", "Ana López"), _user("l", "Luis Herrera")]
    assert {u.id for u in match_users(users, "ana")} == {"a1", "a2"}
    assert [u.id for u in match_users(users, "ana lopez")] == ["a2"]


def test_partial_words_blank_and_unknown_names_match_nobody() -> None:
    assert match_users(USERS, "an") == []
    assert match_users(USERS, "   ") == []
    assert match_users(USERS, "Pedro") == []
