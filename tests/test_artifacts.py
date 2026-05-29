"""Tests for the artifact store: models, contracts/renderers, and read APIs."""

import pytest
from fastapi.testclient import TestClient

from app.artifacts import (
    ArtifactType,
    RequirementsOutput,
    ReviewOutput,
    content_hash,
    make_artifact,
    render_requirements_markdown,
    render_review_markdown,
)
from app.main import app, get_store
from app.store import FileStore


def test_content_hash_is_stable_and_sensitive():
    assert content_hash("abc") == content_hash("abc")
    assert content_hash("abc") != content_hash("abd")
    assert content_hash("abc").startswith("sha256:")


def test_make_artifact_computes_hash_and_id():
    art = make_artifact(
        ArtifactType.PATCH, "diff.patch", "diff --git a b", task_id="task_1"
    )
    assert art.id.startswith("art_")
    assert art.type == ArtifactType.PATCH
    assert art.content_hash == content_hash("diff --git a b")
    assert art.task_id == "task_1"


def test_render_requirements_markdown():
    out = RequirementsOutput(
        summary="ログイン画面にバリデーション追加",
        requirements=[{"id": "REQ-001", "description": "メール空はエラー", "priority": "must"}],
        acceptance_criteria=[
            {"id": "AC-001", "given": "メール空", "when": "送信", "then": "必須エラー"}
        ],
        open_questions=[],
        blocking_issues=[],
    )
    md = render_requirements_markdown(out)
    assert "# 要件 / Requirements" in md
    assert "REQ-001" in md and "must" in md
    assert "AC-001" in md and "Given メール空" in md
    assert "## Open Questions" in md  # empty section still rendered


def test_render_review_markdown_decision_and_suggestions():
    out = ReviewOutput(
        decision="REWORK",
        summary="テスト不足",
        blocking_issues=["テストがない"],
        suggestions=[{"id": "SUG-001", "severity": "minor", "file": "Login.swift", "description": "命名改善"}],
    )
    md = render_review_markdown(out)
    assert "**Decision: REWORK**" in md
    assert "テストがない" in md
    assert "SUG-001" in md and "Login.swift" in md


@pytest.fixture
def client(tmp_path):
    store = FileStore(base_dir=tmp_path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app), store
    app.dependency_overrides.clear()


def _save(store, type_, title, content, **over):
    art = make_artifact(type_, title, content, **over)
    store.save_artifact(art.model_dump())
    return art


def test_list_run_artifacts_in_creation_order(client):
    c, store = client
    a1 = make_artifact(ArtifactType.REQUIREMENTS, "requirements.md", "a", task_id="task_1", workflow_run_id="wr_1")
    a1 = a1.model_copy(update={"created_at": "2026-05-30T10:00:00Z"})
    a2 = make_artifact(ArtifactType.PATCH, "diff.patch", "b", task_id="task_1", workflow_run_id="wr_1")
    a2 = a2.model_copy(update={"created_at": "2026-05-30T10:05:00Z"})
    other = make_artifact(ArtifactType.PATCH, "x", "c", task_id="task_2", workflow_run_id="wr_2")
    store.save_artifact(a1.model_dump()); store.save_artifact(a2.model_dump()); store.save_artifact(other.model_dump())

    runs = c.get("/api/runs/wr_1/artifacts").json()
    ids = [r["id"] for r in runs]
    assert a1.id in ids and a2.id in ids and other.id not in ids
    assert ids.index(a1.id) < ids.index(a2.id)  # creation order


def test_list_task_artifacts(client):
    c, store = client
    _save(store, ArtifactType.CODE_REVIEW, "review.md", "r", task_id="task_9", workflow_run_id="wr_9")
    arts = c.get("/api/tasks/task_9/artifacts").json()
    assert len(arts) == 1
    assert arts[0]["task_id"] == "task_9"


def test_get_artifact_and_404(client):
    c, store = client
    art = _save(store, ArtifactType.PATCH, "diff.patch", "diff", task_id="t")
    got = c.get(f"/api/artifacts/{art.id}").json()
    assert got["id"] == art.id
    assert got["content"] == "diff"
    assert c.get("/api/artifacts/art_missing").status_code == 404


def test_empty_artifact_lists(client):
    c, _ = client
    assert c.get("/api/runs/wr_x/artifacts").json() == []
    assert c.get("/api/tasks/task_x/artifacts").json() == []
