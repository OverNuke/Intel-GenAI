import time

from itsdangerous import URLSafeTimedSerializer

from app.modules.auth.infrastructure.session_codec import (
    SESSION_MAX_AGE_SECONDS,
    SESSION_SALT,
    ItsDangerousSessionCodec,
)

SECRET = "test-secret"


class Clock:
    def __init__(self) -> None:
        # Real time: tokens built by a raw serializer stamp the real clock, and a stamp in the
        # codec's future would be rejected for the wrong reason.
        self.now = time.time()

    def __call__(self) -> float:
        return self.now


def _codec(clock: Clock | None = None, secret: str = SECRET) -> ItsDangerousSessionCodec:
    return ItsDangerousSessionCodec(secret, clock=clock or Clock())


def _raw_serializer(secret: str = SECRET) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret, salt=SESSION_SALT)


def test_session_lifetime_is_eight_hours() -> None:
    assert SESSION_MAX_AGE_SECONDS == 8 * 60 * 60


def test_roundtrip_returns_the_user_id() -> None:
    codec = _codec()
    assert codec.read(codec.issue("ana")) == "ana"
    assert codec.read(codec.issue("sara")) == "sara"


def test_payload_carries_only_the_user_id() -> None:
    token = _codec().issue("luis")
    assert _raw_serializer().loads(token) == {"uid": "luis"}


def test_tokens_for_different_users_differ() -> None:
    codec = _codec()
    assert codec.issue("ana") != codec.issue("luis")


def test_modified_signature_is_rejected() -> None:
    codec = _codec()
    token = codec.issue("ana")
    head, signature = token.rsplit(".", 1)
    # Flip the FIRST signature char: it carries 6 full bits of the HMAC. The last char of a
    # 20-byte HMAC only has 4 data bits (+2 padding), so flipping it can leave the bytes unchanged.
    flipped = head + "." + ("A" if signature[0] != "A" else "B") + signature[1:]
    assert flipped != token
    assert codec.read(flipped) is None


def test_payload_swapped_for_another_user_is_rejected() -> None:
    codec = _codec()
    ana, luis = codec.issue("ana"), codec.issue("luis")
    forged = luis.split(".")[0] + "." + ".".join(ana.split(".")[1:])
    assert codec.read(forged) is None


def test_token_signed_with_another_secret_is_rejected() -> None:
    assert _codec().read(_codec(secret="other").issue("ana")) is None


def test_token_signed_with_another_salt_is_rejected() -> None:
    foreign = URLSafeTimedSerializer(SECRET, salt="something-else").dumps({"uid": "ana"})
    assert _codec().read(foreign) is None


def test_expired_token_is_rejected_but_valid_just_before_the_limit() -> None:
    clock = Clock()
    codec = _codec(clock)
    token = codec.issue("ana")
    clock.now += SESSION_MAX_AGE_SECONDS - 1
    assert codec.read(token) == "ana"
    clock.now += 2
    assert codec.read(token) is None


def test_garbage_and_empty_tokens_are_rejected() -> None:
    codec = _codec()
    assert codec.read("") is None
    assert codec.read("not-a-token") is None
    assert codec.read("a.b.c") is None


def test_validly_signed_but_malformed_payloads_are_rejected() -> None:
    codec = _codec()
    for payload in ({"role": "it"}, {"uid": 7}, {"uid": ""}, ["ana"], "ana"):
        assert codec.read(_raw_serializer().dumps(payload)) is None
