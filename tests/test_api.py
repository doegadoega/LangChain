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
