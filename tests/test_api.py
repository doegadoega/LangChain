import pytest
import subprocess
from fastapi.testclient import TestClient
from app.main import app, get_store
from app.store import FileStore


@pytest.fixture
def client(tmp_path):
    store = FileStore(base_dir=tmp_path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_list_agents_empty(client):
    resp = client.get("/api/agents")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_and_get_agent(client):
    agent = {"id": "worker-1", "name": "Worker", "org_roles": ["worker"]}
    resp = client.post("/api/agents", json=agent)
    assert resp.status_code == 201
    resp = client.get("/api/agents")
    assert len(resp.json()) == 1
    assert resp.json()[0]["id"] == "worker-1"


def test_delete_agent(client):
    agent = {"id": "del-me", "name": "Delete"}
    client.post("/api/agents", json=agent)
    resp = client.delete("/api/agents/del-me")
    assert resp.status_code == 204
    assert client.get("/api/agents").json() == []


def test_list_projects_empty(client):
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_project(client):
    project = {"id": "proj-1", "name": "Test", "working_directory": "/tmp", "status": "active"}
    resp = client.post("/api/projects", json=project)
    assert resp.status_code == 201


def _git(repo: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", repo, *args],
        check=True,
        capture_output=True,
        text=True,
        env={
            "GIT_AUTHOR_NAME": "Test User",
            "GIT_AUTHOR_EMAIL": "test@example.com",
            "GIT_COMMITTER_NAME": "Test User",
            "GIT_COMMITTER_EMAIL": "test@example.com",
        },
    )


def test_git_status_reports_user_changes(client, tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(str(repo), "init")
    (repo / "Todo.swift").write_text("struct Todo {}\n", encoding="utf-8")
    _git(str(repo), "add", "Todo.swift")
    _git(str(repo), "commit", "-m", "initial")
    (repo / "Todo.swift").write_text("struct Todo { let title: String }\n", encoding="utf-8")

    resp = client.get("/api/git/status", params={"path": str(repo)})

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["repo_root"] == str(repo)
    assert payload["dirty"] is True
    assert payload["changed_files"] == ["Todo.swift"]
    assert payload["untracked_files"] == []
    assert payload["base_commit"]


def test_prepare_coding_worktree_applies_user_dirty_patch(client, tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(str(repo), "init")
    (repo / "Todo.swift").write_text("struct Todo {}\n", encoding="utf-8")
    _git(str(repo), "add", "Todo.swift")
    _git(str(repo), "commit", "-m", "initial")
    (repo / "Todo.swift").write_text("struct Todo { let title: String }\n", encoding="utf-8")

    resp = client.post(
        "/api/git/worktrees/prepare",
        json={"request_id": "coding-1", "working_directory": str(repo)},
    )

    assert resp.status_code == 201
    payload = resp.json()
    assert payload["repo_root"] == str(repo)
    assert payload["ai_branch"] == "ai/coding-1"
    assert payload["user_dirty"] is True
    assert payload["user_patch_applied"] is True
    assert payload["user_changed_files"] == ["Todo.swift"]
    worktree_path = payload["worktree_path"]
    assert (tmp_path / "worktrees" / "coding-1").exists()
    assert "let title" in (tmp_path / "worktrees" / "coding-1" / "Todo.swift").read_text(
        encoding="utf-8"
    )
    assert "let title" in (repo / "Todo.swift").read_text(encoding="utf-8")
    branch = _git(worktree_path, "branch", "--show-current").stdout.strip()
    assert branch == "ai/coding-1"


def test_list_source_tree_and_read_file(client, tmp_path):
    source_dir = tmp_path / "repo"
    source_dir.mkdir()
    (source_dir / "Todo.swift").write_text("struct Todo {}\n", encoding="utf-8")
    (source_dir / "node_modules").mkdir()
    (source_dir / "node_modules" / "ignored.js").write_text("x", encoding="utf-8")

    tree_resp = client.get("/api/files/tree", params={"path": str(source_dir)})

    assert tree_resp.status_code == 200
    payload = tree_resp.json()
    assert payload["path"] == str(source_dir)
    assert [item["name"] for item in payload["children"]] == ["Todo.swift"]

    read_resp = client.get("/api/files/read", params={"path": str(source_dir / "Todo.swift")})

    assert read_resp.status_code == 200
    assert read_resp.json()["content"] == "struct Todo {}\n"


def test_create_team_template_preserves_agents_and_run_settings(client):
    template = {
        "id": "team-local-llm",
        "name": "Local LLM Team",
        "description": "Reusable team from the Teams screen",
        "workflow_mode": "coding",
        "orchestration_mode": "dependency_graph",
        "rounds": 2,
        "agents": [
            {
                "id": "mako",
                "name": "まこ",
                "org_role": "other",
                "provider": "lm_studio",
                "model": "qwen2.5-coder-3b-instruct",
                "persona": "短く明確に答える。",
                "depends_on": [],
                "enabled": True,
                "mcp_enabled": False,
                "mcp_servers": [],
                "mcp_instruction": "",
                "mcp_timeout_sec": 60,
                "is_custom": True,
            }
        ],
    }

    resp = client.post("/api/templates", json=template)

    assert resp.status_code == 201
    listed = client.get("/api/templates").json()
    assert listed[0]["id"] == "team-local-llm"
    assert listed[0]["workflow_mode"] == "coding"
    assert listed[0]["orchestration_mode"] == "dependency_graph"
    assert listed[0]["rounds"] == 2
    assert listed[0]["agents"][0]["id"] == "mako"


def test_list_provider_models_returns_models(client, monkeypatch):
    def fake_list_provider_models(provider):
        assert provider == "lm_studio"
        return {
            "provider": "lm_studio",
            "models": [
                {"id": "qwen2.5-coder-3b-instruct", "name": "Qwen2.5 Coder 3B"}
            ],
            "error": None,
        }

    monkeypatch.setattr("app.main.list_provider_models", fake_list_provider_models)

    resp = client.get("/api/providers/lm_studio/models")

    assert resp.status_code == 200
    assert resp.json()["models"][0]["id"] == "qwen2.5-coder-3b-instruct"


def test_list_provider_models_rejects_unknown_provider(client):
    resp = client.get("/api/providers/not-a-provider/models")

    assert resp.status_code == 400


def test_list_chatgpt_and_claude_api_provider_models(client):
    openai_resp = client.get("/api/providers/openai_api/models")
    anthropic_resp = client.get("/api/providers/anthropic_api/models")

    assert openai_resp.status_code == 200
    assert anthropic_resp.status_code == 200
    assert any(
        model["id"] == "gpt-5.2-chat-latest"
        for model in openai_resp.json()["models"]
    )
    assert any(
        model["id"] == "claude-sonnet-4-5-20250929"
        for model in anthropic_resp.json()["models"]
    )


def test_list_deepseek_api_provider_models(client):
    resp = client.get("/api/providers/deepseek_api/models")

    assert resp.status_code == 200
    assert any(model["id"] == "deepseek-v4-flash" for model in resp.json()["models"])


def test_chat_message_preserves_image_attachment_without_prompting_raw_data(client, monkeypatch):
    captured: dict[str, object] = {}

    class FakeProvider:
        def generate(self, **kwargs):
            captured.update(kwargs)
            return "画像を受け取りました。"

    monkeypatch.setattr("app.main.resolve_provider", lambda **kwargs: FakeProvider())

    agent = {
        "id": "ceo",
        "name": "CEO",
        "org_role": "ceo",
        "provider": "openai_api",
        "persona": "",
        "skills": [],
        "depends_on": [],
        "allow_web_search": False,
        "research_sources": [],
        "require_citations": True,
        "max_search_results": 5,
        "mcp_enabled": False,
        "mcp_servers": [],
        "mcp_instruction": "",
        "mcp_timeout_sec": 60,
        "is_custom": True,
    }
    image_data = "data:image/png;base64," + ("a" * 200)

    resp = client.post(
        "/api/chats/message",
        json={
            "session_id": "chat_ceo",
            "agent": agent,
            "question": "この画像を見て",
            "web_search_enabled": False,
            "attachments": [
                {
                    "kind": "image",
                    "title": "screenshot.png",
                    "content": image_data,
                    "content_type": "image/png",
                }
            ],
        },
    )

    assert resp.status_code == 200
    user_message = resp.json()["messages"][0]
    assert user_message["attachments"][0]["kind"] == "image"
    assert user_message["attachments"][0]["content"] == image_data
    assert image_data not in captured["prompt"]
    assert "画像添付" in captured["prompt"]


def test_create_and_list_knowledge_resources(client):
    resource = {
        "id": "swift-guidelines",
        "title": "Swift Guidelines",
        "kind": "markdown",
        "content": "# Swift\nUse SwiftUI.",
        "source": "local-md",
        "tags": ["swift", "ios"],
    }

    create_resp = client.post("/api/knowledge", json=resource)
    list_resp = client.get("/api/knowledge")

    assert create_resp.status_code == 201
    assert list_resp.status_code == 200
    assert list_resp.json()[0]["id"] == "swift-guidelines"
    assert list_resp.json()[0]["kind"] == "markdown"


def test_import_local_markdown_as_knowledge(client, tmp_path):
    doc = tmp_path / "guideline.md"
    doc.write_text("# Internal Guide\nKeep changes small.", encoding="utf-8")

    resp = client.post(
        "/api/knowledge/import-local",
        json={"path": str(doc), "tags": ["guide"]},
    )

    assert resp.status_code == 201
    payload = resp.json()
    assert payload["title"] == "guideline.md"
    assert payload["kind"] == "markdown"
    assert "Keep changes small." in payload["content"]
