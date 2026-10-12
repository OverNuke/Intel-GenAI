"""Adapter selection matrix (REQ-AC-4): configuration never fails the request."""

import logging

import pytest

from app.modules.assistant.api.deps import get_assistant
from app.modules.assistant.infrastructure.fake import FakeAssistant
from app.modules.assistant.infrastructure.openai_adapter import OpenAICompatibleAssistant
from app.shared.config import get_settings

_NAMES = (
    "LLM_BASE_URL",
    "LLM_MODEL",
    "LLM_API_KEY",
    "ASSISTANT_ADAPTER",
    "ASSISTANT_MODE",
    "LLM_TIMEOUT_SECONDS",
)


@pytest.fixture(autouse=True)
def _clean(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in _NAMES:
        monkeypatch.delenv(name, raising=False)
    get_settings.cache_clear()


def _full(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_BASE_URL", "https://llm.example/v1")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("LLM_API_KEY", "sk-test")
    get_settings.cache_clear()


def test_nothing_configured_gives_the_fake() -> None:
    assert isinstance(get_assistant(), FakeAssistant)


def test_full_configuration_gives_the_openai_adapter_without_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _full(monkeypatch)
    adapter = get_assistant()
    assert isinstance(adapter, OpenAICompatibleAssistant)
    assert adapter.max_retries == 0


def test_explicit_fake_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    _full(monkeypatch)
    monkeypatch.setenv("ASSISTANT_ADAPTER", "fake")
    get_settings.cache_clear()
    assert isinstance(get_assistant(), FakeAssistant)


def test_openai_without_a_key_falls_back_to_fake_and_warns(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setenv("ASSISTANT_ADAPTER", "openai")
    get_settings.cache_clear()
    with caplog.at_level(logging.WARNING):
        adapter = get_assistant()
    assert isinstance(adapter, FakeAssistant)
    assert any("fake adapter" in record.message for record in caplog.records)


def test_mode_defaults_to_single_for_both_adapters(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = get_assistant()
    assert isinstance(fake, FakeAssistant)
    assert fake.mode == "single"
    _full(monkeypatch)
    real = get_assistant()
    assert isinstance(real, OpenAICompatibleAssistant)
    assert real.mode == "single"


def test_assistant_mode_agent_reaches_the_adapter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ASSISTANT_MODE", "agent")
    get_settings.cache_clear()
    fake = get_assistant()
    assert isinstance(fake, FakeAssistant)
    assert fake.mode == "agent"
    _full(monkeypatch)
    real = get_assistant()
    assert isinstance(real, OpenAICompatibleAssistant)
    assert real.mode == "agent"
    assert real.max_retries == 0


def test_an_invalid_mode_means_single(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ASSISTANT_MODE", "autonomous")
    get_settings.cache_clear()
    adapter = get_assistant()
    assert isinstance(adapter, FakeAssistant)
    assert adapter.mode == "single"
