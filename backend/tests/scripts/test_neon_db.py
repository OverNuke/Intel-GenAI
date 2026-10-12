from scripts.neon_db import describe_target, pick_url


def test_describe_target_hides_credentials():
    url = "postgresql://owner:s3cret@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require"

    shown = describe_target(url)

    assert "s3cret" not in shown
    assert "owner" not in shown
    assert shown == "ep-cool-123.us-east-2.aws.neon.tech/neondb"


def test_describe_target_flags_pooled_host():
    url = "postgresql://u:p@ep-cool-123-pooler.us-east-2.aws.neon.tech/neondb"

    assert describe_target(url).endswith("(POOLED)")


def test_pick_url_prefers_unpooled_then_pooled_then_none():
    assert pick_url({"DATABASE_URL_UNPOOLED": "a", "DATABASE_URL": "b"}) == "a"
    assert pick_url({"DATABASE_URL": "b"}) == "b"
    assert pick_url({}) is None
