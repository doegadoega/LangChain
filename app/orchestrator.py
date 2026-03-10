from __future__ import annotations

from dataclasses import dataclass
from difflib import unified_diff
from typing import Iterator

from app.models import (
    AgentConfig,
    AgentMode,
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


def _build_system_directive(agent: AgentConfig) -> str:
    persona_block = agent.persona.strip() or "なし"
    skills_block = "\n".join(f"- {skill}" for skill in agent.skills) or "- なし"
    return (
        f"あなたは {agent.name} です。\n"
        f"役割: {agent.mode.value}\n"
        f"ペルソナ:\n{persona_block}\n\n"
        f"活用するスキル:\n{skills_block}\n"
    )


def _build_task_prompt(
    *,
    agent: AgentConfig,
    context: RunContext,
    round_index: int,
    review_notes: list[str],
) -> str:
    objective = context.request.objective.strip() or "特になし"
    global_instruction = context.request.global_instruction.strip() or "特になし"
    notes = "\n\n".join(review_notes) if review_notes else "なし"
    workflow_mode = context.request.workflow_mode

    if workflow_mode == WorkflowMode.CODING:
        code = context.request.code_context
        target_paths = "\n".join(f"- {path}" for path in code.target_paths) or "- 未指定"
        code_block = (
            "コーディングコンテキスト:\n"
            f"- リポジトリ: {code.repository or '未指定'}\n"
            f"- 対象パス:\n{target_paths}\n"
            f"- 技術スタック:\n{code.tech_stack or '未指定'}\n"
            f"- 受け入れ条件:\n{code.acceptance_criteria or '未指定'}\n"
            f"- テストコマンド: {code.test_command or '未指定'}\n"
        )

        if agent.mode == AgentMode.REVIEWER:
            mode_instruction = (
                "現在のドラフトをコードレビューしてください。"
                "重大度順に3〜8個の指摘を箇条書きで返してください。"
                "可能なら `file:line` 形式で対象箇所を示し、"
                "バグ・リスク・不足テストを優先してください。"
            )
        elif agent.mode == AgentMode.WRITER:
            mode_instruction = (
                "現在のドラフトを実装方針として更新してください。"
                "出力は以下の見出しを必ず含めてください: "
                "`変更概要` `変更ファイル` `実装手順` `テスト計画`。"
            )
        else:
            mode_instruction = (
                "レビュー指摘を統合して最終実装案を作ってください。"
                "出力は以下の見出しを必ず含めてください: "
                "`最終方針` `ファイル別変更` `リスク` `受け入れ確認`。"
            )
    else:
        code_block = "コーディングコンテキスト: writingモードのため未使用\n"
        if agent.mode == AgentMode.REVIEWER:
            mode_instruction = (
                "現在の下書きをレビューし、改善点を3〜7個の箇条書きで返してください。"
                "出力は指摘のみで、書き直し本文は出力しないでください。"
            )
        elif agent.mode == AgentMode.WRITER:
            mode_instruction = (
                "現在の下書きを目的に合わせて書き直してください。"
                "出力は完成した本文のみを返してください。前置きは不要です。"
            )
        else:
            mode_instruction = (
                "レビュー指摘を反映して下書きを統合・推敲してください。"
                "出力は完成した本文のみを返してください。前置きは不要です。"
            )

    return (
        f"{_build_system_directive(agent)}\n"
        f"ワークフローモード: {workflow_mode.value}\n"
        f"ラウンド: {round_index}\n"
        f"目的:\n{objective}\n\n"
        f"グローバル指示:\n{global_instruction}\n\n"
        f"{code_block}\n"
        f"これまでのレビュー指摘:\n{notes}\n\n"
        f"現在の下書き:\n<<DRAFT>>\n{context.draft}\n<</DRAFT>>\n\n"
        f"タスク:\n{mode_instruction}"
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


def iter_refinement_events(request: RefineRequest) -> Iterator[dict[str, object]]:
    context = RunContext(request=request, draft=request.source_text.strip())
    original = context.draft
    all_rounds: list[RoundResult] = []
    total_turns = request.rounds * len(request.agents)
    completed_turns = 0

    yield {
        "type": "run_started",
        "workflow_mode": request.workflow_mode.value,
        "rounds": request.rounds,
        "agent_count": len(request.agents),
        "total_turns": total_turns,
    }

    for round_index in range(1, request.rounds + 1):
        turns: list[TurnResult] = []
        review_notes: list[str] = []
        yield {"type": "round_started", "round_index": round_index}

        for turn_index, agent in enumerate(request.agents, start=1):
            yield {
                "type": "turn_started",
                "round_index": round_index,
                "turn_index": turn_index,
                "agent_id": agent.id,
                "agent_name": agent.name,
                "mode": agent.mode.value,
                "provider": agent.provider.value,
            }
            prompt = _build_task_prompt(
                agent=agent,
                context=context,
                round_index=round_index,
                review_notes=review_notes,
            )
            try:
                provider = resolve_provider(
                    provider_kind=agent.provider,
                    command_template=agent.command_template,
                )
                output = provider.generate(prompt=prompt, model=agent.model).strip()
                turn = TurnResult(
                    agent_id=agent.id,
                    agent_name=agent.name,
                    mode=agent.mode,
                    provider=agent.provider,
                    output=output,
                )
                turns.append(turn)

                if agent.mode == AgentMode.REVIEWER:
                    review_notes.append(f"[{agent.name}]\n{output}")
                else:
                    context.draft = output or context.draft
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

            completed_turns += 1
            yield {
                "type": "turn_completed",
                "round_index": round_index,
                "turn_index": turn_index,
                "completed_turns": completed_turns,
                "total_turns": total_turns,
                "turn": turn.model_dump(mode="json"),
            }

        round_result = RoundResult(
            round_index=round_index,
            turns=turns,
            draft_after_round=context.draft,
        )
        all_rounds.append(round_result)
        yield {
            "type": "round_completed",
            "round_index": round_index,
            "draft_after_round": context.draft,
        }

    result = RefineResponse(
        final_text=context.draft,
        rounds=all_rounds,
        diff=_compute_diff(original, context.draft),
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
