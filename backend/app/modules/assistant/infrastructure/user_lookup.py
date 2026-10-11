"""UserLookup adapter over the auth module's demo accounts (read-only, ADR-0008).

Only display names leave this adapter: no ids, emails, roles or areas reach the model.
"""

import re

from app.modules.assistant.domain.text import fold
from app.modules.auth.application.ports import UserRepository

_MIN_TOKEN = 2


def _tokens(text: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", fold(text)) if t]


class AccountUserLookup:
    def __init__(self, users: UserRepository) -> None:
        self._users = users

    async def find_by_name(self, query: str, *, exclude_user_id: str | None = None) -> list[str]:
        wanted = [t for t in _tokens(query) if len(t) >= _MIN_TOKEN]
        if not wanted:
            return []
        matches: list[str] = []
        for user in await self._users.list():
            if user.id == exclude_user_id:
                continue
            name_tokens = _tokens(user.display_name)
            if all(any(n.startswith(w) for n in name_tokens) for w in wanted):
                matches.append(user.display_name)
        return matches
