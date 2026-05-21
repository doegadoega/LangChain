from __future__ import annotations

import json
import logging
import os
import shlex
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Protocol

from app.models import ProviderKind

logger = logging.getLogger("app.providers")

# CLIs whose argv form is unsafe for large prompts; always feed prompt via stdin.
_STDIN_CAPABLE = {"codex", "gemini", "claude"}


DEFAULT_COMMANDS = {
    ProviderKind.GEMINI_CLI: os.getenv("GEMINI_CLI_CMD", "gemini -p {prompt}"),
    ProviderKind.CLAUDE_CLI: os.getenv(
        "CLAUDE_CLI_CMD", "claude --print --output-format text {prompt}"
    ),
    ProviderKind.CODEX_CLI: os.getenv(
        "CODEX_CLI_CMD",
        "codex exec -c model_reasoning_effort=high --skip-git-repo-check --sandbox read-only {prompt}",
    ),
    ProviderKind.ANDROID_CLI: os.getenv("ANDROID_CLI_CMD", "android-cli {prompt}"),
}

CODING_COMMANDS = {
    ProviderKind.CODEX_CLI: os.getenv(
        "CODEX_CLI_CODING_CMD",
        "codex exec -c model_reasoning_effort=high --skip-git-repo-check --sandbox workspace-write {prompt}",
    ),
    ProviderKind.CLAUDE_CLI: os.getenv(
        "CLAUDE_CLI_CODING_CMD",
        "claude --print --output-format text {prompt}",
    ),
    ProviderKind.GEMINI_CLI: os.getenv(
        "GEMINI_CLI_CODING_CMD", "gemini -p {prompt}"
    ),
    ProviderKind.ANDROID_CLI: os.getenv(
        "ANDROID_CLI_CODING_CMD", "android-cli {prompt}"
    ),
}

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/api")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
# Local models have small context windows; cap the prompt and (for Ollama) the
# server-side context. Tune via env. ~4 chars/token is a rough heuristic.
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
OLLAMA_MAX_PROMPT_CHARS = int(os.getenv("OLLAMA_MAX_PROMPT_CHARS", "24000"))
LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "local-model")
LM_STUDIO_MAX_PROMPT_CHARS = int(os.getenv("LM_STUDIO_MAX_PROMPT_CHARS", "24000"))
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.2-chat-latest")
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
ANTHROPIC_VERSION = os.getenv("ANTHROPIC_VERSION", "2023-06-01")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")

class ProviderError(RuntimeError):
    pass


def _clamp_prompt(prompt: str, max_chars: int, *, label: str = "local model") -> str:
    """Trim an over-long prompt by removing the middle, keeping the head
    (system/instructions) and tail (most recent context). Local models have
    small context windows, so this prevents context-overflow errors.
    """
    if max_chars <= 0 or len(prompt) <= max_chars:
        return prompt
    marker = (
        f"\n\n... [プロンプトが長すぎるため中央を省略しました: "
        f"{len(prompt)}→{max_chars} 文字 / {label}] ...\n\n"
    )
    budget = max_chars - len(marker)
    if budget <= 0:
        return prompt[:max_chars]
    head = int(budget * 0.6)
    tail = budget - head
    clamped = prompt[:head] + marker + prompt[-tail:]
    logger.warning(
        "prompt clamped for %s: %d -> %d chars", label, len(prompt), len(clamped)
    )
    return clamped


def _model_item(model_id: str, name: str | None = None) -> dict[str, str]:
    return {"id": model_id, "name": name or model_id}


OPENAI_API_MODELS = [
    _model_item("gpt-5.2-chat-latest", "GPT-5.2 Chat"),
    _model_item("gpt-5.2", "GPT-5.2"),
    _model_item("gpt-5.2-pro", "GPT-5.2 Pro"),
    _model_item("gpt-5.2-codex", "GPT-5.2 Codex"),
    _model_item("gpt-5.1-chat-latest", "GPT-5.1 Chat"),
    _model_item("gpt-5.1", "GPT-5.1"),
    _model_item("gpt-5", "GPT-5"),
    _model_item("gpt-5-mini", "GPT-5 mini"),
    _model_item("gpt-5-nano", "GPT-5 nano"),
    _model_item("gpt-4.1", "GPT-4.1"),
]

ANTHROPIC_API_MODELS = [
    _model_item("claude-sonnet-4-5-20250929", "Claude Sonnet 4.5"),
    _model_item("claude-opus-4-1-20250805", "Claude Opus 4.1"),
    _model_item("claude-sonnet-4-20250514", "Claude Sonnet 4"),
    _model_item("claude-opus-4-20250514", "Claude Opus 4"),
    _model_item("claude-3-7-sonnet-20250219", "Claude Sonnet 3.7"),
    _model_item("claude-3-5-haiku-20241022", "Claude Haiku 3.5"),
]

DEEPSEEK_API_MODELS = [
    _model_item("deepseek-v4-flash", "DeepSeek V4 Flash"),
    _model_item("deepseek-v4-pro", "DeepSeek V4 Pro"),
]


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


def _default_cli_command(provider_kind: ProviderKind, *, coding_mode: bool) -> str | None:
    if provider_kind == ProviderKind.ANDROID_CLI:
        if coding_mode:
            return os.getenv(
                "ANDROID_CLI_CODING_CMD",
                os.getenv("ANDROID_CLI_CMD", "android-cli {prompt}"),
            )
        return os.getenv("ANDROID_CLI_CMD", "android-cli {prompt}")
    if coding_mode:
        return CODING_COMMANDS.get(provider_kind, DEFAULT_COMMANDS.get(provider_kind))
    return DEFAULT_COMMANDS.get(provider_kind)


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

    def _normalize_args(self, args: list[str]) -> list[str]:
        executable = os.path.basename(args[0]) if args else ""
        if executable != "codex" or "--full-auto" not in args:
            return args

        normalized = [arg for arg in args if arg != "--full-auto"]
        if "--sandbox" not in normalized:
            prompt_markers = {"{prompt}", "{query}"}
            insert_at = next(
                (index for index, arg in enumerate(normalized) if arg in prompt_markers),
                len(normalized),
            )
            normalized[insert_at:insert_at] = ["--sandbox", "workspace-write"]
        return normalized

    def _stdin_prompt_arg(self, args: list[str]) -> str | None:
        executable = os.path.basename(args[0]) if args else ""
        if executable == "codex":
            return "-"
        if executable in {"gemini", "claude"}:
            return ""
        return None

    def _is_stdin_capable(self, args: list[str]) -> bool:
        executable = os.path.basename(args[0]) if args else ""
        return executable in _STDIN_CAPABLE

    def _build_args(
        self,
        prompt: str,
        model: str | None,
        mcp_config_path: str | None,
        mcp_servers: list[str] | None,
    ) -> tuple[list[str], bool]:
        args = self._normalize_args(shlex.split(self.command_template))
        servers = mcp_servers or []
        replacements = {
            "{model}": model or "",
            "{mcp_config_path}": mcp_config_path or "",
            "{mcp_servers_csv}": ",".join(servers),
            "{mcp_servers_json}": json.dumps(servers, ensure_ascii=False),
        }
        built: list[str] = []
        stdin_prompt = False
        for token in args:
            if token in {"{prompt}", "{query}"}:
                stdin_prompt = True
                stdin_arg = self._stdin_prompt_arg(args)
                if stdin_arg is not None:
                    built.append(stdin_arg)
                continue

            replaced = token
            for key, value in replacements.items():
                replaced = replaced.replace(key, value)
            replaced = replaced.replace("{prompt}", prompt).replace("{query}", prompt)
            built.append(replaced)

        if all("{prompt}" not in token and "{query}" not in token for token in args):
            # No placeholder in the template. Prefer stdin for any CLI we know
            # supports it (codex/gemini/claude) regardless of length — avoids
            # E2BIG. Otherwise fall back to argv only for short prompts.
            if self._is_stdin_capable(args):
                stdin_prompt = True
                stdin_arg = self._stdin_prompt_arg(args)
                if stdin_arg:
                    built.append(stdin_arg)
            elif len(prompt) > 16_000:
                stdin_prompt = True
            else:
                built.append(prompt)

        return [arg for arg in built if arg or arg == ""], stdin_prompt

    def generate(
        self,
        *,
        prompt: str,
        model: str | None = None,
        cwd: str | None = None,
        mcp_config_path: str | None = None,
        mcp_servers: list[str] | None = None,
    ) -> str:
        args, stdin_prompt = self._build_args(
            prompt=prompt,
            model=model,
            mcp_config_path=mcp_config_path,
            mcp_servers=mcp_servers,
        )

        argv_bytes = sum(len(a.encode("utf-8")) + 1 for a in args)
        prompt_chars = len(prompt)
        head = " ".join(args[:3])
        logger.info(
            "cli.start argv0=%s argv_bytes=%d prompt_chars=%d stdin=%s timeout=%ds",
            args[0] if args else "",
            argv_bytes,
            prompt_chars,
            stdin_prompt,
            self.timeout_sec,
        )
        if not stdin_prompt and argv_bytes > 200_000:
            raise ProviderError(
                f"prompt too large for argv ({argv_bytes} bytes). "
                f"Use a template containing {{prompt}} so the prompt is sent via stdin."
            )

        started = time.monotonic()
        try:
            completed = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=self.timeout_sec,
                check=False,
                cwd=cwd or None,
                input=prompt if stdin_prompt else None,
            )
        except FileNotFoundError as exc:
            logger.warning("cli.not_found argv0=%s", args[0] if args else "")
            raise ProviderError(
                f"command not found: {args[0]} (check CLI install and PATH)"
            ) from exc
        except OSError as exc:
            logger.warning(
                "cli.oserror argv0=%s errno=%s argv_bytes=%d prompt_chars=%d stdin=%s detail=%s",
                args[0] if args else "",
                getattr(exc, "errno", None),
                argv_bytes,
                prompt_chars,
                stdin_prompt,
                exc,
            )
            raise ProviderError(
                f"could not start CLI command ({head}...): {exc}"
            ) from exc
        except subprocess.TimeoutExpired as exc:
            elapsed = time.monotonic() - started
            logger.warning("cli.timeout argv0=%s elapsed=%.1fs", args[0] if args else "", elapsed)
            raise ProviderError(
                f"command timed out after {self.timeout_sec}s: {head}..."
            ) from exc

        elapsed = time.monotonic() - started
        stdout = (completed.stdout or "").strip()
        stderr = (completed.stderr or "").strip()
        logger.info(
            "cli.end argv0=%s rc=%d elapsed=%.1fs stdout_chars=%d stderr_chars=%d",
            args[0] if args else "",
            completed.returncode,
            elapsed,
            len(stdout),
            len(stderr),
        )
        if completed.returncode != 0:
            detail = stderr or stdout or "unknown CLI error"
            raise ProviderError(
                f"CLI exited with code {completed.returncode} ({head}): {detail[:500]}"
            )

        if stdout:
            return stdout
        if stderr:
            return stderr
        raise ProviderError("CLI returned empty output")


def _join_url(base_url: str, path: str) -> str:
    return urllib.parse.urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))


def _post_json(
    url: str,
    payload: dict[str, object],
    *,
    timeout_sec: int,
    headers: dict[str, str] | None = None,
) -> dict[str, object]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
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
    if provider_kind == ProviderKind.OPENAI_API:
        return {
            "provider": provider_kind.value,
            "models": OPENAI_API_MODELS,
            "error": None,
        }

    if provider_kind == ProviderKind.ANTHROPIC_API:
        return {
            "provider": provider_kind.value,
            "models": ANTHROPIC_API_MODELS,
            "error": None,
        }

    if provider_kind == ProviderKind.DEEPSEEK_API:
        return {
            "provider": provider_kind.value,
            "models": DEEPSEEK_API_MODELS,
            "error": None,
        }

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
        ProviderKind.ANDROID_CLI: os.getenv("ANDROID_CLI_MODEL", ""),
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
        prompt = _clamp_prompt(prompt, OLLAMA_MAX_PROMPT_CHARS, label=f"ollama:{selected_model}")
        data = _post_json(
            _join_url(self.base_url, "chat"),
            {
                "model": selected_model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"num_ctx": OLLAMA_NUM_CTX},
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
        prompt = _clamp_prompt(prompt, LM_STUDIO_MAX_PROMPT_CHARS, label=f"lm_studio:{selected_model}")
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


@dataclass
class OpenAIAPIProvider:
    base_url: str = OPENAI_BASE_URL
    default_model: str = OPENAI_MODEL
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
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise ProviderError("openai_api requires OPENAI_API_KEY")
        data = _post_json(
            _join_url(self.base_url, "chat/completions"),
            {
                "model": model or self.default_model,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout_sec=self.timeout_sec,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ProviderError("OpenAI response did not include choices")
        first = choices[0]
        if not isinstance(first, dict):
            raise ProviderError("OpenAI response choice was not an object")
        message = first.get("message")
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return message["content"].strip()
        raise ProviderError("OpenAI response did not include message.content")


@dataclass
class DeepSeekAPIProvider:
    base_url: str = DEEPSEEK_BASE_URL
    default_model: str = DEEPSEEK_MODEL
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
        api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
        if not api_key:
            raise ProviderError("deepseek_api requires DEEPSEEK_API_KEY")
        data = _post_json(
            _join_url(self.base_url, "chat/completions"),
            {
                "model": model or self.default_model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "stream": False,
                "thinking": {"type": "disabled"},
            },
            timeout_sec=self.timeout_sec,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ProviderError("DeepSeek response did not include choices")
        first = choices[0]
        if not isinstance(first, dict):
            raise ProviderError("DeepSeek response choice was not an object")
        message = first.get("message")
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return message["content"].strip()
        raise ProviderError("DeepSeek response did not include message.content")


@dataclass
class AnthropicAPIProvider:
    base_url: str = ANTHROPIC_BASE_URL
    default_model: str = ANTHROPIC_MODEL
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
        api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            raise ProviderError("anthropic_api requires ANTHROPIC_API_KEY")
        data = _post_json(
            _join_url(self.base_url, "messages"),
            {
                "model": model or self.default_model,
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout_sec=self.timeout_sec,
            headers={
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
            },
        )
        content = data.get("content")
        if isinstance(content, list):
            text_parts = [
                item.get("text", "")
                for item in content
                if isinstance(item, dict) and item.get("type") == "text"
            ]
            text = "\n".join(part for part in text_parts if part).strip()
            if text:
                return text
        raise ProviderError("Anthropic response did not include text content")


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

    if provider_kind == ProviderKind.OPENAI_API:
        return OpenAIAPIProvider()

    if provider_kind == ProviderKind.ANTHROPIC_API:
        return AnthropicAPIProvider()

    if provider_kind == ProviderKind.DEEPSEEK_API:
        return DeepSeekAPIProvider()

    if provider_kind == ProviderKind.CUSTOM_CLI:
        if not command_template:
            raise ProviderError("custom_cli requires command_template")
        return CLITemplateProvider(command_template=command_template)

    template = command_template or _default_cli_command(
        provider_kind, coding_mode=coding_mode
    )

    if not template:
        raise ProviderError(f"unsupported provider: {provider_kind}")

    return CLITemplateProvider(command_template=template)
