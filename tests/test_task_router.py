"""Unit tests for the Task intake router and workflow templates."""

import pytest

from app.intake import (
    ApprovalPolicy,
    TaskRequest,
    TaskRouter,
    TaskType,
    get_workflow,
    list_workflow_definitions,
)


@pytest.fixture
def router() -> TaskRouter:
    return TaskRouter()


@pytest.mark.parametrize(
    "description, expected",
    [
        ("ログイン画面のバリデーションを追加したい", TaskType.FEATURE_DEVELOPMENT),
        ("Android WebViewのblobダウンロードが壊れているので直したい", TaskType.BUG_FIX),
        ("このPRをレビューして問題ないか見てほしい", TaskType.CODE_REVIEW),
        ("既存コードをリファクタして整理したい", TaskType.REFACTOR),
        ("リリース準備をしたい", TaskType.RELEASE_PREPARATION),
        ("READMEのドキュメントを更新したい", TaskType.DOCUMENTATION),
        ("最新のライブラリを調査してほしい", TaskType.RESEARCH),
    ],
)
def test_classify_by_keyword(router: TaskRouter, description: str, expected: TaskType):
    assert router.classify(TaskRequest(description=description)) == expected


def test_classify_defaults_to_feature_when_repo_present(router: TaskRouter):
    req = TaskRequest(description="このリポジトリをよろしく", repository_path="/tmp/repo")
    assert router.classify(req) == TaskType.FEATURE_DEVELOPMENT


def test_classify_defaults_to_research_without_repo(router: TaskRouter):
    assert router.classify(TaskRequest(description="なんとなく")) == TaskType.RESEARCH


def test_route_feature_selects_feature_workflow(router: TaskRouter):
    req = TaskRequest(
        description="ログイン画面のバリデーションを追加したい",
        repository_path="/tmp/app",
    )
    plan = router.route(req, task_id="task-1")

    assert plan.task_id == "task-1"
    assert plan.inferred_task_type == TaskType.FEATURE_DEVELOPMENT
    assert plan.selected_workflow_id == "feature_development_default"
    assert plan.phases[0] == "spec"
    assert "implementation" in plan.phases
    assert "review" in plan.phases
    # roles and artifacts come from the workflow definition
    assert "implementer" in plan.required_agent_roles
    assert "architect" in plan.required_agent_roles
    assert "patch" in plan.expected_artifacts


def test_route_bug_fix_selects_bug_workflow(router: TaskRouter):
    req = TaskRequest(description="エラーが出るので修正して", repository_path="/tmp/app")
    plan = router.route(req, task_id="t")
    assert plan.inferred_task_type == TaskType.BUG_FIX
    assert plan.selected_workflow_id == "bug_fix_default"
    assert plan.phases[0] == "investigation"


def test_workflow_id_override_is_respected(router: TaskRouter):
    req = TaskRequest(
        description="エラーを修正して",
        repository_path="/tmp/app",
        workflow_id="review_only",
    )
    plan = router.route(req, task_id="t")
    # classification still bug_fix, but workflow honors the override
    assert plan.inferred_task_type == TaskType.BUG_FIX
    assert plan.selected_workflow_id == "review_only"


def test_unknown_workflow_override_is_ignored(router: TaskRouter):
    req = TaskRequest(
        description="ログイン画面を追加したい",
        repository_path="/tmp/app",
        workflow_id="does_not_exist",
    )
    plan = router.route(req, task_id="t")
    assert plan.selected_workflow_id == "feature_development_default"


def test_infer_skills_from_keywords(router: TaskRouter):
    req = TaskRequest(
        description="Android WebViewのblobダウンロードのjavascript bridgeを直す",
        repository_path="/tmp/app",
    )
    skills = router.infer_skills(req)
    assert "android_webview" in skills
    assert "blob_download" in skills
    assert "javascript_bridge" in skills


def test_missing_repo_is_flagged_as_risk_for_coding_task(router: TaskRouter):
    req = TaskRequest(description="ログイン画面のバリデーションを追加したい")
    plan = router.route(req, task_id="t")
    assert any("repository_path" in risk for risk in plan.risks)
    # a blocking risk under DEFAULT policy should require approval
    assert plan.requires_human_approval is True


def test_simple_review_does_not_require_approval(router: TaskRouter):
    req = TaskRequest(
        description="このコードをレビューして問題ないか見て",
        repository_path="/tmp/app",
    )
    plan = router.route(req, task_id="t")
    assert plan.requires_human_approval is False


def test_approval_policy_always_forces_approval(router: TaskRouter):
    req = TaskRequest(
        description="このコードをレビューして",
        repository_path="/tmp/app",
        approval_policy=ApprovalPolicy.ALWAYS,
    )
    plan = router.route(req, task_id="t")
    assert plan.requires_human_approval is True


def test_approval_policy_never_skips_approval_even_with_risk(router: TaskRouter):
    req = TaskRequest(
        description="追加して",  # short + missing repo => would normally be risky
        approval_policy=ApprovalPolicy.NEVER,
    )
    plan = router.route(req, task_id="t")
    assert plan.requires_human_approval is False


def test_builtin_workflows_present():
    ids = {w.id for w in list_workflow_definitions()}
    assert ids == {
        "feature_development_default",
        "bug_fix_default",
        "review_only",
        "design_review_default",
        "refactor_default",
        "documentation_default",
        "release_preparation_default",
    }


@pytest.mark.parametrize(
    "description, workflow_id",
    [
        ("既存コードをリファクタして整理したい", "refactor_default"),
        ("READMEのドキュメントを更新したい", "documentation_default"),
        ("リリース準備をしたい", "release_preparation_default"),
        ("この設計を見てアーキの観点でdesign reviewして", "design_review_default"),
        ("最新ライブラリを調査して", "review_only"),
    ],
)
def test_task_type_maps_to_expected_workflow(router, description, workflow_id):
    plan = router.route(TaskRequest(description=description, repository_path="/tmp/app"), task_id="t")
    assert plan.selected_workflow_id == workflow_id


@pytest.mark.parametrize(
    "description, skill",
    [
        ("FastAPIのpythonエンドポイントを追加", "python_dev"),
        ("ログイン認証を実装したい", "auth"),
        ("セキュリティのレビューをして", "security_review"),
        ("Kotlinで実装", "android_dev"),
    ],
)
def test_skill_hints_extended(router, description, skill):
    req = TaskRequest(description=description, repository_path="/tmp/app")
    assert skill in router.infer_skills(req)


def test_every_mapped_workflow_exists():
    # routing must never select a workflow id that is not built-in
    from app.intake.router import _WORKFLOW_BY_TYPE
    from app.intake.workflows import BUILTIN_WORKFLOWS

    for workflow_id in _WORKFLOW_BY_TYPE.values():
        assert workflow_id in BUILTIN_WORKFLOWS


def test_get_workflow_roles_and_artifacts_dedup():
    workflow = get_workflow("feature_development_default")
    assert workflow is not None
    # architect appears in several phases but only once in the union
    assert workflow.required_roles().count("architect") == 1
    assert "requirements" in workflow.expected_artifacts()


def test_blank_description_rejected():
    with pytest.raises(ValueError):
        TaskRequest(description="   ")
