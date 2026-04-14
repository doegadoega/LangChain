from __future__ import annotations

import pathlib
import subprocess as _sp
from collections import defaultdict
from dataclasses import dataclass
from difflib import unified_diff
from typing import Iterator

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent

from app.models import (
    AgentConfig,
    AgentMode,
    OrchestrationMode,
    RefineRequest,
    RefineResponse,
    RoundResult,
    TurnResult,
    WorkflowMode,
)
from app.providers import ProviderError, resolve_provider


@dataclass
class RunContext:
    request: RefineRequest
    draft: str


def _capture_git_diff(working_directory: str) -> str:
    """Return combined staged + unstaged + untracked diff relative to HEAD."""
    try:
        _sp.run(
            ["git", "add", "-A"],
            cwd=working_directory,
            capture_output=True,
            timeout=30,
            check=False,
        )
        result = _sp.run(
            ["git", "diff", "--staged", "HEAD"],
            cwd=working_directory,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        return (result.stdout or "").strip()
    except Exception:
        return ""


def _is_git_repo(path: str) -> bool:
    try:
        result = _sp.run(
            ["git", "rev-parse", "--git-dir"],
            cwd=path,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        return result.returncode == 0
    except Exception:
        return False


def _build_system_directive(agent: AgentConfig) -> str:
    persona_block = agent.persona.strip() or "なし"
    skills_block = "\n".join(f"- {skill}" for skill in agent.skills) or "- なし"
    return (
        f"あなたは {agent.name} です。\n"
        f"役割: {agent.mode.value}\n"
        f"ペルソナ:\n{persona_block}\n\n"
        f"活用するスキル:\n{skills_block}\n"
    )


def _build_code_context_block(context: RunContext) -> str:
    code = context.request.code_context
    target_paths = "\n".join(f"- {path}" for path in code.target_paths) or "- 未指定"
    return (
        "コーディングコンテキスト:\n"
        f"- リポジトリ: {code.repository or '未指定'}\n"
        f"- 作業ディレクトリ: {code.working_directory or '未指定'}\n"
        f"- 対象パス:\n{target_paths}\n"
        f"- 技術スタック:\n{code.tech_stack or '未指定'}\n"
        f"- 受け入れ条件:\n{code.acceptance_criteria or '未指定'}\n"
        f"- テストコマンド: {code.test_command or '未指定'}\n"
    )


def _truncate_output(text: str, max_chars: int = 2800) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...(truncated)"


def _build_dependency_context_block(
    agent: AgentConfig, round_outputs: dict[str, str]
) -> str:
    if not agent.depends_on:
        return "依存エージェント出力: なし\n"

    lines = ["依存エージェント出力:"]
    for dep in agent.depends_on:
        output = round_outputs.get(dep, "")
        if not output:
            lines.append(f"- {dep}: (未実行または出力なし)")
            continue
        lines.append(f"- {dep}:\n```text\n{_truncate_output(output)}\n```")
    return "\n".join(lines) + "\n"


def _build_task_prompt(
    *,
    agent: AgentConfig,
    context: RunContext,
    round_index: int,
    review_notes: list[str],
    round_outputs: dict[str, str],
    has_working_dir: bool = False,
) -> str:
    objective = context.request.objective.strip() or "特になし"
    global_instruction = context.request.global_instruction.strip() or "特になし"
    notes = "\n\n".join(review_notes) if review_notes else "なし"
    workflow_mode = context.request.workflow_mode
    dep_block = _build_dependency_context_block(agent, round_outputs)

    if workflow_mode == WorkflowMode.CODING:
        code_block = _build_code_context_block(context)
        if has_working_dir:
            mode_instruction = _build_coding_live_instruction(agent)
        else:
            mode_instruction = _build_coding_text_instruction(agent)
    else:
        code_block = "コーディングコンテキスト: writingモードのため未使用\n"
        mode_instruction = _build_writing_instruction(agent)

    return (
        f"{_build_system_directive(agent)}\n"
        f"ワークフローモード: {workflow_mode.value}\n"
        f"オーケストレーション: {context.request.orchestration_mode.value}\n"
        f"ラウンド: {round_index}\n"
        f"目的:\n{objective}\n\n"
        f"グローバル指示:\n{global_instruction}\n\n"
        f"{code_block}\n"
        f"{dep_block}\n"
        f"これまでのレビュー指摘:\n{notes}\n\n"
        f"現在の状態:\n<<DRAFT>>\n{context.draft}\n<</DRAFT>>\n\n"
        f"タスク:\n{mode_instruction}"
    )


def _build_coding_live_instruction(agent: AgentConfig) -> str:
    if agent.mode == AgentMode.REVIEWER:
        return (
            "リポジトリの現在の変更内容をレビューしてください。\n"
            "重大度順に指摘を箇条書きで返してください。\n"
            "可能なら `file:line` 形式で対象箇所を示し、"
            "バグ・リスク・不足テストを優先してください。"
        )
    if agent.mode == AgentMode.WRITER:
        return (
            "リポジトリで直接コードを実装してください。\n"
            "必要なファイルを作成・修正してください。\n"
            "テストコードも可能な限り含めてください。\n"
            "作業完了後、変更内容の要約を出力してください。"
        )
    return (
        "レビュー指摘を踏まえてリポジトリのコードを修正・統合してください。\n"
        "テストコマンドが指定されている場合は実行して確認してください。\n"
        "最終的な変更内容の要約を出力してください。"
    )


def _build_coding_text_instruction(agent: AgentConfig) -> str:
    if agent.mode == AgentMode.REVIEWER:
        return (
            "現在のドラフトをコードレビューしてください。"
            "重大度順に3〜8個の指摘を箇条書きで返してください。"
            "可能なら `file:line` 形式で対象箇所を示し、"
            "バグ・リスク・不足テストを優先してください。"
        )
    if agent.mode == AgentMode.WRITER:
        return (
            "現在のドラフトを実装方針として更新してください。"
            "出力は以下の見出しを必ず含めてください: "
            "`変更概要` `変更ファイル` `実装手順` `テスト計画`。"
        )
    return (
        "レビュー指摘を統合して最終実装案を作ってください。"
        "出力は以下の見出しを必ず含めてください: "
        "`最終方針` `ファイル別変更` `リスク` `受け入れ確認`。"
    )


def _build_writing_instruction(agent: AgentConfig) -> str:
    if agent.mode == AgentMode.REVIEWER:
        return (
            "現在の下書きをレビューし、改善点を3〜7個の箇条書きで返してください。"
            "出力は指摘のみで、書き直し本文は出力しないでください。"
        )
    if agent.mode == AgentMode.WRITER:
        return (
            "現在の下書きを目的に合わせて書き直してください。"
            "出力は完成した本文のみを返してください。前置きは不要です。"
        )
    return (
        "レビュー指摘を反映して下書きを統合・推敲してください。"
        "出力は完成した本文のみを返してください。前置きは不要です。"
    )


def _compute_diff(before: str, after: str) -> str:
    diff_lines = unified_diff(
        before.splitlines(),
        after.splitlines(),
        fromfile="original",
        tofile="refined",
        lineterm="",
    )
    return "\n".join(diff_lines)


def _resolve_working_dir(raw: str) -> str:
    if not raw:
        return ""
    path = pathlib.Path(raw)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return str(path)


def _has_commits(working_dir: str) -> bool:
    try:
        result = _sp.run(
            ["git", "rev-parse", "HEAD"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        return result.returncode == 0
    except Exception:
        return False


def _ensure_working_dir(working_dir: str) -> None:
    path = pathlib.Path(working_dir)
    path.mkdir(parents=True, exist_ok=True)
    if not _is_git_repo(working_dir):
        _sp.run(
            ["git", "init"],
            cwd=working_dir,
            capture_output=True,
            timeout=15,
            check=False,
        )
    if not _has_commits(working_dir):
        _sp.run(
            ["git", "commit", "--allow-empty", "-m", "initial empty commit"],
            cwd=working_dir,
            capture_output=True,
            timeout=15,
            check=False,
        )


def _execution_batches(request: RefineRequest) -> list[list[AgentConfig]]:
    agents = request.agents
    if request.orchestration_mode == OrchestrationMode.SEQUENTIAL:
        return [[agent] for agent in agents]

    if request.orchestration_mode == OrchestrationMode.ROLE_BASED:
        role_order = [AgentMode.WRITER, AgentMode.REVIEWER, AgentMode.EDITOR]
        batches: list[list[AgentConfig]] = []
        for role in role_order:
            role_agents = [agent for agent in agents if agent.mode == role]
            if role_agents:
                batches.append(role_agents)
        return batches

    by_id = {agent.id: agent for agent in agents}
    index_map = {agent.id: idx for idx, agent in enumerate(agents)}
    indegree = {agent.id: len(agent.depends_on) for agent in agents}
    reverse: dict[str, list[str]] = defaultdict(list)
    for agent in agents:
        for dep in agent.depends_on:
            reverse[dep].append(agent.id)

    ready = sorted(
        [agent_id for agent_id, degree in indegree.items() if degree == 0],
        key=lambda x: index_map[x],
    )
    visited = 0
    batches: list[list[AgentConfig]] = []
    while ready:
        batch_ids = ready
        visited += len(batch_ids)
        batches.append([by_id[agent_id] for agent_id in batch_ids])

        next_ready: list[str] = []
        for current in batch_ids:
            for nxt in reverse[current]:
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    next_ready.append(nxt)
        ready = sorted(next_ready, key=lambda x: index_map[x])

    if visited != len(agents):
        raise ValueError("dependency_graph has cycle")
    return batches


def iter_refinement_events(request: RefineRequest) -> Iterator[dict[str, object]]:
    context = RunContext(request=request, draft=request.source_text.strip())
    original = context.draft
    all_rounds: list[RoundResult] = []
    total_turns = request.rounds * len(request.agents)
    completed_turns = 0

    try:
        batches = _execution_batches(request)
    except ValueError as exc:
        yield {"type": "run_failed", "error": str(exc)}
        return

    execution_plan = [[agent.id for agent in batch] for batch in batches]
    is_coding = request.workflow_mode == WorkflowMode.CODING
    working_dir = _resolve_working_dir(request.code_context.working_directory.strip())
    has_working_dir = bool(is_coding and working_dir)

    if has_working_dir:
        try:
            _ensure_working_dir(working_dir)
        except OSError as exc:
            yield {
                "type": "run_failed",
                "error": f"作業ディレクトリを準備できません: {exc}",
            }
            return

    yield {
        "type": "run_started",
        "workflow_mode": request.workflow_mode.value,
        "orchestration_mode": request.orchestration_mode.value,
        "execution_plan": execution_plan,
        "rounds": request.rounds,
        "agent_count": len(request.agents),
        "total_turns": total_turns,
        "has_working_dir": has_working_dir,
    }

    for round_index in range(1, request.rounds + 1):
        turns: list[TurnResult] = []
        review_notes: list[str] = []
        round_outputs: dict[str, str] = {}
        turn_index = 0
        yield {
            "type": "round_started",
            "round_index": round_index,
            "execution_plan": execution_plan,
        }

        for batch_index, batch in enumerate(batches, start=1):
            for agent in batch:
                turn_index += 1
                if has_working_dir:
                    current_diff = _capture_git_diff(working_dir)
                    if current_diff:
                        context.draft = (
                            f"元の要件:\n{original}\n\n"
                            f"現在のリポジトリ変更:\n```diff\n{current_diff}\n```"
                        )
                    else:
                        context.draft = (
                            f"元の要件:\n{original}\n\nまだファイル変更はありません。"
                        )

                yield {
                    "type": "turn_started",
                    "round_index": round_index,
                    "batch_index": batch_index,
                    "turn_index": turn_index,
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "mode": agent.mode.value,
                    "provider": agent.provider.value,
                    "depends_on": agent.depends_on,
                }

                prompt = _build_task_prompt(
                    agent=agent,
                    context=context,
                    round_index=round_index,
                    review_notes=review_notes,
                    round_outputs=round_outputs,
                    has_working_dir=has_working_dir,
                )

                try:
                    use_coding = has_working_dir and agent.mode != AgentMode.REVIEWER
                    provider = resolve_provider(
                        provider_kind=agent.provider,
                        command_template=agent.command_template,
                        coding_mode=use_coding,
                    )
                    cwd = working_dir if has_working_dir else None
                    output = provider.generate(
                        prompt=prompt, model=agent.model, cwd=cwd
                    ).strip()

                    file_changes = None
                    if has_working_dir and agent.mode != AgentMode.REVIEWER:
                        file_changes = _capture_git_diff(working_dir)

                    turn = TurnResult(
                        agent_id=agent.id,
                        agent_name=agent.name,
                        mode=agent.mode,
                        provider=agent.provider,
                        output=output,
                        file_changes=file_changes,
                    )
                    turns.append(turn)
                    round_outputs[agent.id] = output

                    if not has_working_dir:
                        if agent.mode == AgentMode.REVIEWER:
                            review_notes.append(f"[{agent.name}]\n{output}")
                        else:
                            context.draft = output or context.draft
                    else:
                        if agent.mode == AgentMode.REVIEWER:
                            review_notes.append(f"[{agent.name}]\n{output}")

                except ProviderError as exc:
                    turn = TurnResult(
                        agent_id=agent.id,
                        agent_name=agent.name,
                        mode=agent.mode,
                        provider=agent.provider,
                        output="",
                        error=str(exc),
                    )
                    turns.append(turn)
                    round_outputs[agent.id] = ""

                completed_turns += 1
                yield {
                    "type": "turn_completed",
                    "round_index": round_index,
                    "batch_index": batch_index,
                    "turn_index": turn_index,
                    "completed_turns": completed_turns,
                    "total_turns": total_turns,
                    "turn": turn.model_dump(mode="json"),
                }

        round_draft = context.draft
        if has_working_dir:
            round_diff = _capture_git_diff(working_dir)
            round_draft = round_diff or context.draft

        round_result = RoundResult(
            round_index=round_index,
            turns=turns,
            draft_after_round=round_draft,
        )
        all_rounds.append(round_result)
        yield {
            "type": "round_completed",
            "round_index": round_index,
            "draft_after_round": round_draft,
        }

    total_file_changes = ""
    if has_working_dir:
        total_file_changes = _capture_git_diff(working_dir)

    final_text = context.draft
    if has_working_dir and total_file_changes:
        final_text = total_file_changes

    result = RefineResponse(
        final_text=final_text,
        rounds=all_rounds,
        diff=_compute_diff(original, final_text),
        file_changes=total_file_changes,
    )
    yield {"type": "run_completed", "result": result.model_dump(mode="json")}


def run_refinement(request: RefineRequest) -> RefineResponse:
    final_result: RefineResponse | None = None
    for event in iter_refinement_events(request):
        if event.get("type") == "run_completed":
            payload = event.get("result")
            if isinstance(payload, dict):
                final_result = RefineResponse.model_validate(payload)

    if final_result is None:
        raise RuntimeError("refinement did not complete")

    return final_result
