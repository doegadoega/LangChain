from __future__ import annotations

import json
from pathlib import Path

from app import cli
from app.models import RefineRequest, WorkflowMode


def test_code_command_builds_coding_request_and_writes_result(
    monkeypatch, tmp_path, capsys
):
    captured: list[RefineRequest] = []

    class DummyResult:
        def model_dump(self, mode: str = "json"):
            return {
                "final_text": "coding result",
                "diff": "diff --git a/Todo.swift b/Todo.swift",
                "file_changes": "diff --git a/Todo.swift b/Todo.swift",
                "rounds": [],
            }

    def fake_run_refinement(request: RefineRequest):
        captured.append(request)
        return DummyResult()

    output_path = tmp_path / "result.json"
    workdir = tmp_path / "repo"
    monkeypatch.setattr(cli, "run_refinement", fake_run_refinement)
    monkeypatch.setattr(
        "sys.argv",
        [
            "langchain-agent",
            "code",
            "--workdir",
            str(workdir),
            "--request",
            "SwiftでTODOリストを作る",
            "--target",
            "Todo.swift",
            "--test-command",
            "swift test",
            "--provider",
            "custom_cli",
            "--command-template",
            "echo {prompt}",
            "--output",
            str(output_path),
        ],
    )

    assert cli.main() == 0

    assert len(captured) == 1
    request = captured[0]
    assert request.workflow_mode == WorkflowMode.CODING
    assert request.code_context.working_directory == str(workdir)
    assert request.code_context.target_paths == ["Todo.swift"]
    assert request.code_context.test_command == "swift test"
    assert request.source_text == "SwiftでTODOリストを作る"
    assert request.agents[0].provider.value == "custom_cli"
    assert request.agents[0].command_template == "echo {prompt}"
    assert json.loads(output_path.read_text(encoding="utf-8"))["final_text"] == "coding result"
    assert "coding result" in capsys.readouterr().out


def test_code_command_streams_events_and_writes_final_result(
    monkeypatch, tmp_path, capsys
):
    def fake_iter_refinement_events(request: RefineRequest):
        assert request.workflow_mode == WorkflowMode.CODING
        yield {"type": "run_started", "workflow_mode": "coding"}
        yield {
            "type": "run_completed",
            "result": {
                "final_text": "streamed result",
                "diff": "",
                "file_changes": "",
                "rounds": [],
            },
        }

    output_path = tmp_path / "stream-result.json"
    monkeypatch.setattr(cli, "iter_refinement_events", fake_iter_refinement_events)
    monkeypatch.setattr(
        "sys.argv",
        [
            "langchain-agent",
            "code",
            "--workdir",
            str(tmp_path / "repo"),
            "--request",
            "READMEを直す",
            "--provider",
            "lm_studio",
            "--stream",
            "--output",
            str(output_path),
        ],
    )

    assert cli.main() == 0

    lines = capsys.readouterr().out.strip().splitlines()
    assert json.loads(lines[0])["type"] == "run_started"
    assert json.loads(lines[1])["result"]["final_text"] == "streamed result"
    assert json.loads(output_path.read_text(encoding="utf-8"))["final_text"] == "streamed result"
