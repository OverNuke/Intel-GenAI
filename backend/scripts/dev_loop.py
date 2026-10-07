"""Dev-only uvicorn loop factory.

psycopg async cannot run on Windows' default ProactorEventLoop. A loop *policy* is ignored
by uvicorn >= 0.36 (it passes a loop factory), so we provide a factory instead:

    uv run uvicorn app.main:app --reload --loop scripts.dev_loop:selector_loop_factory
"""

import asyncio
import sys
from collections.abc import Callable

from uvicorn.loops.auto import auto_loop_factory


def selector_loop_factory(
    use_subprocess: bool = False, platform: str = sys.platform
) -> Callable[[], asyncio.AbstractEventLoop]:
    if platform == "win32":
        return asyncio.SelectorEventLoop
    return auto_loop_factory(use_subprocess=use_subprocess)
