"""Dev-only uvicorn loop factory.

psycopg async cannot run on Windows' default ProactorEventLoop. A loop *policy* is ignored
by uvicorn >= 0.36, and a custom `--loop module:attr` value is used as the zero-argument
loop factory itself (asyncio.run(..., loop_factory=...)), so it must return a loop instance:

    uv run uvicorn app.main:app --reload --loop scripts.dev_loop:selector_loop_factory
"""

import asyncio
import sys

from uvicorn.loops.auto import auto_loop_factory


def selector_loop_factory(platform: str = sys.platform) -> asyncio.AbstractEventLoop:
    if platform == "win32":
        return asyncio.SelectorEventLoop()
    return auto_loop_factory()()
