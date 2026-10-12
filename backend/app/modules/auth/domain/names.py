"""Name matching for the UserDirectory: case- and diacritic-insensitive, whole words only."""

import unicodedata
from collections.abc import Iterable

from app.modules.auth.domain.user import User


def normalize_name(value: str) -> str:
    """"  María   LÓPEZ " -> "maria lopez"."""
    decomposed = unicodedata.normalize("NFKD", value)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(stripped.casefold().split())


def match_users(users: Iterable[User], query: str) -> list[User]:
    """Users whose display name contains every word of `query` ("ana" finds "Ana Ruiz").

    Whole words, so "an" finds nobody; a blank query finds nobody.
    """
    wanted = set(normalize_name(query).split())
    if not wanted:
        return []
    return [u for u in users if wanted <= set(normalize_name(u.display_name).split())]
