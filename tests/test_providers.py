from __future__ import annotations

import app.providers as providers
from app.models import ProviderKind
from app.providers import LMStudioProvider, OllamaProvider, resolve_provider


def test_resolve_provider_supports_ollama():
    provider = resolve_provider(
        provider_kind=ProviderKind.OLLAMA,
        command_template=None,
    )

    assert isinstance(provider, OllamaProvider)


def test_resolve_provider_supports_lm_studio():
    provider = resolve_provider(
        provider_kind=ProviderKind.LM_STUDIO,
        command_template=None,
    )

    assert isinstance(provider, LMStudioProvider)


def test_ollama_provider_posts_chat_payload(monkeypatch):
    calls: list[tuple[str, dict[str, object], int]] = []

    def fake_post_json(url: str, payload: dict[str, object], *, timeout_sec: int):
        calls.append((url, payload, timeout_sec))
        return {"message": {"content": " local answer "}}

    monkeypatch.setattr(providers, "_post_json", fake_post_json)

    result = OllamaProvider(base_url="http://ollama.local/api").generate(
        prompt="hello",
        model="phi4",
    )

    assert result == "local answer"
    assert calls == [
        (
            "http://ollama.local/api/chat",
            {
                "model": "phi4",
                "messages": [{"role": "user", "content": "hello"}],
                "stream": False,
            },
            300,
        )
    ]


def test_lm_studio_provider_posts_openai_compatible_payload(monkeypatch):
    calls: list[tuple[str, dict[str, object], int]] = []

    def fake_post_json(url: str, payload: dict[str, object], *, timeout_sec: int):
        calls.append((url, payload, timeout_sec))
        return {"choices": [{"message": {"content": " studio answer "}}]}

    monkeypatch.setattr(providers, "_post_json", fake_post_json)

    result = LMStudioProvider(base_url="http://studio.local/v1").generate(
        prompt="hello",
        model="qwen/qwen3",
    )

    assert result == "studio answer"
    assert calls == [
        (
            "http://studio.local/v1/chat/completions",
            {
                "model": "qwen/qwen3",
                "messages": [{"role": "user", "content": "hello"}],
                "temperature": 0.2,
                "stream": False,
            },
            300,
        )
    ]
