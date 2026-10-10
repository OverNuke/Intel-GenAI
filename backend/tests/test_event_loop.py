"""psycopg async cannot run on Windows' ProactorEventLoop; the suite must use a selector loop."""

import asyncio
import sys

import pytest


@pytest.mark.skipif(sys.platform != "win32", reason="Proactor is the Windows default only")
async def test_async_tests_run_on_a_selector_loop_on_windows() -> None:
    assert isinstance(asyncio.get_running_loop(), asyncio.SelectorEventLoop)
