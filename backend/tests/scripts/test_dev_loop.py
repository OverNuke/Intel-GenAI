import asyncio

from uvicorn.loops.auto import auto_loop_factory

from scripts.dev_loop import selector_loop_factory


def test_win32_uses_selector_event_loop() -> None:
    assert selector_loop_factory(platform="win32") is asyncio.SelectorEventLoop


def test_win32_selector_loop_is_forced_even_with_subprocess_flag() -> None:
    assert selector_loop_factory(use_subprocess=True, platform="win32") is asyncio.SelectorEventLoop


def test_non_win32_delegates_to_uvicorn_auto_factory() -> None:
    assert selector_loop_factory(platform="linux") == auto_loop_factory(use_subprocess=False)


def test_win32_factory_builds_a_working_selector_loop() -> None:
    loop = selector_loop_factory(platform="win32")()
    try:
        assert isinstance(loop, asyncio.SelectorEventLoop)
        assert loop.run_until_complete(asyncio.sleep(0, result="ran")) == "ran"
    finally:
        loop.close()
