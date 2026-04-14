from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pydantic import ValidationError

from app.models import RefineRequest
from app.orchestrator import iter_refinement_events, run_refinement


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
                "mode": "writer",
                "provider": "codex_cli",
                "persona": "初稿を作る",
                "skills": ["構成設計"],
                "depends_on": [],
                "command_template": None,
                "model": None,
                "is_custom": False,
            },
            {
                "id": "critic",
                "name": "Critic",
                "mode": "reviewer",
                "provider": "claude_cli",
                "persona": "問題点を洗い出す",
                "skills": ["レビュー"],
                "depends_on": ["drafter"],
                "command_template": None,
                "model": None,
                "is_custom": False,
            },
            {
                "id": "editor",
                "name": "Editor",
                "mode": "editor",
                "provider": "codex_cli",
                "persona": "最終稿へ統合する",
                "skills": ["推敲"],
                "depends_on": ["critic"],
                "command_template": None,
                "model": None,
                "is_custom": False,
            },
        ],
    }
    path = Path(args.path).expanduser()
    _write_json(path, sample)
    print(f"sample config written: {path}")
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

    sample_parser = subparsers.add_parser(
        "sample-config", help="Create a sample request JSON"
    )
    sample_parser.add_argument(
        "--path",
        required=True,
        help="Output path for sample config",
    )
    sample_parser.set_defaults(func=_cmd_sample_config)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
