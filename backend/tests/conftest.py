import asyncio
import sys
from collections.abc import Callable, Mapping

import pytest


def pytest_asyncio_loop_factories(
    config: pytest.Config, item: pytest.Item
) -> Mapping[str, Callable[[], asyncio.AbstractEventLoop]] | None:
    # psycopg async cannot run on Windows' default ProactorEventLoop (real-DB tests).
    if sys.platform == "win32":
        return {"selector": asyncio.SelectorEventLoop}
    return None
