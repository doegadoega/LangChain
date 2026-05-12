from __future__ import annotations

from types import SimpleNamespace

import app.providers as providers
from app.models import ProviderKind
from app.providers import (
    CLITemplateProvider,
    DeepSeekAPIProvider,
    LMStudioProvider,
    OllamaProvider,
    resolve_provider,
)


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


def test_resolve_provider_supports_deepseek_api():
    provider = resolve_provider(
        provider_kind=ProviderKind.DEEPSEEK_API,
        command_template=None,
    )

    assert isinstance(provider, DeepSeekAPIProvider)


def test_resolve_provider_supports_android_cli(monkeypatch):
    monkeypatch.setenv("ANDROID_CLI_CMD", "android-cli run {prompt}")
    provider = resolve_provider(
        provider_kind=ProviderKind.ANDROID_CLI,
        command_template=None,
    )

    assert isinstance(provider, CLITemplateProvider)
    assert provider.command_template == "android-cli run {prompt}"


def test_resolve_provider_supports_android_cli_coding_command(monkeypatch):
    monkeypatch.setenv("ANDROID_CLI_CMD", "android-cli ask {prompt}")
    monkeypatch.setenv("ANDROID_CLI_CODING_CMD", "android-cli code --write {prompt}")
    provider = resolve_provider(
        provider_kind=ProviderKind.ANDROID_CLI,
        command_template=None,
        coding_mode=True,
    )

    assert isinstance(provider, CLITemplateProvider)
    assert provider.command_template == "android-cli code --write {prompt}"


def test_deepseek_provider_posts_openai_compatible_payload(monkeypatch):
    calls: list[tuple[str, dict[str, object], int, dict[str, str] | None]] = []

    def fake_post_json(
        url: str,
        payload: dict[str, object],
        *,
        timeout_sec: int,
        headers: dict[str, str] | None = None,
    ):
        calls.append((url, payload, timeout_sec, headers))
        return {"choices": [{"message": {"content": " deepseek answer "}}]}

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(providers, "_post_json", fake_post_json)

    result = DeepSeekAPIProvider(base_url="https://deepseek.local").generate(
        prompt="hello",
        model="deepseek-v4-flash",
    )

    assert result == "deepseek answer"
    assert calls == [
        (
            "https://deepseek.local/chat/completions",
            {
                "model": "deepseek-v4-flash",
                "messages": [{"role": "user", "content": "hello"}],
                "temperature": 0.2,
                "stream": False,
                "thinking": {"type": "disabled"},
            },
            300,
            {"Authorization": "Bearer test-key"},
        )
    ]


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


def test_codex_cli_provider_sends_prompt_via_stdin(monkeypatch):
    prompt = "長い依頼" * 20_000
    calls: list[dict[str, object]] = []

    def fake_run(*args, **kwargs):
        calls.append({"args": args[0], "input": kwargs.get("input")})
        return SimpleNamespace(returncode=0, stdout=" done ", stderr="")

    monkeypatch.setattr(providers.subprocess, "run", fake_run)

    result = CLITemplateProvider("codex exec --sandbox workspace-write {prompt}").generate(prompt=prompt)

    assert result == "done"
    assert calls[0]["args"] == ["codex", "exec", "--sandbox", "workspace-write", "-"]
    assert calls[0]["input"] == prompt


def test_codex_cli_provider_rewrites_deprecated_full_auto(monkeypatch):
    prompt = "短い依頼"
    calls: list[dict[str, object]] = []

    def fake_run(*args, **kwargs):
        calls.append({"args": args[0], "input": kwargs.get("input")})
        return SimpleNamespace(returncode=0, stdout=" done ", stderr="")

    monkeypatch.setattr(providers.subprocess, "run", fake_run)

    result = CLITemplateProvider("codex exec --full-auto {prompt}").generate(prompt=prompt)

    assert result == "done"
    assert calls[0]["args"] == ["codex", "exec", "--sandbox", "workspace-write", "-"]
    assert calls[0]["input"] == prompt


def test_claude_cli_provider_sends_prompt_via_stdin(monkeypatch):
    prompt = "長い依頼" * 20_000
    calls: list[dict[str, object]] = []

    def fake_run(*args, **kwargs):
        calls.append({"args": args[0], "input": kwargs.get("input")})
        return SimpleNamespace(returncode=0, stdout=" done ", stderr="")

    monkeypatch.setattr(providers.subprocess, "run", fake_run)

    result = CLITemplateProvider("claude --print --output-format text {prompt}").generate(
        prompt=prompt
    )

    assert result == "done"
    assert calls[0]["args"] == ["claude", "--print", "--output-format", "text"]
    assert calls[0]["input"] == prompt


def test_gemini_cli_provider_sends_prompt_via_stdin_with_empty_prompt_arg(monkeypatch):
    prompt = "長い依頼" * 20_000
    calls: list[dict[str, object]] = []

    def fake_run(*args, **kwargs):
        calls.append({"args": args[0], "input": kwargs.get("input")})
        return SimpleNamespace(returncode=0, stdout=" done ", stderr="")

    monkeypatch.setattr(providers.subprocess, "run", fake_run)

    result = CLITemplateProvider("gemini -p {prompt}").generate(prompt=prompt)

    assert result == "done"
    assert calls[0]["args"] == ["gemini", "-p", ""]
    assert calls[0]["input"] == prompt
