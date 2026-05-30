"""Task Router: classify a request and build a TaskPlan.

Keyword-based classification (Japanese + English) keeps Sprint 1 dependency-free
and predictable; it can later be swapped for an LLM classifier behind the same
``route()`` interface.
"""

from __future__ import annotations

import re
import unicodedata

from app.intake.models import ApprovalPolicy, TaskPlan, TaskRequest, TaskType
from app.intake.workflows import (
    BUILTIN_WORKFLOWS,
    PhaseType,
    WorkflowDefinition,
    get_workflow,
)


_ASCII_HEAD = re.compile(r"[a-z0-9]")


def _matches(keyword: str, haystack: str) -> bool:
    """Membership test that respects word boundaries for ASCII keywords.

    Substring `in` matching mis-classified ``prefix``/``fixture`` as bug_fix
    (because of the ``fix`` keyword), ``preview`` as code_review (``review``),
    ``terror`` as bug_fix (``error``), and ``print`` as a diff-review skill
    (``pr``). This helper closes those holes while keeping English inflections
    like ``fixed``/``errors``/``reviewing`` working.

    Rules:
      - Non-ASCII keywords (Japanese): substring membership, unchanged.
      - ASCII keywords with len <= 2 (``pr``/``ci``/``qa``): strict both-sided
        word boundary — match only when surrounded by non-alphanumerics.
      - ASCII keywords with len >= 3: front-boundary + ``[a-z0-9]*`` suffix —
        ``fix`` matches ``fix``/``fixed``/``fixing`` but not ``prefix``.
    Residual: ``fixture``/``address``/``different`` still match their
    prefix keyword. Mitigated by classifier ordering and accepted as a
    documented trade-off (see review.md from run wr_828e340aaaac).
    """
    kw = keyword.strip().lower()
    if not kw:
        return False
    if not _ASCII_HEAD.match(kw):
        return kw in haystack
    escaped = re.escape(kw)
    if len(kw) <= 2:
        pattern = rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"
    else:
        pattern = rf"(?<![a-z0-9]){escaped}[a-z0-9]*"
    return re.search(pattern, haystack) is not None

# Ordered classification rules — first matching task type wins, so more specific
# intents (bug fix, review) are checked before the broad feature-development case.
_CLASSIFICATION_RULES: list[tuple[TaskType, tuple[str, ...]]] = [
    (
        TaskType.BUG_FIX,
        ("壊れ", "動かない", "動作しない", "エラー", "修正", "直し", "直す", "バグ",
         "不具合", "broken", "doesn't work", "does not work", "error", "fix", "bug", "crash"),
    ),
    (
        TaskType.DESIGN_REVIEW,
        ("設計レビュー", "アーキ", "設計を見", "design review", "architecture review"),
    ),
    (
        TaskType.CODE_REVIEW,
        ("レビュー", "見て", "問題ないか", "確認して", "review", "look at", "check if"),
    ),
    (
        TaskType.REFACTOR,
        ("リファクタ", "整理", "クリーンアップ", "refactor", "clean up", "cleanup", "tidy"),
    ),
    (
        TaskType.QA_VERIFICATION,
        ("テスト", "検証", "動作確認", "qa", "verify", "verification", "test"),
    ),
    (
        TaskType.RELEASE_PREPARATION,
        ("リリース", "デプロイ", "プルリク", "release", "deploy", "ship", "pull request"),
    ),
    (
        TaskType.DOCUMENTATION,
        ("ドキュメント", "ドキュ", "文書", "手順書", "readme", "document", "docs"),
    ),
    (
        TaskType.RESEARCH,
        ("調査", "調べ", "リサーチ", "比較", "research", "investigate", "explore"),
    ),
    (
        TaskType.FEATURE_DEVELOPMENT,
        ("実装", "追加", "作って", "作成", "画面", "機能", "feature", "implement",
         "add", "build", "create", "screen"),
    ),
]

# task type -> workflow template id
_WORKFLOW_BY_TYPE: dict[TaskType, str] = {
    TaskType.FEATURE_DEVELOPMENT: "feature_development_default",
    TaskType.REFACTOR: "refactor_default",
    TaskType.BUG_FIX: "bug_fix_default",
    TaskType.QA_VERIFICATION: "bug_fix_default",
    TaskType.CODE_REVIEW: "review_only",
    TaskType.DESIGN_REVIEW: "design_review_default",
    TaskType.RESEARCH: "review_only",
    TaskType.DOCUMENTATION: "documentation_default",
    TaskType.RELEASE_PREPARATION: "release_preparation_default",
}

# keyword -> skill id, used to hint the Agent Matcher (Sprint 6) later.
_SKILL_HINTS: dict[str, str] = {
    "webview": "android_webview",
    "blob": "blob_download",
    "ダウンロード": "blob_download",
    "javascript": "javascript_bridge",
    "bridge": "javascript_bridge",
    "android": "android_dev",
    "kotlin": "android_dev",
    "swift": "swift_dev",
    "swiftui": "swift_dev",
    "ios": "ios_dev",
    "react": "react_dev",
    "next.js": "react_dev",
    "nextjs": "react_dev",
    "typescript": "typescript_dev",
    "python": "python_dev",
    "fastapi": "python_dev",
    "django": "python_dev",
    "sql": "database",
    "postgres": "database",
    "データベース": "database",
    "docker": "devops",
    "ci": "devops",
    "diff": "git_diff_review",
    "pr": "git_diff_review",
    "プルリク": "git_diff_review",
    "テスト": "testing",
    "test": "testing",
    "セキュリティ": "security_review",
    "security": "security_review",
    "認証": "auth",
    "ログイン": "auth",
    "login": "auth",
}

# task types that involve editing a repository (need a working repo to run).
_CODE_EDITING_TYPES = {
    TaskType.FEATURE_DEVELOPMENT,
    TaskType.BUG_FIX,
    TaskType.REFACTOR,
}


class TaskRouter:
    """Classifies a TaskRequest and produces a TaskPlan."""

    def __init__(self, workflows: dict[str, WorkflowDefinition] | None = None) -> None:
        self._workflows = workflows or BUILTIN_WORKFLOWS

    def classify(self, request: TaskRequest) -> TaskType:
        haystack = self._haystack(request)
        for task_type, keywords in _CLASSIFICATION_RULES:
            if any(_matches(keyword, haystack) for keyword in keywords):
                return task_type
        # Nothing matched: a request with a repo is most likely feature work,
        # otherwise treat it as research.
        return (
            TaskType.FEATURE_DEVELOPMENT
            if request.repository_path
            else TaskType.RESEARCH
        )

    def select_workflow(self, task_type: TaskType, request: TaskRequest) -> str:
        if request.workflow_id and request.workflow_id in self._workflows:
            return request.workflow_id
        return _WORKFLOW_BY_TYPE.get(task_type, "review_only")

    def infer_skills(self, request: TaskRequest) -> list[str]:
        haystack = self._haystack(request)
        skills: list[str] = []
        for keyword, skill in _SKILL_HINTS.items():
            if _matches(keyword, haystack) and skill not in skills:
                skills.append(skill)
        return skills

    def assess_risks(
        self,
        task_type: TaskType,
        workflow: WorkflowDefinition,
        request: TaskRequest,
    ) -> list[str]:
        risks: list[str] = []
        needs_repo = task_type in _CODE_EDITING_TYPES or any(
            phase.type == PhaseType.CLI_AGENT for phase in workflow.phases
        )
        if needs_repo and not request.repository_path:
            risks.append("repository_path が未指定のため実装フェーズを実行できません。")
        if len(request.description) < 15:
            risks.append("依頼内容が短く、要件が曖昧な可能性があります。")
        if len(request.target_files) > 20:
            risks.append("対象ファイルが多く、変更範囲が広くなる可能性があります。")
        if task_type == TaskType.RELEASE_PREPARATION:
            risks.append("リリース準備は本番影響があるため、人による確認を推奨します。")
        return risks

    def requires_approval(
        self,
        task_type: TaskType,
        request: TaskRequest,
        risks: list[str],
    ) -> bool:
        if request.approval_policy == ApprovalPolicy.ALWAYS:
            return True
        if request.approval_policy == ApprovalPolicy.NEVER:
            return False
        # DEFAULT policy: stay lenient (MVP), but pause for releases or when a
        # blocking risk was detected.
        return task_type == TaskType.RELEASE_PREPARATION or bool(risks)

    def route(self, request: TaskRequest, task_id: str) -> TaskPlan:
        task_type = self.classify(request)
        workflow_id = self.select_workflow(task_type, request)
        workflow = self._workflows.get(workflow_id) or get_workflow("review_only")
        assert workflow is not None  # review_only is always built-in
        risks = self.assess_risks(task_type, workflow, request)
        return TaskPlan(
            task_id=task_id,
            inferred_task_type=task_type,
            selected_workflow_id=workflow.id,
            phases=workflow.phase_ids(),
            required_agent_roles=workflow.required_roles(),
            required_skills=self.infer_skills(request),
            expected_artifacts=workflow.expected_artifacts(),
            risks=risks,
            requires_human_approval=self.requires_approval(task_type, request, risks),
        )

    @staticmethod
    def _haystack(request: TaskRequest) -> str:
        parts = [request.title or "", request.description, *request.constraints]
        # NFKC fold full-width ASCII (Ｐｙｔｈｏｎ -> python) and other
        # compatibility variants before lowercasing for keyword matching.
        return unicodedata.normalize("NFKC", "\n".join(parts)).lower()
