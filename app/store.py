"""JSON file persistence for agents, projects, templates, and workflows."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class FileStore:
    """Simple JSON-file-per-record persistence."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self._base = base_dir or Path.home() / ".agent-refinement"

    @property
    def base_dir(self) -> Path:
        return self._base

    @property
    def worktrees_dir(self) -> Path:
        return self._base / "worktrees"

    @property
    def _agents_dir(self) -> Path:
        return self._base / "agents"

    @property
    def _projects_dir(self) -> Path:
        return self._base / "projects"

    @property
    def _requests_dir(self) -> Path:
        return self._base / "requests"

    @property
    def _chats_dir(self) -> Path:
        return self._base / "chats"

    @property
    def _templates_dir(self) -> Path:
        return self._base / "templates"

    @property
    def _workflows_dir(self) -> Path:
        return self._base / "workflows"

    @property
    def _knowledge_dir(self) -> Path:
        return self._base / "knowledge"

    @property
    def _tasks_dir(self) -> Path:
        return self._base / "tasks"

    def save_agent(self, data: dict[str, Any]) -> None:
        self._save(self._agents_dir, data["id"], data)

    def load_agents(self) -> list[dict[str, Any]]:
        return self._load_all(self._agents_dir)

    def load_agent(self, agent_id: str) -> dict[str, Any] | None:
        return self._load_one(self._agents_dir, agent_id)

    def delete_agent(self, agent_id: str) -> None:
        self._delete(self._agents_dir, agent_id)

    def save_project(self, data: dict[str, Any]) -> None:
        self._save(self._projects_dir, data["id"], data)

    def load_projects(self) -> list[dict[str, Any]]:
        return self._load_all(self._projects_dir)

    def delete_project(self, project_id: str) -> None:
        self._delete(self._projects_dir, project_id)

    def save_request(self, data: dict[str, Any]) -> None:
        self._save(self._requests_dir, data["id"], data)

    def load_requests(self) -> list[dict[str, Any]]:
        return self._load_all(self._requests_dir)

    def load_request(self, request_id: str) -> dict[str, Any] | None:
        return self._load_one(self._requests_dir, request_id)

    def delete_request(self, request_id: str) -> None:
        self._delete(self._requests_dir, request_id)

    def save_chat(self, data: dict[str, Any]) -> None:
        self._save(self._chats_dir, data["id"], data)

    def load_chats(self) -> list[dict[str, Any]]:
        return self._load_all(self._chats_dir)

    def load_chat(self, chat_id: str) -> dict[str, Any] | None:
        return self._load_one(self._chats_dir, chat_id)

    def delete_chat(self, chat_id: str) -> None:
        self._delete(self._chats_dir, chat_id)

    def save_template(self, data: dict[str, Any]) -> None:
        self._save(self._templates_dir, data["id"], data)

    def load_templates(self) -> list[dict[str, Any]]:
        return self._load_all(self._templates_dir)

    def delete_template(self, template_id: str) -> None:
        self._delete(self._templates_dir, template_id)

    def save_workflow(self, data: dict[str, Any]) -> None:
        self._save(self._workflows_dir, data["id"], data)

    def load_workflows(self) -> list[dict[str, Any]]:
        return self._load_all(self._workflows_dir)

    def delete_workflow(self, workflow_id: str) -> None:
        self._delete(self._workflows_dir, workflow_id)

    def save_knowledge(self, data: dict[str, Any]) -> None:
        self._save(self._knowledge_dir, data["id"], data)

    def load_knowledge(self) -> list[dict[str, Any]]:
        return self._load_all(self._knowledge_dir)

    def load_knowledge_item(self, knowledge_id: str) -> dict[str, Any] | None:
        return self._load_one(self._knowledge_dir, knowledge_id)

    def delete_knowledge(self, knowledge_id: str) -> None:
        self._delete(self._knowledge_dir, knowledge_id)

    def save_task(self, data: dict[str, Any]) -> None:
        self._save(self._tasks_dir, data["id"], data)

    def load_tasks(self) -> list[dict[str, Any]]:
        return self._load_all(self._tasks_dir)

    def load_task(self, task_id: str) -> dict[str, Any] | None:
        return self._load_one(self._tasks_dir, task_id)

    def delete_task(self, task_id: str) -> None:
        self._delete(self._tasks_dir, task_id)

    def _save(self, directory: Path, record_id: str, data: dict[str, Any]) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{record_id}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_all(self, directory: Path) -> list[dict[str, Any]]:
        if not directory.exists():
            return []
        results: list[dict[str, Any]] = []
        for path in sorted(directory.glob("*.json")):
            raw = path.read_text(encoding="utf-8")
            results.append(json.loads(raw))
        return results

    def _load_one(self, directory: Path, record_id: str) -> dict[str, Any] | None:
        path = directory / f"{record_id}.json"
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def _delete(self, directory: Path, record_id: str) -> None:
        path = directory / f"{record_id}.json"
        if path.exists():
            path.unlink()
