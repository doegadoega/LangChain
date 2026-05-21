from __future__ import annotations

import logging
import os
import pathlib
import subprocess as _sp
import time
from collections import defaultdict
from dataclasses import dataclass, field
from difflib import unified_diff
from typing import Iterator

from app.logging_setup import get_agent_logger

logger = logging.getLogger("app.orchestrator")

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent

from app.models import (
    AgentConfig,
    OrgRole,
    OrchestrationMode,
    ProviderKind,
    RefineRequest,
    RefineResponse,
    ResearchSourceResult,
    RoundResult,
    TurnResult,
    WorkflowMode,
)
from app.providers import CLITemplateProvider, ProviderError, resolve_provider
from app.research import fetch_research_sources
from app.skills import SkillDocument, SkillStore, render_skills

DIRECT_EDIT_PROVIDERS = {
    ProviderKind.GEMINI_CLI,
    ProviderKind.CLAUDE_CLI,
    ProviderKind.CODEX_CLI,
    ProviderKind.ANDROID_CLI,
    ProviderKind.CUSTOM_CLI,
}

LIMITED_EXTERNAL_API_PROVIDERS = {
    ProviderKind.DEEPSEEK_API,
}

# In coding mode the running draft becomes the full repository diff, which can
# grow unbounded (observed ~670K chars) and make CLI turns slow or time out.
# Cap what we embed in the prompt; direct-edit agents can still read the actual
# files in their working directory.
CODING_DRAFT_MAX_CHARS = int(os.getenv("CODING_DRAFT_MAX_CHARS", "60000"))


@dataclass
class RunContext:
    request: RefineRequest
    draft: str
    interaction_history: list[dict[str, str | int]] = field(default_factory=list)


def _capture_git_diff(working_directory: str) -> str:
    """Return tracked diff under the selected working directory without mutating git state."""
    try:
        result = _sp.run(
            ["git", "diff", "--no-ext-diff", "HEAD", "--", "."],
            cwd=working_directory,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        diff = (result.stdout or "").strip()
        untracked = _sp.run(
            ["git", "ls-files", "--others", "--exclude-standard", "--", "."],
            cwd=working_directory,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        untracked_files = [
            line.strip()
            for line in (untracked.stdout or "").splitlines()
            if line.strip()
        ]
        if untracked_files:
            untracked_block = "\n".join(f"- {path}" for path in untracked_files[:100])
            if len(untracked_files) > 100:
                untracked_block += f"\n- ... and {len(untracked_files) - 100} more"
            diff = "\n\n".join(
                part for part in [diff, f"Untracked files:\n{untracked_block}"] if part
            )
        return diff
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


def _build_system_directive(
    agent: AgentConfig,
    installed_skills: list[SkillDocument] | None = None,
) -> str:
    persona_block = agent.persona.strip() or "なし"
    skills_block = "\n".join(f"- {skill}" for skill in agent.skills) or "- なし"
    rendered_skills = ""
    if installed_skills and agent.skill_refs:
        rendered_skills = render_skills(
            skills=installed_skills,
            references=agent.skill_refs,
            provider=agent.provider.value,
            role=agent.org_role.value,
        ).strip()
    skill_section = (
        f"\nインストール済みスキル:\n{rendered_skills}\n"
        if rendered_skills
        else ""
    )
    if agent.mcp_enabled:
        mcp_servers = ", ".join(agent.mcp_servers) or "未指定"
        mcp_instruction = agent.mcp_instruction.strip() or "特になし"
        mcp_block = (
            "MCP設定:\n"
            "- 有効化: 有効\n"
            f"- サーバー: {mcp_servers}\n"
            f"- 設定ファイル: {agent.mcp_config_path or '未指定'}\n"
            f"- 参照コマンド: {agent.mcp_context_command or '未指定'}\n"
            f"- MCP指示:\n{mcp_instruction}\n"
        )
    else:
        mcp_block = "MCP設定:\n- 有効化: 無効\n"
    return (
        f"あなたは {agent.name} です。\n"
        f"組織ロール: {agent.org_role.value}\n"
        "人格・振る舞い指示:\n"
        "以下のペルソナを会話全体で維持してください。\n"
        f"{persona_block}\n\n"
        f"活用するスキル:\n{skills_block}\n"
        f"{skill_section}"
        f"{mcp_block}"
    )


def _build_mcp_context_block(mcp_context: str, mcp_error: str | None) -> str:
    if mcp_context:
        return (
            "MCP参照コンテキスト:\n"
            f"```text\n{_truncate_output(mcp_context, max_chars=6000)}\n```"
        )
    if mcp_error:
        return f"MCP参照コンテキスト: 取得失敗 ({mcp_error})"
    return "MCP参照コンテキスト: なし"


def _build_research_context_block(
    agent: AgentConfig,
    research_results: list[ResearchSourceResult] | None = None,
    research_error: str | None = None,
) -> str:
    if not agent.allow_web_search:
        return ""

    sources = "\n".join(f"- {source}" for source in agent.research_sources) or "- 未登録"
    fetched = research_results or []
    if fetched:
        fetched_block = "\n".join(
            "\n".join(
                line
                for line in [
                    f"- URL: {item.url}",
                    f"  title: {item.title}" if item.title else "",
                    f"  snippet: {_truncate_output(item.snippet, max_chars=900)}"
                    if item.snippet
                    else "",
                    f"  error: {item.error}" if item.error else "",
                ]
                if line
            )
            for item in fetched
        )
    else:
        fetched_block = "なし"
    citation_rule = (
        "参照URLを回答に残す"
        if agent.require_citations
        else "参照URLの明記は任意"
    )
    error_line = f"- 取得エラー: {research_error}\n" if research_error else ""
    return (
        "Research Context:\n"
        "- ネット検索: 許可\n"
        f"- 最大検索件数: {agent.max_search_results}\n"
        f"- 引用方針: {citation_rule}\n"
        "- 必ず確認する技術サイト/ソース:\n"
        f"{sources}\n"
        f"- 取得結果:\n{fetched_block}\n"
        f"{error_line}"
        "注意: 検索やサイト確認を行う場合は、登録ソースを優先し、古い情報や未確認情報を断定しないでください。\n"
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


def _build_knowledge_context_block(context: RunContext) -> str:
    if not context.request.knowledge_context:
        return "Knowledge Context: なし\n"

    lines = ["Knowledge Context:"]
    for item in context.request.knowledge_context[:12]:
        source = f" source={item.source}" if item.source else ""
        tags = f" tags={', '.join(item.tags)}" if item.tags else ""
        lines.append(f"- [{item.kind}] {item.title}{source}{tags}")
        if item.kind == "image":
            content_type = item.content_type or "image/*"
            lines.append(
                f"  画像添付: {content_type}. 画像データは履歴に保存済み。"
                "このプロンプトにはbase64本文を含めません。"
            )
        elif item.kind == "figma":
            lines.append(
                "  Figma/FIG資料: 外部連携またはファイル参照用。必要なら source を確認してください。"
            )
        elif item.kind == "mcp":
            lines.append("  MCP資料:\n```text\n" + _truncate_output(item.content, max_chars=4000) + "\n```")
        else:
            lines.append("```text\n" + _truncate_output(item.content, max_chars=4000) + "\n```")
    return "\n".join(lines) + "\n"


def _truncate_output(text: str, max_chars: int = 2800) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...(truncated)"


def _clamp_middle(text: str, max_chars: int, *, label: str = "text") -> str:
    """Trim an over-long block by eliding its middle, keeping head and tail.

    For diffs this preserves both the earliest and most recent hunks, which is
    more useful than a head-only cut.
    """
    if max_chars <= 0 or len(text) <= max_chars:
        return text
    marker = f"\n...[中略: {len(text)}→{max_chars}文字 / {label}]...\n"
    budget = max_chars - len(marker)
    if budget <= 0:
        return text[:max_chars]
    head = int(budget * 0.6)
    tail = budget - head
    return text[:head] + marker + text[-tail:]


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


def _build_interaction_history_block(context: RunContext) -> str:
    if not context.interaction_history:
        return "議論履歴: なし\n"

    lines = ["議論履歴:"]
    for item in context.interaction_history[-16:]:
        round_index = item.get("round_index", "?")
        agent_name = item.get("agent_name", "unknown")
        org_role = item.get("org_role", "unknown")
        output = str(item.get("output", "")).strip()
        if not output:
            continue
        lines.append(
            f"- Round {round_index} / {agent_name} ({org_role}):\n"
            f"```text\n{_truncate_output(output, max_chars=1800)}\n```"
        )
    return "\n".join(lines) + "\n"


def _load_mcp_context(
    *,
    agent: AgentConfig,
    prompt: str,
    cwd: str | None,
) -> tuple[str, str | None]:
    if not agent.mcp_enabled or not agent.mcp_context_command:
        return "", None

    provider = CLITemplateProvider(
        command_template=agent.mcp_context_command,
        timeout_sec=agent.mcp_timeout_sec,
    )
    try:
        context_text = provider.generate(
            prompt=prompt,
            model=agent.model,
            cwd=cwd,
            mcp_config_path=agent.mcp_config_path,
            mcp_servers=agent.mcp_servers,
        ).strip()
        return context_text, None
    except ProviderError as exc:
        return "", str(exc)


def _build_task_prompt(
    *,
    agent: AgentConfig,
    context: RunContext,
    round_index: int,
    round_outputs: dict[str, str],
    has_working_dir: bool = False,
    can_edit_files: bool = False,
    installed_skills: list[SkillDocument] | None = None,
    research_results: list[ResearchSourceResult] | None = None,
    research_error: str | None = None,
) -> str:
    objective = context.request.objective.strip() or "特になし"
    global_instruction = context.request.global_instruction.strip() or "特になし"
    workflow_mode = context.request.workflow_mode
    provider_limit_block = ""
    if agent.provider in LIMITED_EXTERNAL_API_PROVIDERS:
        provider_limit_block = (
            "外部API制限:\n"
            "- このエージェントは DeepSeek などの外部APIです。\n"
            "- 社内規約、秘密情報、個人情報、未公開仕様を扱う判断をしないでください。\n"
            "- 役割は単純なチャット、一般的な実装方針、テスト観点、非機密コードレビューに限定します。\n"
            "- ファイル編集や秘密情報を含む実装判断は Codex/Claude/local などの許可済みエージェントへ委ねてください。\n\n"
        )
    dep_block = _build_dependency_context_block(agent, round_outputs)
    knowledge_block = _build_knowledge_context_block(context)
    research_block = _build_research_context_block(
        agent,
        research_results=research_results,
        research_error=research_error,
    )
    output_history = (
        "\n\n".join(
            f"[{agent_id}]\n{_truncate_output(text)}"
            for agent_id, text in round_outputs.items()
            if text
        )
        if round_outputs
        else "なし"
    )

    if workflow_mode == WorkflowMode.CODING:
        code_block = _build_code_context_block(context)
        role_instruction = _build_coding_instruction(
            org_role=agent.org_role,
            has_working_dir=has_working_dir,
            can_edit_files=can_edit_files,
        )
    else:
        code_block = "コーディングコンテキスト: writingモードのため未使用\n"
        role_instruction = _build_writing_instruction(
            org_role=agent.org_role,
            collaboration_style=_detect_collaboration_style(
                objective=objective,
                global_instruction=global_instruction,
            ),
            round_index=round_index,
        )
    interaction_history = (
        _build_interaction_history_block(context)
        if workflow_mode == WorkflowMode.WRITING
        else "議論履歴: codingモードのため未使用\n"
    )

    # In coding mode the draft is the (potentially huge) repository diff. Cap it
    # so prompts stay bounded; the writing-mode draft is the actual content being
    # refined, so it is left intact.
    draft_for_prompt = (
        _clamp_middle(context.draft, CODING_DRAFT_MAX_CHARS, label="diff")
        if workflow_mode == WorkflowMode.CODING
        else context.draft
    )

    return (
        f"{_build_system_directive(agent, installed_skills=installed_skills)}\n"
        f"ワークフローモード: {workflow_mode.value}\n"
        f"オーケストレーション: {context.request.orchestration_mode.value}\n"
        f"ラウンド: {round_index}\n"
        f"目的:\n{objective}\n\n"
        f"グローバル指示:\n{global_instruction}\n\n"
        f"{provider_limit_block}"
        f"{code_block}\n"
        f"{knowledge_block}\n"
        f"{dep_block}\n"
        f"{research_block}\n"
        f"{interaction_history}\n"
        f"これまでの依存出力サマリー:\n{output_history}\n\n"
        f"現在の状態:\n<<DRAFT>>\n{draft_for_prompt}\n<</DRAFT>>\n\n"
        f"タスク:\n{role_instruction}"
    )


def _build_coding_instruction(
    *, org_role: OrgRole, has_working_dir: bool, can_edit_files: bool
) -> str:
    role_hint = {
        OrgRole.CEO: "最終判断者として、優先順位と受け入れ基準を明確化してください。",
        OrgRole.MANAGER: "計画整合と分解可能性を重視し、実行指示を具体化してください。",
        OrgRole.PMO: "計画の抜け漏れ・依存リスク・進捗リスクを明示してください。",
        OrgRole.QA: "テスト観点と品質ゲート観点を最優先で確認してください。",
    }.get(org_role, "担当ロールとして成果物を前進させる具体的な変更を出してください。")

    if has_working_dir and can_edit_files:
        return (
            "リポジトリで直接作業してください。\n"
            "必要なファイルを作成・修正し、変更内容を要約してください。\n"
            "テストコマンドがある場合は実行して結果を含めてください。\n"
            f"{role_hint}"
        )

    if has_working_dir:
        return (
            "ローカルLLMはこの実行環境で直接ファイルを書き換えられません。\n"
            "対象ファイル、変更方針、最小diff案、テストコマンドを具体的に出してください。\n"
            "出力は以下の見出しを含めてください: "
            "`変更概要` `対象ファイル` `diff案` `テストコマンド` `Codex向け指示`。\n"
            f"{role_hint}"
        )

    return (
        "現在のドラフトを実装計画として改善してください。\n"
        "出力は以下の見出しを含めてください: "
        "`変更概要` `変更ファイル` `実装手順` `テスト計画` `リスク`。\n"
        f"{role_hint}"
    )


def _detect_collaboration_style(*, objective: str, global_instruction: str) -> str:
    raw = f"{objective}\n{global_instruction}".lower()
    if "ディベート" in raw or "debate" in raw:
        return "debate"
    if "議論" in raw or "ディスカッション" in raw or "discussion" in raw:
        return "discussion"
    return ""


def _build_writing_instruction(
    *, org_role: OrgRole, collaboration_style: str = "", round_index: int = 1
) -> str:
    role_hint = {
        OrgRole.CEO: "意思決定しやすい簡潔さを重視してください。",
        OrgRole.MANAGER: "段取りと依存関係が伝わる構成にしてください。",
        OrgRole.PMO: "抜け漏れと曖昧表現を排除してください。",
        OrgRole.QA: "検証観点が明確になるようにしてください。",
    }.get(org_role, "読み手に伝わる明瞭さを重視してください。")
    debate_round_hint = (
        "このラウンドでは、前の発言を踏まえて論点を収束させてください。"
        if round_index >= 2
        else "このラウンドでは、目的に照らした主要論点を出してください。"
    )
    if collaboration_style == "debate":
        return (
            "現在の下書きをディベート対象として扱ってください。\n"
            "縦割りコメントは禁止です。自分の担当範囲だけで完結させず、会話として進めてください。\n"
            "他エージェントの主張に必ず反応し、同意・反論・補強・未決点を分けてください。\n"
            "目的に照らして、採用すべき判断材料と捨てるべき論点を明確にしてください。\n"
            "ユーザー確認前に最終決定・最終確認済みとは書かないでください。出力は暫定結論または議論結果として扱ってください。\n"
            f"{debate_round_hint}\n"
            "出力は `主張` `他者への反応` `採用判断` `残るリスク` `次に渡す材料` を含めてください。\n"
            f"{role_hint}"
        )
    if collaboration_style == "discussion":
        return (
            "現在の下書きをチーム議論の対象として扱ってください。\n"
            "縦割りコメントは禁止です。各自の担当範囲を並べるだけではなく、他者の発言に反応してください。\n"
            "他エージェントの主張に必ず反応し、同意・反論・補強・未決点を分けてください。\n"
            "目的に照らして、合意できること、まだ決めないこと、次に確認することを整理してください。\n"
            "ユーザー確認前に最終決定・最終確認済みとは書かないでください。出力は暫定結論または議論結果として扱ってください。\n"
            f"{debate_round_hint}\n"
            "出力は `主張` `他者への反応` `合意点` `未決点` `次の行動` を含めてください。\n"
            f"{role_hint}"
        )
    return (
        "現在の下書きを改善してください。\n"
        "必要なら修正案と本文をまとめて返してください。\n"
        f"{role_hint}"
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
        role_order = [
            OrgRole.CEO,
            OrgRole.MANAGER,
            OrgRole.WORKER,
            OrgRole.PMO,
            OrgRole.QA,
            OrgRole.UI_DESIGNER,
            OrgRole.SYSTEM_DESIGNER,
            OrgRole.OPS_DESIGNER,
            OrgRole.OTHER,
        ]
        batches: list[list[AgentConfig]] = []
        for role in role_order:
            role_agents = [agent for agent in agents if agent.org_role == role]
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
    direct_edit_agents = [
        agent.id for agent in request.agents if agent.provider in DIRECT_EDIT_PROVIDERS
    ]

    if has_working_dir:
        try:
            _ensure_working_dir(working_dir)
        except OSError as exc:
            yield {
                "type": "run_failed",
                "error": f"作業ディレクトリを準備できません: {exc}",
            }
            return

    try:
        installed_skills = SkillStore().load_installed_skills()
    except Exception:
        installed_skills = []

    yield {
        "type": "run_started",
        "workflow_mode": request.workflow_mode.value,
        "orchestration_mode": request.orchestration_mode.value,
        "execution_plan": execution_plan,
        "rounds": request.rounds,
        "agent_count": len(request.agents),
        "mcp_enabled_agents": [
            agent.id for agent in request.agents if agent.mcp_enabled
        ],
        "direct_edit_agents": direct_edit_agents,
        "total_turns": total_turns,
        "has_working_dir": has_working_dir,
    }

    for round_index in range(1, request.rounds + 1):
        turns: list[TurnResult] = []
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
                can_edit_files = agent.provider in DIRECT_EDIT_PROVIDERS
                if has_working_dir and can_edit_files:
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

                agent_logger = get_agent_logger(agent.id)
                turn_started_at = time.monotonic()
                agent_logger.info(
                    "turn.start round=%d batch=%d turn=%d agent=%s role=%s provider=%s mcp=%s",
                    round_index,
                    batch_index,
                    turn_index,
                    agent.name,
                    agent.org_role.value,
                    agent.provider.value,
                    agent.mcp_enabled,
                )

                yield {
                    "type": "turn_started",
                    "round_index": round_index,
                    "batch_index": batch_index,
                    "turn_index": turn_index,
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "org_role": agent.org_role.value,
                    "provider": agent.provider.value,
                    "depends_on": agent.depends_on,
                    "mcp_enabled": agent.mcp_enabled,
                }

                def emit_phase(phase: str, **extra) -> dict[str, object]:
                    return {
                        "type": "turn_phase",
                        "round_index": round_index,
                        "batch_index": batch_index,
                        "turn_index": turn_index,
                        "agent_id": agent.id,
                        "agent_name": agent.name,
                        "phase": phase,
                        **extra,
                    }

                research_results: list[ResearchSourceResult] = []
                research_error = None
                if agent.allow_web_search and agent.research_sources:
                    yield emit_phase("research_fetching", sources=len(agent.research_sources))
                    agent_logger.info("research.fetch sources=%d", len(agent.research_sources))
                    try:
                        research_results = fetch_research_sources(
                            agent.research_sources,
                            max_results=agent.max_search_results,
                        )
                        agent_logger.info("research.done results=%d", len(research_results))
                    except Exception as exc:
                        research_error = str(exc)
                        agent_logger.warning("research.failed error=%s", exc)

                yield emit_phase("prompt_building")
                prompt = _build_task_prompt(
                    agent=agent,
                    context=context,
                    round_index=round_index,
                    round_outputs=round_outputs,
                    has_working_dir=has_working_dir,
                    can_edit_files=can_edit_files,
                    installed_skills=installed_skills,
                    research_results=research_results,
                    research_error=research_error,
                )
                cwd = working_dir if has_working_dir else None
                mcp_context = ""
                mcp_context_error = None
                if agent.mcp_enabled:
                    yield emit_phase("mcp_loading", servers=agent.mcp_servers)
                    agent_logger.info("mcp.load servers=%s", agent.mcp_servers)
                    mcp_context, mcp_context_error = _load_mcp_context(
                        agent=agent,
                        prompt=prompt,
                        cwd=cwd,
                    )
                    if mcp_context_error:
                        agent_logger.warning("mcp.error %s", mcp_context_error)
                    prompt = (
                        f"{prompt}\n\n"
                        f"{_build_mcp_context_block(mcp_context, mcp_context_error)}"
                    )

                agent_logger.info(
                    "prompt.built chars=%d coding=%s cwd=%s",
                    len(prompt),
                    has_working_dir,
                    cwd or "-",
                )
                yield emit_phase(
                    "provider_calling",
                    provider=agent.provider.value,
                    prompt_chars=len(prompt),
                    model=agent.model,
                )

                provider_started_at = time.monotonic()
                try:
                    use_coding = has_working_dir
                    provider = resolve_provider(
                        provider_kind=agent.provider,
                        command_template=agent.command_template,
                        coding_mode=use_coding,
                    )
                    output = provider.generate(
                        prompt=prompt,
                        model=agent.model,
                        cwd=cwd,
                        mcp_config_path=agent.mcp_config_path,
                        mcp_servers=agent.mcp_servers,
                    ).strip()
                    provider_elapsed = time.monotonic() - provider_started_at
                    agent_logger.info(
                        "provider.completed elapsed=%.1fs output_chars=%d",
                        provider_elapsed,
                        len(output),
                    )
                    yield emit_phase(
                        "provider_completed",
                        elapsed_sec=round(provider_elapsed, 2),
                        output_chars=len(output),
                    )

                    file_changes = None
                    if has_working_dir and can_edit_files:
                        file_changes = _capture_git_diff(working_dir)

                    turn = TurnResult(
                        agent_id=agent.id,
                        agent_name=agent.name,
                        org_role=agent.org_role,
                        provider=agent.provider,
                        output=output,
                        file_changes=file_changes,
                        mcp_enabled=agent.mcp_enabled,
                        mcp_context_used=bool(mcp_context),
                        mcp_context_error=mcp_context_error,
                        research_enabled=agent.allow_web_search,
                        research_context_used=bool(research_results),
                        research_context_error=research_error,
                        research_results=research_results,
                    )
                    turns.append(turn)
                    round_outputs[agent.id] = output
                    if request.workflow_mode == WorkflowMode.WRITING and output:
                        context.interaction_history.append(
                            {
                                "round_index": round_index,
                                "agent_id": agent.id,
                                "agent_name": agent.name,
                                "org_role": agent.org_role.value,
                                "output": output,
                            }
                        )

                    if not has_working_dir or not can_edit_files or not file_changes:
                        context.draft = output or context.draft

                except ProviderError as exc:
                    provider_elapsed = time.monotonic() - provider_started_at
                    agent_logger.warning(
                        "provider.failed elapsed=%.1fs error=%s",
                        provider_elapsed,
                        exc,
                    )
                    yield emit_phase(
                        "provider_failed",
                        elapsed_sec=round(provider_elapsed, 2),
                        error=str(exc),
                    )
                    turn = TurnResult(
                        agent_id=agent.id,
                        agent_name=agent.name,
                        org_role=agent.org_role,
                        provider=agent.provider,
                        output="",
                        error=str(exc),
                        mcp_enabled=agent.mcp_enabled,
                        mcp_context_used=bool(mcp_context),
                        mcp_context_error=mcp_context_error,
                        research_enabled=agent.allow_web_search,
                        research_context_used=bool(research_results),
                        research_context_error=research_error,
                        research_results=research_results,
                    )
                    turns.append(turn)
                    round_outputs[agent.id] = ""

                completed_turns += 1
                turn_elapsed = time.monotonic() - turn_started_at
                agent_logger.info(
                    "turn.end elapsed=%.1fs has_error=%s",
                    turn_elapsed,
                    bool(turn.error),
                )
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
        if has_working_dir and direct_edit_agents:
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
    if has_working_dir and direct_edit_agents:
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
