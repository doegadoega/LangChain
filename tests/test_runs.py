"""Tests for the AgentRun ledger: snapshot builder, store, and read APIs."""

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_store
from app.models import AgentConfig, OrgRole, ProviderKind
from app.runs import AgentRun, RunStatus, snapshot_from_agent
from app.store import FileStore


def _agent(**over) -> AgentConfig:
    base = dict(
        id="impl",
        name="Implementer",
        org_role=OrgRole.WORKER,
        provider=ProviderKind.CODEX_CLI,
        persona="最小diffで実装する",
        skills=["minimal-diff"],
    )
    base.update(over)
    return AgentConfig(**base)


def test_snapshot_defaults_phase_roles_to_org_role():
    snap = snapshot_from_agent(_agent())
    assert snap.phase_roles == ["worker"]
    assert snap.provider == "codex_cli"
    assert snap.prompt_hash is None


def test_snapshot_hashes_system_prompt():
    s1 = snapshot_from_agent(_agent(), system_prompt="You are Implementer")
    s2 = snapshot_from_agent(_agent(), system_prompt="You are Implementer")
    s3 = snapshot_from_agent(_agent(), system_prompt="different")
    assert s1.prompt_hash and s1.prompt_hash.startswith("sha256:")
    assert s1.prompt_hash == s2.prompt_hash
    assert s1.prompt_hash != s3.prompt_hash


def test_snapshot_explicit_phase_roles_and_permissions():
    snap = snapshot_from_agent(
        _agent(),
        phase_roles=["architect", "implementer"],
        permissions={"edit_repository": True},
    )
    assert snap.phase_roles == ["architect", "implementer"]
    assert snap.permissions == {"edit_repository": True}


@pytest.fixture
def client(tmp_path):
    store = FileStore(base_dir=tmp_path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app), store
    app.dependency_overrides.clear()


def _run(run_id, agent_id, workflow_run_id, started_at, status=RunStatus.COMPLETED) -> dict:
    snap = snapshot_from_agent(_agent(id=agent_id, name=agent_id))
    return AgentRun(
        id=run_id,
        task_id="task_1",
        workflow_run_id=workflow_run_id,
        agent_id=agent_id,
        agent_snapshot=snap,
        input_text="in",
        system_prompt="sys",
        output_text="out",
        status=status,
        started_at=started_at,
    ).model_dump()


def test_list_run_agent_runs_filtered_and_ordered(client):
    c, store = client
    store.save_agent_run(_run("ar_2", "qa", "wr_1", "2026-05-30T10:01:00Z"))
    store.save_agent_run(_run("ar_1", "scout", "wr_1", "2026-05-30T10:00:00Z"))
    store.save_agent_run(_run("ar_9", "scout", "wr_other", "2026-05-30T10:00:30Z"))

    resp = c.get("/api/runs/wr_1/agent-runs")
    assert resp.status_code == 200
    runs = resp.json()
    assert [r["id"] for r in runs] == ["ar_1", "ar_2"]  # execution order (oldest first)
    assert all(r["workflow_run_id"] == "wr_1" for r in runs)


def test_list_agent_runs_for_agent_newest_first(client):
    c, store = client
    store.save_agent_run(_run("ar_a", "impl", "wr_1", "2026-05-30T09:00:00Z"))
    store.save_agent_run(_run("ar_b", "impl", "wr_2", "2026-05-30T11:00:00Z"))
    store.save_agent_run(_run("ar_c", "other", "wr_2", "2026-05-30T12:00:00Z"))

    resp = c.get("/api/agents/impl/runs")
    assert resp.status_code == 200
    runs = resp.json()
    assert [r["id"] for r in runs] == ["ar_b", "ar_a"]  # newest first


def test_get_agent_run_roundtrip_and_404(client):
    c, store = client
    store.save_agent_run(_run("ar_x", "impl", "wr_1", "2026-05-30T10:00:00Z"))
    assert c.get("/api/agent-runs/ar_x").json()["agent_id"] == "impl"
    assert c.get("/api/agent-runs/ar_missing").status_code == 404


def test_empty_ledger_returns_empty_lists(client):
    c, _ = client
    assert c.get("/api/runs/wr_1/agent-runs").json() == []
    assert c.get("/api/agents/impl/runs").json() == []
