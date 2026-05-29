"""Tests for the workflow runner and execute APIs (Sprint 4)."""

import pytest
from fastapi.testclient import TestClient

from app.intake import Task, TaskRequest, TaskRouter
from app.main import app, get_store
from app.models import RefineResponse, RoundResult, TurnResult
from app.orchestration import RunOptions, WorkflowRunner
from app.orchestration import runner as runner_mod
from app.orchestration.matcher import match_agents
from app.store import FileStore


def _fake_refine(request):
    """Return one turn per requested agent + a phase final_text."""
    turns = [
        TurnResult(
            agent_id=a.id,
            agent_name=a.name,
            org_role=a.org_role,
            provider=a.provider,
            output=f"{a.id} contribution",
        )
        for a in request.agents
    ]
    return RefineResponse(
        final_text=f"# result for {request.objective}\nbody",
        rounds=[RoundResult(round_index=0, turns=turns, draft_after_round="d")],
        diff="",
        file_changes="",
    )


def _fake_command(command, cwd):
    return 0, f"ran {command} in {cwd}"


def _planned_task(description="エラーが出るので修正して", repo="/tmp/app") -> Task:
    req = TaskRequest(description=description, repository_path=repo)
    plan = TaskRouter().route(req, task_id="task_t")
    return Task(id="task_t", request=req, plan=plan)


def test_matcher_synthesizes_agents_for_roles():
    agents = match_agents(["architect", "implementer", "architect"], provider="lm_studio")
    assert [a.id for a in agents] == ["architect", "implementer"]  # deduped, ordered
    assert all(a.provider.value == "lm_studio" for a in agents)


def test_runner_executes_all_phases_and_records(tmp_path):
    store = FileStore(base_dir=tmp_path)
    task = _planned_task()  # bug_fix_default → 6 phases
    runner = WorkflowRunner(store, run_refinement=_fake_refine, run_command=_fake_command)

    run = runner.run(task, RunOptions(provider="lm_studio", test_command="pytest -q"))

    assert run.status.value == "completed"
    assert len(run.phases) == 6
    assert all(p.status.value == "completed" for p in run.phases)
    # agent runs recorded for non-command phases
    assert len(store.load_agent_runs()) > 0
    # an artifact per phase (5 agent phases + 1 command phase)
    assert len(store.load_artifacts()) == 6
    # the verification phase ran the test command
    reports = [a for a in store.load_artifacts() if a["type"] == "test_report"]
    assert reports and "pytest -q" in reports[0]["content"]
    # workflow run persisted
    assert store.load_workflow_run(run.id) is not None


def test_runner_requires_a_plan(tmp_path):
    store = FileStore(base_dir=tmp_path)
    task = Task(id="task_x", request=TaskRequest(description="x"))
    with pytest.raises(ValueError):
        WorkflowRunner(store, run_refinement=_fake_refine).run(task)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(runner_mod, "_default_run_refinement", _fake_refine)
    monkeypatch.setattr(runner_mod, "_default_run_command", _fake_command)
    store = FileStore(base_dir=tmp_path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_run_task_endpoint_end_to_end(client):
    created = client.post(
        "/api/tasks",
        json={"description": "ログイン画面のバリデーションを追加したい", "repository_path": "/tmp/app"},
    ).json()
    task_id = created["id"]

    resp = client.post(f"/api/tasks/{task_id}/run", json={"provider": "lm_studio"})
    assert resp.status_code == 200
    run = resp.json()
    assert run["status"] == "completed"
    run_id = run["id"]

    # run detail
    assert client.get(f"/api/runs/{run_id}").json()["id"] == run_id
    # ledger + artifacts now have data via the Sprint 2/3 read APIs
    assert len(client.get(f"/api/runs/{run_id}/agent-runs").json()) > 0
    assert len(client.get(f"/api/runs/{run_id}/artifacts").json()) > 0
    assert len(client.get(f"/api/tasks/{task_id}/artifacts").json()) > 0
    # run appears in the list
    assert run_id in [r["id"] for r in client.get("/api/runs").json()]
    # task marked completed
    assert client.get(f"/api/tasks/{task_id}").json()["status"] == "completed"


def test_run_missing_task_returns_404(client):
    assert client.post("/api/tasks/task_missing/run").status_code == 404


def test_run_task_cli(tmp_path, monkeypatch, capsys):
    from app import cli

    monkeypatch.setattr(runner_mod, "_default_run_refinement", _fake_refine)
    monkeypatch.setattr(runner_mod, "_default_run_command", _fake_command)
    store = FileStore(base_dir=tmp_path)
    monkeypatch.setattr(cli, "FileStore", lambda: store)

    task = _planned_task()
    store.save_task(task.model_dump())

    monkeypatch.setattr("sys.argv", ["agent-os", "run-task", task.id, "--provider", "lm_studio"])
    assert cli.main() == 0
    out = capsys.readouterr().out
    assert "completed" in out
    assert len(store.load_workflow_runs()) == 1
