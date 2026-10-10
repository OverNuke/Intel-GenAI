import time
from collections.abc import Callable
from typing import Any

from itsdangerous import BadData, TimestampSigner, URLSafeTimedSerializer

SESSION_SALT = "ariadna.session"
# Prototype assumption (spec REQ-DS-7): 8 hours.
SESSION_MAX_AGE_SECONDS = 8 * 60 * 60


def _clocked_signer(clock: Callable[[], float]) -> type[TimestampSigner]:
    """The signer (not the serializer) stamps and checks time, so the clock goes here."""

    class ClockedSigner(TimestampSigner):
        def get_timestamp(self) -> int:
            return int(clock())

    return ClockedSigner


class ItsDangerousSessionCodec:
    """SessionCodec port: signed `{"uid": ...}` token, role is never stored in it."""

    def __init__(self, secret: str, clock: Callable[[], float] = time.time) -> None:
        self._serializer = URLSafeTimedSerializer(
            secret, salt=SESSION_SALT, signer=_clocked_signer(clock)
        )

    def issue(self, user_id: str) -> str:
        return str(self._serializer.dumps({"uid": user_id}))

    def read(self, token: str) -> str | None:
        try:
            payload: Any = self._serializer.loads(token, max_age=SESSION_MAX_AGE_SECONDS)
        except BadData:
            return None
        uid = payload.get("uid") if isinstance(payload, dict) else None
        return uid if isinstance(uid, str) and uid else None
