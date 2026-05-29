"""CLI tests for the `task` and `plan` subcommands."""

from __future__ import annotations

import json

from app import cli
from app.store import FileStore


def _use_tmp_store(monkeypatch, tmp_path):
    """Point the CLI's FileStore() at an isolated tmp directory."""
    monkeypatch.setattr(cli, "FileStore", lambda: FileStore(base_dir=tmp_path))


def test_plan_command_with_description(monkeypatch, capsys):
    monkeypatch.setattr(
        "sys.argv",
        [
            "langchain-agent",
            "plan",
            "--description",
            "ログイン画面のバリデーションを追加したい",
            "--repo",
            "/tmp/app",
        ],
    )
    assert cli.main() == 0
    plan = json.loads(capsys.readouterr().out)
    assert plan["inferred_task_type"] == "feature_development"
    assert plan["selected_workflow_id"] == "feature_development_default"


def test_task_command_persists_and_prints_plan(monkeypatch, tmp_path, capsys):
    _use_tmp_store(monkeypatch, tmp_path)
    monkeypatch.setattr(
        "sys.argv",
        ["langchain-agent", "task", "エラーが出るので修正して", "--repo", "/tmp/app"],
    )
    assert cli.main() == 0
    out = capsys.readouterr().out
    assert "task created:" in out

    saved = FileStore(base_dir=tmp_path).load_tasks()
    assert len(saved) == 1
    assert saved[0]["plan"]["inferred_task_type"] == "bug_fix"
    assert saved[0]["status"] == "planned"


def test_plan_command_with_stored_task_id(monkeypatch, tmp_path, capsys):
    _use_tmp_store(monkeypatch, tmp_path)
    monkeypatch.setattr(
        "sys.argv",
        ["langchain-agent", "task", "ログイン画面を追加したい", "--repo", "/tmp/app"],
    )
    assert cli.main() == 0
    task_id = FileStore(base_dir=tmp_path).load_tasks()[0]["id"]
    capsys.readouterr()  # clear

    monkeypatch.setattr("sys.argv", ["langchain-agent", "plan", task_id])
    assert cli.main() == 0
    plan = json.loads(capsys.readouterr().out)
    assert plan["task_id"] == task_id
    assert plan["selected_workflow_id"] == "feature_development_default"


def test_plan_command_missing_task_returns_error(monkeypatch, tmp_path):
    _use_tmp_store(monkeypatch, tmp_path)
    monkeypatch.setattr("sys.argv", ["langchain-agent", "plan", "task_missing"])
    assert cli.main() == 2


def test_plan_command_without_args_returns_error(monkeypatch):
    monkeypatch.setattr("sys.argv", ["langchain-agent", "plan"])
    assert cli.main() == 2
