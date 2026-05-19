from __future__ import annotations

import logging
import os
import shutil
import socket
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Iterable

from app.models import ProviderKind
from app.providers import (
    LM_STUDIO_BASE_URL,
    OLLAMA_BASE_URL,
)

logger = logging.getLogger("app.health")


@dataclass
class ProviderHealth:
    provider: str
    alive: bool
    detail: str
    start_command: str | None = None
    docs_url: str | None = None
    binary: str | None = None
    endpoint: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "provider": self.provider,
            "alive": self.alive,
            "detail": self.detail,
            "start_command": self.start_command,
            "docs_url": self.docs_url,
            "binary": self.binary,
            "endpoint": self.endpoint,
        }


_CLI_INSTALL_HINTS = {
    "codex": {
        "command": "npm install -g @openai/codex",
        "docs": "https://github.com/openai/codex",
    },
    "claude": {
        "command": "npm install -g @anthropic-ai/claude-code",
        "docs": "https://docs.claude.com/claude-code",
    },
    "gemini": {
        "command": "npm install -g @google/gemini-cli",
        "docs": "https://github.com/google-gemini/gemini-cli",
    },
    "android-cli": {
        "command": "(android-cli は手動インストールしてください)",
        "docs": None,
    },
}

_API_KEY_ENV = {
    ProviderKind.OPENAI_API: "OPENAI_API_KEY",
    ProviderKind.ANTHROPIC_API: "ANTHROPIC_API_KEY",
    ProviderKind.DEEPSEEK_API: "DEEPSEEK_API_KEY",
}


def _check_cli(kind: ProviderKind, binary: str) -> ProviderHealth:
    path = shutil.which(binary)
    hint = _CLI_INSTALL_HINTS.get(binary, {})
    if path:
        return ProviderHealth(
            provider=kind.value,
            alive=True,
            detail=f"found at {path}",
            binary=binary,
        )
    return ProviderHealth(
        provider=kind.value,
        alive=False,
        detail=f"`{binary}` が PATH に見つかりません",
        start_command=hint.get("command"),
        docs_url=hint.get("docs"),
        binary=binary,
    )


def _check_http(url: str, *, timeout: float = 2.0) -> tuple[bool, str]:
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = getattr(response, "status", 200)
            return True, f"HTTP {status}"
    except urllib.error.HTTPError as exc:
        # 200-499 reachable -> alive
        if exc.code < 500:
            return True, f"HTTP {exc.code}"
        return False, f"HTTP {exc.code}"
    except urllib.error.URLError as exc:
        reason = getattr(exc, "reason", exc)
        return False, f"接続失敗: {reason}"
    except (socket.timeout, TimeoutError):
        return False, f"タイムアウト ({timeout}s)"
    except OSError as exc:
        return False, f"OS エラー: {exc}"


def _check_ollama() -> ProviderHealth:
    url = OLLAMA_BASE_URL.rstrip("/") + "/tags"
    alive, detail = _check_http(url)
    return ProviderHealth(
        provider=ProviderKind.OLLAMA.value,
        alive=alive,
        detail=detail,
        endpoint=OLLAMA_BASE_URL,
        start_command=None if alive else "ollama serve",
        docs_url="https://ollama.com/download",
    )


def _check_lm_studio() -> ProviderHealth:
    url = LM_STUDIO_BASE_URL.rstrip("/") + "/models"
    alive, detail = _check_http(url)
    return ProviderHealth(
        provider=ProviderKind.LM_STUDIO.value,
        alive=alive,
        detail=detail,
        endpoint=LM_STUDIO_BASE_URL,
        start_command=None
        if alive
        else "LM Studio アプリ → Developer → Local Server → Start (default port 1234)",
        docs_url="https://lmstudio.ai/",
    )


def _check_api_key(kind: ProviderKind) -> ProviderHealth:
    env_name = _API_KEY_ENV[kind]
    value = os.environ.get(env_name, "").strip()
    if value:
        return ProviderHealth(
            provider=kind.value,
            alive=True,
            detail=f"{env_name} 設定済み",
        )
    return ProviderHealth(
        provider=kind.value,
        alive=False,
        detail=f"環境変数 {env_name} が未設定",
        start_command=f"export {env_name}=...",
    )


def _check_provider(kind: ProviderKind) -> ProviderHealth:
    if kind == ProviderKind.CODEX_CLI:
        return _check_cli(kind, "codex")
    if kind == ProviderKind.CLAUDE_CLI:
        return _check_cli(kind, "claude")
    if kind == ProviderKind.GEMINI_CLI:
        return _check_cli(kind, "gemini")
    if kind == ProviderKind.ANDROID_CLI:
        return _check_cli(kind, "android-cli")
    if kind == ProviderKind.OLLAMA:
        return _check_ollama()
    if kind == ProviderKind.LM_STUDIO:
        return _check_lm_studio()
    if kind in _API_KEY_ENV:
        return _check_api_key(kind)
    if kind == ProviderKind.CUSTOM_CLI:
        return ProviderHealth(
            provider=kind.value,
            alive=True,
            detail="custom_cli はコマンドテンプレート依存のため判定スキップ",
        )
    return ProviderHealth(
        provider=kind.value,
        alive=False,
        detail="unknown provider",
    )


def precheck_agents(agents: Iterable[object]) -> dict[str, object]:
    """Given AgentConfig-like objects (must expose `.provider` and `.enabled`),
    return a precheck summary for the providers actually used by enabled agents.

    Returns: { "ok": bool, "dead": [ProviderHealth dict, ...], "checked": [...] }.
    """
    kinds: list[ProviderKind] = []
    seen: set[str] = set()
    for agent in agents:
        if getattr(agent, "enabled", True) is False:
            continue
        provider = getattr(agent, "provider", None)
        if provider is None:
            continue
        key = provider.value if isinstance(provider, ProviderKind) else str(provider)
        if key in seen:
            continue
        seen.add(key)
        try:
            kinds.append(provider if isinstance(provider, ProviderKind) else ProviderKind(key))
        except ValueError:
            continue

    results = check_providers(kinds)
    dead = [r for r in results if not r.alive]
    return {
        "ok": not dead,
        "dead": [r.to_dict() for r in dead],
        "checked": [r.to_dict() for r in results],
    }


def check_providers(kinds: Iterable[ProviderKind] | None = None) -> list[ProviderHealth]:
    targets = list(kinds) if kinds is not None else list(ProviderKind)
    results: list[ProviderHealth] = []
    for kind in targets:
        try:
            results.append(_check_provider(kind))
        except Exception as exc:  # belt and braces
            logger.exception("health.check failed for %s", kind)
            results.append(
                ProviderHealth(
                    provider=kind.value,
                    alive=False,
                    detail=f"内部エラー: {exc}",
                )
            )
    return results
