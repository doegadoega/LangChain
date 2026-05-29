"""API tests for the Task intake & planning endpoints."""

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


def test_workflow_definitions_listed(client):
    resp = client.get("/api/workflows/definitions")
    assert resp.status_code == 200
    ids = {wf["id"] for wf in resp.json()["workflows"]}
    assert {
        "feature_development_default",
        "bug_fix_default",
        "review_only",
        "design_review_default",
        "refactor_default",
        "documentation_default",
        "release_preparation_default",
    } <= ids


def test_update_task_replans(client):
    created = client.post(
        "/api/tasks",
        json={"description": "このコードをレビューして", "repository_path": "/tmp/app"},
    ).json()
    assert created["plan"]["inferred_task_type"] == "code_review"

    resp = client.put(
        f"/api/tasks/{created['id']}",
        json={"description": "ログイン画面を追加したい", "repository_path": "/tmp/app"},
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["id"] == created["id"]
    assert updated["request"]["description"] == "ログイン画面を追加したい"
    assert updated["plan"]["inferred_task_type"] == "feature_development"


def test_update_missing_task_returns_404(client):
    resp = client.put("/api/tasks/task_missing", json={"description": "x"})
    assert resp.status_code == 404


def test_list_tasks_sorted_by_updated_desc(client):
    a = client.post("/api/tasks", json={"description": "古いタスク"}).json()
    b = client.post("/api/tasks", json={"description": "新しいタスク"}).json()
    # touch a so it becomes most-recently updated
    client.put(f"/api/tasks/{a['id']}", json={"description": "古いタスク改"})
    ids = [t["id"] for t in client.get("/api/tasks").json()]
    assert ids[0] == a["id"]
    assert set(ids) == {a["id"], b["id"]}


def test_plan_endpoint_is_stateless(client):
    resp = client.post(
        "/api/tasks/plan",
        json={
            "description": "ログイン画面のバリデーションを追加したい",
            "repository_path": "/tmp/app",
        },
    )
    assert resp.status_code == 200
    plan = resp.json()
    assert plan["inferred_task_type"] == "feature_development"
    assert plan["selected_workflow_id"] == "feature_development_default"
    assert "implementation" in plan["phases"]
    # stateless: nothing persisted
    assert client.get("/api/tasks").json() == []


def test_plan_rejects_blank_description(client):
    resp = client.post("/api/tasks/plan", json={"description": "   "})
    assert resp.status_code == 422


def test_create_task_persists_with_plan(client):
    resp = client.post(
        "/api/tasks",
        json={"description": "エラーが出るので修正して", "repository_path": "/tmp/app"},
    )
    assert resp.status_code == 201
    task = resp.json()
    assert task["status"] == "planned"
    assert task["plan"]["inferred_task_type"] == "bug_fix"
    assert task["id"].startswith("task_")

    listed = client.get("/api/tasks").json()
    assert len(listed) == 1
    assert listed[0]["id"] == task["id"]


def test_get_task_roundtrip(client):
    created = client.post("/api/tasks", json={"description": "テストを追加したい"}).json()
    resp = client.get(f"/api/tasks/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_missing_task_returns_404(client):
    assert client.get("/api/tasks/task_missing").status_code == 404


def test_replan_updates_plan(client):
    created = client.post(
        "/api/tasks",
        json={"description": "ログイン画面を追加したい", "repository_path": "/tmp/app"},
    ).json()
    resp = client.post(f"/api/tasks/{created['id']}/plan")
    assert resp.status_code == 200
    assert resp.json()["plan"]["selected_workflow_id"] == "feature_development_default"


def test_replan_missing_task_returns_404(client):
    assert client.post("/api/tasks/task_missing/plan").status_code == 404


def test_delete_task(client):
    created = client.post("/api/tasks", json={"description": "削除されるタスク"}).json()
    assert client.delete(f"/api/tasks/{created['id']}").status_code == 204
    assert client.get("/api/tasks").json() == []
