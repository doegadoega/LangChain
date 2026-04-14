from __future__ import annotations

import os
import shlex
import subprocess
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


class ProviderError(RuntimeError):
    pass


class TextProvider(Protocol):
    def generate(
        self, *, prompt: str, model: str | None = None, cwd: str | None = None
    ) -> str: ...


@dataclass
class CLITemplateProvider:
    command_template: str
    timeout_sec: int = 300

    def _build_args(self, prompt: str, model: str | None) -> list[str]:
        args = shlex.split(self.command_template)
        built: list[str] = []
        for token in args:
            replaced = token.replace("{prompt}", prompt)
            replaced = replaced.replace("{model}", model or "")
            built.append(replaced)

        if all("{prompt}" not in token for token in args):
            built.append(prompt)

        return [arg for arg in built if arg]

    def generate(
        self, *, prompt: str, model: str | None = None, cwd: str | None = None
    ) -> str:
        args = self._build_args(prompt=prompt, model=model)
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


def resolve_provider(
    *,
    provider_kind: ProviderKind,
    command_template: str | None,
    coding_mode: bool = False,
) -> TextProvider:
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
