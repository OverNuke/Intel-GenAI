import asyncio

from uvicorn import Config

from scripts.dev_loop import selector_loop_factory


def test_win32_returns_a_selector_event_loop_instance() -> None:
    loop = selector_loop_factory(platform="win32")
    try:
        assert isinstance(loop, asyncio.SelectorEventLoop)
        assert loop.run_until_complete(asyncio.sleep(0, result="ran")) == "ran"
    finally:
        loop.close()


def test_non_win32_returns_a_loop_instance() -> None:
    loop = selector_loop_factory(platform="linux")
    try:
        assert isinstance(loop, asyncio.AbstractEventLoop)
    finally:
        loop.close()


def test_uvicorn_calls_the_custom_loop_string_with_no_arguments() -> None:
    # uvicorn >= 0.36 returns the imported object itself as the zero-arg loop factory.
    config = Config("app.main:app", loop="scripts.dev_loop:selector_loop_factory")
    factory = config.get_loop_factory()
    assert factory is not None
    loop = factory()
    try:
        assert isinstance(loop, asyncio.AbstractEventLoop)
    finally:
        loop.close()
