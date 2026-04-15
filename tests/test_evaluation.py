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


def test_submit_evaluation(client):
    project = {
        "id": "proj-1",
        "name": "Test",
        "working_directory": "/tmp",
        "status": "active",
        "agent_snapshots": [
            {
                "id": "snap-1",
                "master_agent_id": "worker-1",
                "config": {"id": "worker-1", "name": "Worker"},
                "project_id": "proj-1",
                "evaluations": [],
            }
        ],
    }
    client.post("/api/projects", json=project)

    eval_data = {
        "project_id": "proj-1",
        "snapshot_id": "snap-1",
        "evaluator_role": "ceo",
        "score": 8,
        "comment": "Good work",
        "is_final": False,
    }
    resp = client.post("/api/evaluations", json=eval_data)
    assert resp.status_code == 201

    projects = client.get("/api/projects").json()
    snapshot = projects[0]["agent_snapshots"][0]
    assert len(snapshot["evaluations"]) == 1
    assert snapshot["evaluations"][0]["score"] == 8


def test_evaluation_score_clamped(client):
    project = {
        "id": "proj-2",
        "name": "Test2",
        "working_directory": "/tmp",
        "status": "active",
        "agent_snapshots": [
            {"id": "snap-2", "master_agent_id": "w", "config": {}, "project_id": "proj-2", "evaluations": []}
        ],
    }
    client.post("/api/projects", json=project)

    resp = client.post("/api/evaluations", json={
        "project_id": "proj-2", "snapshot_id": "snap-2",
        "evaluator_role": "manager", "score": 15, "is_final": True,
    })
    assert resp.status_code == 201

    projects = client.get("/api/projects").json()
    assert projects[0]["agent_snapshots"][0]["evaluations"][0]["score"] == 10


def test_get_agent_evaluations(client):
    project = {
        "id": "proj-3", "name": "T", "working_directory": "/tmp", "status": "active",
        "agent_snapshots": [
            {"id": "snap-3", "master_agent_id": "a1", "config": {}, "project_id": "proj-3",
             "evaluations": [{"evaluator_role": "ceo", "score": 9, "is_final": True}]}
        ],
    }
    client.post("/api/projects", json=project)

    resp = client.get("/api/agents/a1/evaluations")
    assert resp.status_code == 200
    evals = resp.json()
    assert len(evals) == 1
    assert evals[0]["score"] == 9
