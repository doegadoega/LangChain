from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from app.intake import Task, TaskRequest, TaskRouter, TaskStatus
from app.models import AgentConfig, CodeContext, OrchestrationMode, ProviderKind, RefineRequest, WorkflowMode
from app.orchestrator import iter_refinement_events, run_refinement
from app.store import FileStore


def _read_request(config_path: Path) -> RefineRequest:
    raw = config_path.read_text(encoding="utf-8")
    payload = json.loads(raw)
    return RefineRequest.model_validate(payload)


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _cmd_run(args: argparse.Namespace) -> int:
    config_path = Path(args.config).expanduser()
    if not config_path.exists():
        print(f"[ERROR] config not found: {config_path}", file=sys.stderr)
        return 2

    try:
        request = _read_request(config_path)
    except (json.JSONDecodeError, ValidationError) as exc:
        print(f"[ERROR] invalid config: {exc}", file=sys.stderr)
        return 2

    if args.stream:
        final_result: dict | None = None
        for event in iter_refinement_events(request):
            print(json.dumps(event, ensure_ascii=False))
            if event.get("type") == "run_completed":
                payload = event.get("result")
                if isinstance(payload, dict):
                    final_result = payload
        if args.output and final_result is not None:
            _write_json(Path(args.output).expanduser(), final_result)
        return 0

    result = run_refinement(request).model_dump(mode="json")
    if args.output:
        _write_json(Path(args.output).expanduser(), result)

    if args.pretty:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0


def _cmd_code(args: argparse.Namespace) -> int:
    targets = args.target or []
    agent = AgentConfig(
        id=args.agent_id,
        name=args.agent_name,
        org_role="worker",
        provider=ProviderKind(args.provider),
        persona=(
            "コーディング担当。対象範囲を絞り、必要最小限の変更、確認方法、"
            "リスクを明確にする。"
        ),
        skills=["coding", "minimal-diff"],
        depends_on=[],
        command_template=args.command_template,
        model=args.model,
        mcp_enabled=False,
        mcp_servers=[],
        mcp_instruction="",
        mcp_timeout_sec=60,
        is_custom=True,
    )
    try:
        request = RefineRequest(
            workflow_mode=WorkflowMode.CODING,
            orchestration_mode=OrchestrationMode.SEQUENTIAL,
            source_text=args.request,
            objective=args.objective,
            global_instruction=args.instruction,
            code_context=CodeContext(
                repository="",
                working_directory=str(Path(args.workdir).expanduser()),
                target_paths=targets,
                tech_stack=args.tech_stack,
                acceptance_criteria=args.acceptance_criteria,
                test_command=args.test_command,
            ),
            rounds=args.rounds,
            agents=[agent],
        )
    except (ValueError, ValidationError) as exc:
        print(f"[ERROR] invalid coding request: {exc}", file=sys.stderr)
        return 2

    if args.stream:
        final_result: dict | None = None
        for event in iter_refinement_events(request):
            print(json.dumps(event, ensure_ascii=False))
            if event.get("type") == "run_completed":
                payload = event.get("result")
                if isinstance(payload, dict):
                    final_result = payload
        if args.output and final_result is not None:
            _write_json(Path(args.output).expanduser(), final_result)
        return 0

    result = run_refinement(request).model_dump(mode="json")
    if args.output:
        _write_json(Path(args.output).expanduser(), result)

    if args.pretty:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0


def _cmd_sample_config(args: argparse.Namespace) -> int:
    sample = {
        "workflow_mode": "writing",
        "orchestration_mode": "dependency_graph",
        "source_text": "ここに推敲したいテキストを入力",
        "objective": "目的を入力",
        "global_instruction": "全体ルールを入力",
        "code_context": {
            "repository": "",
            "working_directory": "",
            "target_paths": [],
            "tech_stack": "",
            "acceptance_criteria": "",
            "test_command": "",
        },
        "rounds": 1,
        "agents": [
            {
                "id": "drafter",
                "name": "Drafter",
                "org_role": "worker",
                "provider": "codex_cli",
                "persona": "初稿を作る",
                "skills": ["構成設計"],
                "depends_on": [],
                "command_template": None,
                "model": None,
                "mcp_enabled": False,
                "mcp_config_path": None,
                "mcp_servers": [],
                "mcp_instruction": "",
                "mcp_context_command": None,
                "mcp_timeout_sec": 60,
                "is_custom": False,
            },
            {
                "id": "critic",
                "name": "Critic",
                "org_role": "qa",
                "provider": "claude_cli",
                "persona": "問題点を洗い出す",
                "skills": ["レビュー"],
                "depends_on": ["drafter"],
                "command_template": None,
                "model": None,
                "mcp_enabled": False,
                "mcp_config_path": None,
                "mcp_servers": [],
                "mcp_instruction": "",
                "mcp_context_command": None,
                "mcp_timeout_sec": 60,
                "is_custom": False,
            },
            {
                "id": "editor",
                "name": "Editor",
                "org_role": "manager",
                "provider": "codex_cli",
                "persona": "最終稿へ統合する",
                "skills": ["推敲"],
                "depends_on": ["critic"],
                "command_template": None,
                "model": None,
                "mcp_enabled": False,
                "mcp_config_path": None,
                "mcp_servers": [],
                "mcp_instruction": "",
                "mcp_context_command": None,
                "mcp_timeout_sec": 60,
                "is_custom": False,
            },
        ],
    }
    path = Path(args.path).expanduser()
    _write_json(path, sample)
    print(f"sample config written: {path}")
    return 0


def _build_task_request(args: argparse.Namespace) -> TaskRequest:
    return TaskRequest(
        description=args.description,
        repository_path=getattr(args, "repo", None),
        base_branch=getattr(args, "base_branch", None),
        target_files=getattr(args, "target", None) or [],
        workflow_id=getattr(args, "workflow", None),
    )


def _cmd_task(args: argparse.Namespace) -> int:
    """Create and persist a task, attaching an inferred plan."""
    try:
        request = _build_task_request(args)
    except ValidationError as exc:
        print(f"[ERROR] invalid task: {exc}", file=sys.stderr)
        return 2

    task_id = f"task_{uuid4().hex[:12]}"
    plan = TaskRouter().route(request, task_id=task_id)
    task = Task(id=task_id, request=request, status=TaskStatus.PLANNED, plan=plan)
    FileStore().save_task(task.model_dump())

    print(f"task created: {task_id}")
    print(json.dumps(plan.model_dump(), ensure_ascii=False, indent=2))
    return 0


def _cmd_plan(args: argparse.Namespace) -> int:
    """Plan a stored task by id, or plan a free-form description statelessly."""
    router = TaskRouter()
    if args.task_id:
        record = FileStore().load_task(args.task_id)
        if record is None:
            print(f"[ERROR] task not found: {args.task_id}", file=sys.stderr)
            return 2
        task = Task.model_validate(record)
        plan = router.route(task.request, task_id=task.id)
    elif args.description:
        try:
            request = _build_task_request(args)
        except ValidationError as exc:
            print(f"[ERROR] invalid task: {exc}", file=sys.stderr)
            return 2
        plan = router.route(request, task_id=f"plan_{uuid4().hex[:12]}")
    else:
        print("[ERROR] provide a task_id or --description", file=sys.stderr)
        return 2

    print(json.dumps(plan.model_dump(), ensure_ascii=False, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="langchain-agent",
        description="Run Agent Refinement Platform flows from CLI",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="Run with request JSON")
    run_parser.add_argument(
        "--config",
        required=True,
        help="Path to RefineRequest JSON",
    )
    run_parser.add_argument(
        "--stream",
        action="store_true",
        help="Print streaming events as JSONL",
    )
    run_parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print final JSON response",
    )
    run_parser.add_argument(
        "--output",
        help="Write final result JSON to file",
    )
    run_parser.set_defaults(func=_cmd_run)

    code_parser = subparsers.add_parser(
        "code", help="Run a minimal coding workflow from CLI flags"
    )
    code_parser.add_argument(
        "--workdir",
        required=True,
        help="Repository or working directory for the coding run",
    )
    code_parser.add_argument(
        "--request",
        required=True,
        help="Coding request text",
    )
    code_parser.add_argument(
        "--target",
        action="append",
        help="Target file or path. Repeat for multiple paths.",
    )
    code_parser.add_argument(
        "--test-command",
        default="",
        help="Command the coding agent should use for verification",
    )
    code_parser.add_argument(
        "--tech-stack",
        default="",
        help="Short tech stack note",
    )
    code_parser.add_argument(
        "--acceptance-criteria",
        default="",
        help="Completion criteria for the coding run",
    )
    code_parser.add_argument(
        "--objective",
        default="コードの問題を調査して、必要最小限の修正案または変更を出す。",
        help="Objective passed to the coding workflow",
    )
    code_parser.add_argument(
        "--instruction",
        default="対象範囲外のリファクタは避け、変更理由と確認方法を簡潔に示す。",
        help="Global instruction passed to the coding workflow",
    )
    code_parser.add_argument(
        "--provider",
        default="codex_cli",
        choices=[provider.value for provider in ProviderKind],
        help="Provider used by the coding agent",
    )
    code_parser.add_argument("--model", help="Optional provider model")
    code_parser.add_argument(
        "--command-template",
        help="Custom CLI command template. Required when provider is custom_cli.",
    )
    code_parser.add_argument("--agent-id", default="cli_coder")
    code_parser.add_argument("--agent-name", default="CLI Coder")
    code_parser.add_argument("--rounds", type=int, default=1)
    code_parser.add_argument(
        "--stream",
        action="store_true",
        help="Print streaming events as JSONL",
    )
    code_parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print final JSON response",
    )
    code_parser.add_argument(
        "--output",
        help="Write final result JSON to file",
    )
    code_parser.set_defaults(func=_cmd_code)

    sample_parser = subparsers.add_parser(
        "sample-config", help="Create a sample request JSON"
    )
    sample_parser.add_argument(
        "--path",
        required=True,
        help="Output path for sample config",
    )
    sample_parser.set_defaults(func=_cmd_sample_config)

    task_parser = subparsers.add_parser(
        "task", help="Submit a task; the system infers workflow/roles/artifacts"
    )
    task_parser.add_argument("description", help="What you want done, in plain language")
    task_parser.add_argument("--repo", help="Repository path the task operates on")
    task_parser.add_argument("--base-branch", dest="base_branch", help="Base git branch")
    task_parser.add_argument(
        "--target", action="append", help="Target file/path. Repeat for multiple."
    )
    task_parser.add_argument(
        "--workflow", help="Force a specific workflow template id (skips inference)"
    )
    task_parser.set_defaults(func=_cmd_task)

    plan_parser = subparsers.add_parser(
        "plan", help="Show the inferred plan for a stored task or a description"
    )
    plan_parser.add_argument(
        "task_id", nargs="?", help="Stored task id to (re)plan"
    )
    plan_parser.add_argument(
        "--description", help="Plan a free-form description without saving a task"
    )
    plan_parser.add_argument("--repo", help="Repository path (with --description)")
    plan_parser.add_argument("--base-branch", dest="base_branch", help="Base git branch")
    plan_parser.add_argument("--target", action="append", help="Target file/path")
    plan_parser.add_argument("--workflow", help="Force a specific workflow template id")
    plan_parser.set_defaults(func=_cmd_plan)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
