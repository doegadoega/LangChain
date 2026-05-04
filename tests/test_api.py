import pytest
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
