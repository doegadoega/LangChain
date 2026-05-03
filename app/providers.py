from __future__ import annotations

import json
import os
import shlex
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Protocol

from app.models import ProviderKind


DEFAULT_COMMANDS = {
    ProviderKind.GEMINI_CLI: os.getenv("GEMINI_CLI_CMD", "gemini -p {prompt}"),
    ProviderKind.CLAUDE_CLI: os.getenv(
        "CLAUDE_CLI_CMD", "claude --print --output-format text {prompt}"
    ),
    ProviderKind.CODEX_CLI: os.getenv(
        "CODEX_CLI_CMD",
        "codex exec -c model_reasoning_effort=high --skip-git-repo-check --sandbox read-only {prompt}",
    ),
}

CODING_COMMANDS = {
    ProviderKind.CODEX_CLI: os.getenv(
        "CODEX_CLI_CODING_CMD",
        "codex exec -c model_reasoning_effort=high --full-auto {prompt}",
    ),
    ProviderKind.CLAUDE_CLI: os.getenv(
        "CLAUDE_CLI_CODING_CMD",
        "claude --print --output-format text {prompt}",
    ),
    ProviderKind.GEMINI_CLI: os.getenv(
        "GEMINI_CLI_CODING_CMD", "gemini -p {prompt}"
    ),
}

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/api")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "local-model")


class ProviderError(RuntimeError):
    pass


def _model_item(model_id: str, name: str | None = None) -> dict[str, str]:
    return {"id": model_id, "name": name or model_id}


def _dedupe_models(models: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for model in models:
        model_id = model.get("id", "").strip()
        if not model_id or model_id in seen:
            continue
        seen.add(model_id)
        unique.append({"id": model_id, "name": model.get("name") or model_id})
    return unique


class TextProvider(Protocol):
    def generate(
        self,
        *,
        prompt: str,
        model: str | None = None,
        cwd: str | None = None,
        mcp_config_path: str | None = None,
        mcp_servers: list[str] | None = None,
    ) -> str: ...


@dataclass
class CLITemplateProvider:
    command_template: str
    timeout_sec: int = 300

    def _build_args(
        self,
        prompt: str,
        model: str | None,
        mcp_config_path: str | None,
        mcp_servers: list[str] | None,
    ) -> list[str]:
        args = shlex.split(self.command_template)
        servers = mcp_servers or []
        replacements = {
            "{prompt}": prompt,
            "{query}": prompt,
            "{model}": model or "",
            "{mcp_config_path}": mcp_config_path or "",
            "{mcp_servers_csv}": ",".join(servers),
            "{mcp_servers_json}": json.dumps(servers, ensure_ascii=False),
        }
        built: list[str] = []
        for token in args:
            replaced = token
            for key, value in replacements.items():
                replaced = replaced.replace(key, value)
            built.append(replaced)

        if all("{prompt}" not in token and "{query}" not in token for token in args):
            built.append(prompt)

        return [arg for arg in built if arg]

    def generate(
        self,
        *,
        prompt: str,
        model: str | None = None,
        cwd: str | None = None,
        mcp_config_path: str | None = None,
        mcp_servers: list[str] | None = None,
    ) -> str:
        args = self._build_args(
            prompt=prompt,
            model=model,
            mcp_config_path=mcp_config_path,
            mcp_servers=mcp_servers,
        )
        try:
            completed = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=self.timeout_sec,
                check=False,
                cwd=cwd or None,
            )
        except FileNotFoundError as exc:
            raise ProviderError(
                f"command not found: {args[0]} (check CLI install and PATH)"
            ) from exc
        except subprocess.TimeoutExpired as exc:
            raise ProviderError(
                f"command timed out after {self.timeout_sec}s: {' '.join(args[:3])}..."
            ) from exc

        stdout = (completed.stdout or "").strip()
        stderr = (completed.stderr or "").strip()
        if completed.returncode != 0:
            detail = stderr or stdout or "unknown CLI error"
            raise ProviderError(f"CLI exited with code {completed.returncode}: {detail}")

        if stdout:
            return stdout
        if stderr:
            return stderr
        raise ProviderError("CLI returned empty output")


def _join_url(base_url: str, path: str) -> str:
    return urllib.parse.urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))


def _post_json(url: str, payload: dict[str, object], *, timeout_sec: int) -> dict[str, object]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_sec) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip()
        raise ProviderError(f"HTTP {exc.code} from {url}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise ProviderError(f"could not reach {url}: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ProviderError(f"request timed out after {timeout_sec}s: {url}") from exc

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ProviderError(f"invalid JSON from {url}: {body[:200]}") from exc
    if not isinstance(parsed, dict):
        raise ProviderError(f"unexpected JSON from {url}: expected object")
    return parsed


def _get_json(url: str, *, timeout_sec: int) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_sec) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip()
        raise ProviderError(f"HTTP {exc.code} from {url}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise ProviderError(f"could not reach {url}: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ProviderError(f"request timed out after {timeout_sec}s: {url}") from exc

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ProviderError(f"invalid JSON from {url}: {body[:200]}") from exc
    if not isinstance(parsed, dict):
        raise ProviderError(f"unexpected JSON from {url}: expected object")
    return parsed


def _list_openai_compatible_models(base_url: str) -> list[dict[str, str]]:
    data = _get_json(_join_url(base_url, "models"), timeout_sec=10)
    raw_models = data.get("data", [])
    if not isinstance(raw_models, list):
        return []
    models: list[dict[str, str]] = []
    for raw_model in raw_models:
        if not isinstance(raw_model, dict):
            continue
        model_id = raw_model.get("id")
        if isinstance(model_id, str):
            models.append(_model_item(model_id))
    return _dedupe_models(models)


def _list_ollama_models(base_url: str) -> list[dict[str, str]]:
    data = _get_json(_join_url(base_url, "tags"), timeout_sec=10)
    raw_models = data.get("models", [])
    if not isinstance(raw_models, list):
        return []
    models: list[dict[str, str]] = []
    for raw_model in raw_models:
        if not isinstance(raw_model, dict):
            continue
        model_id = raw_model.get("name") or raw_model.get("model")
        if isinstance(model_id, str):
            models.append(_model_item(model_id))
    return _dedupe_models(models)


def _list_ollama_models_from_command() -> list[dict[str, str]]:
    result = subprocess.run(
        ["ollama", "list"],
        capture_output=True,
        text=True,
        timeout=5,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "ollama list failed").strip()
        raise ProviderError(detail)
    models: list[dict[str, str]] = []
    for line in result.stdout.splitlines()[1:]:
        parts = line.split()
        if parts:
            models.append(_model_item(parts[0]))
    return _dedupe_models(models)


def list_provider_models(provider_kind: ProviderKind) -> dict[str, object]:
    if provider_kind == ProviderKind.LM_STUDIO:
        try:
            return {
                "provider": provider_kind.value,
                "models": _list_openai_compatible_models(LM_STUDIO_BASE_URL),
                "error": None,
            }
        except Exception as exc:
            return {"provider": provider_kind.value, "models": [], "error": str(exc)}

    if provider_kind == ProviderKind.OLLAMA:
        try:
            return {
                "provider": provider_kind.value,
                "models": _list_ollama_models(OLLAMA_BASE_URL),
                "error": None,
            }
        except Exception as api_exc:
            try:
                return {
                    "provider": provider_kind.value,
                    "models": _list_ollama_models_from_command(),
                    "error": None,
                }
            except Exception as command_exc:
                return {
                    "provider": provider_kind.value,
                    "models": [],
                    "error": f"{api_exc}; {command_exc}",
                }

    configured = {
        ProviderKind.CODEX_CLI: os.getenv("CODEX_MODEL", ""),
        ProviderKind.CLAUDE_CLI: os.getenv("CLAUDE_MODEL", ""),
        ProviderKind.GEMINI_CLI: os.getenv("GEMINI_MODEL", ""),
        ProviderKind.CUSTOM_CLI: os.getenv("CUSTOM_CLI_MODEL", ""),
    }.get(provider_kind, "")
    models = [_model_item(configured)] if configured else []
    return {
        "provider": provider_kind.value,
        "models": models,
        "error": None if models else "model listing is not available for this provider",
    }


@dataclass
class OllamaProvider:
    base_url: str = OLLAMA_BASE_URL
    default_model: str = OLLAMA_MODEL
    timeout_sec: int = 300

    def generate(
        self,
        *,
        prompt: str,
        model: str | None = None,
        cwd: str | None = None,
        mcp_config_path: str | None = None,
        mcp_servers: list[str] | None = None,
    ) -> str:
        selected_model = model or self.default_model
        data = _post_json(
            _join_url(self.base_url, "chat"),
            {
                "model": selected_model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            },
            timeout_sec=self.timeout_sec,
        )
        message = data.get("message")
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return message["content"].strip()
        response = data.get("response")
        if isinstance(response, str):
            return response.strip()
        raise ProviderError("Ollama response did not include message.content")


@dataclass
class LMStudioProvider:
    base_url: str = LM_STUDIO_BASE_URL
    default_model: str = LM_STUDIO_MODEL
    timeout_sec: int = 300

    def generate(
        self,
        *,
        prompt: str,
        model: str | None = None,
        cwd: str | None = None,
        mcp_config_path: str | None = None,
        mcp_servers: list[str] | None = None,
    ) -> str:
        selected_model = model or self.default_model
        data = _post_json(
            _join_url(self.base_url, "chat/completions"),
            {
                "model": selected_model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "stream": False,
            },
            timeout_sec=self.timeout_sec,
        )
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ProviderError("LM Studio response did not include choices")
        first = choices[0]
        if not isinstance(first, dict):
            raise ProviderError("LM Studio response choice was not an object")
        message = first.get("message")
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return message["content"].strip()
        text = first.get("text")
        if isinstance(text, str):
            return text.strip()
        raise ProviderError("LM Studio response did not include message.content")


def resolve_provider(
    *,
    provider_kind: ProviderKind,
    command_template: str | None,
    coding_mode: bool = False,
) -> TextProvider:
    if provider_kind == ProviderKind.OLLAMA:
        return OllamaProvider()

    if provider_kind == ProviderKind.LM_STUDIO:
        return LMStudioProvider()

    if provider_kind == ProviderKind.CUSTOM_CLI:
        if not command_template:
            raise ProviderError("custom_cli requires command_template")
        return CLITemplateProvider(command_template=command_template)

    if coding_mode:
        template = command_template or CODING_COMMANDS.get(
            provider_kind, DEFAULT_COMMANDS.get(provider_kind)
        )
    else:
        template = command_template or DEFAULT_COMMANDS.get(provider_kind)

    if not template:
        raise ProviderError(f"unsupported provider: {provider_kind}")

    return CLITemplateProvider(command_template=template)
