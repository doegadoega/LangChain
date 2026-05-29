# LangChain ブラッシュアップ設計メモ

## 目的

現在の `doegadoega/LangChain` を、複数AIによる文章推敲・コーディング支援ツールから、**AI Agent Development OS** に発展させる。

目指す体験は以下。

```text
ユーザーがタスクを雑に投げる
↓
システムがタスクを理解する
↓
必要なWorkflow / Phase / Agent / Skillを自動選定する
↓
Agent同士が会話しながら仕様・設計・実装方針を詰める
↓
実装する
↓
動作確認する
↓
レビューする
↓
成果物・判断・入出力履歴を保存する
```

重要なのは、ユーザーが最初からAgentを意識しなくてよいこと。

```text
悪いUX:
  「PO AgentとArchitect AgentとCodex Agentにこの順で依頼してください」

良いUX:
  「ログイン画面のバリデーションを追加したい」
  「このリポジトリを見て、仕様検討からPR前レビューまでやって」
  「この設計、実装できる形に落として」
```

システム側が、裏で必要なAgent・Workflow・Skill・Artifactを組み立てる。

---

# 1. 中心概念をRefineからTaskへ変える

現状の中核は以下に近い。

```text
RefineRequest
  -> rounds
  -> turns
  -> final_text
```

今後の中核は以下にする。

```text
Task
  -> WorkflowRun
  -> PhaseRun
  -> AgentRun
  -> Artifact
  -> Gate
  -> Decision
```

つまり、ユーザーが投げる単位は `Agentへの依頼` ではなく **Task**。

---

# 2. Task Intakeを作る

ユーザー入力を最初に受ける層を `Task Intake` として設計する。

## Task Intakeの責務

```text
- ユーザーの依頼を受け取る
- タスク種別を分類する
- 必要なWorkflowを選ぶ
- 必要なArtifactを推定する
- 必要なAgent Roleを選ぶ
- 実行前にPlanを作る
- 必要ならHuman Approvalを挟む
```

## Task分類例

```text
feature_development
bug_fix
refactor
design_review
code_review
qa_verification
research
documentation
release_preparation
```

## TaskRequestモデル案

```python
class TaskRequest(BaseModel):
    title: str | None = None
    description: str
    repository_path: str | None = None
    base_branch: str | None = None
    target_files: list[str] = []
    constraints: list[str] = []
    desired_outputs: list[str] = []
    priority: str = "normal"
    approval_policy: str = "default"
```

## TaskPlanモデル案

```python
class TaskPlan(BaseModel):
    task_id: str
    inferred_task_type: str
    selected_workflow_id: str
    phases: list[str]
    required_agent_roles: list[str]
    required_skills: list[str]
    expected_artifacts: list[str]
    risks: list[str]
    requires_human_approval: bool
```

---

# 3. Agentはユーザーが直接選ばない

ユーザーはAgent IDを知らなくてよい。

Agentは内部リソースとして扱う。

```text
User
  ↓
Task Intake
  ↓
Workflow Router
  ↓
Agent Matcher
  ↓
Agent Runtime
```

例えば、ユーザーがこう言う。

```text
Android WebViewのblobダウンロード処理が壊れているので直したい
```

システムは裏でこう判断する。

```yaml
task_type: bug_fix
workflow: mobile_bug_fix_default
phases:
  - investigation
  - reproduction_plan
  - implementation_plan
  - implementation
  - verification
  - review
agent_roles:
  - repository_scout
  - mobile_architect
  - android_implementer
  - qa
  - reviewer
skills:
  - android_webview
  - javascript_bridge
  - git_diff_review
artifacts:
  - investigation_report.md
  - implementation_plan.md
  - diff.patch
  - test_report.md
  - review.md
```

---

# 4. Task Routerを追加する

Task Routerは、依頼内容からWorkflowを選ぶ。

## 例

```python
class TaskRouter:
    def route(self, request: TaskRequest) -> TaskPlan:
        task_type = self.classify_task(request)
        workflow_id = self.select_workflow(task_type, request)
        roles = self.select_required_roles(task_type, request)
        skills = self.infer_required_skills(request)
        artifacts = self.expected_artifacts(workflow_id)
        return TaskPlan(...)
```

## ルール例

```yaml
routing_rules:
  - when:
      contains_any:
        - "実装"
        - "追加"
        - "作って"
        - "画面"
    task_type: feature_development
    workflow: mobile_feature_default

  - when:
      contains_any:
        - "壊れている"
        - "動かない"
        - "エラー"
        - "修正"
    task_type: bug_fix
    workflow: bug_fix_default

  - when:
      contains_any:
        - "レビュー"
        - "見て"
        - "問題ないか"
    task_type: code_review
    workflow: review_only
```

---

# 5. Workflowはテンプレート化する

Agentへ直接依頼するのではなく、Workflowテンプレートを選ぶ。

## feature_development_default

```yaml
id: feature_development_default
name: Feature Development

phases:
  - id: spec
    type: discussion
    participants:
      - product_owner
      - ux_designer
      - architect
      - qa
    outputs:
      - requirements
      - acceptance_criteria

  - id: design
    type: discussion
    participants:
      - ux_designer
      - ui_designer
      - architect
    outputs:
      - screen_spec

  - id: implementation_plan
    type: single_agent
    agent_role: architect
    outputs:
      - implementation_plan

  - id: implementation
    type: cli_agent
    agent_role: implementer
    sandbox: git_worktree
    outputs:
      - patch
      - implementation_notes

  - id: verification
    type: command
    outputs:
      - test_report

  - id: review
    type: discussion
    participants:
      - reviewer
      - qa
      - architect
    outputs:
      - code_review
```

## bug_fix_default

```yaml
id: bug_fix_default
name: Bug Fix

phases:
  - id: investigation
    type: single_agent
    agent_role: repository_scout
    outputs:
      - investigation_report

  - id: reproduction
    type: single_agent
    agent_role: qa
    outputs:
      - reproduction_plan

  - id: implementation_plan
    type: single_agent
    agent_role: architect
    outputs:
      - implementation_plan

  - id: implementation
    type: cli_agent
    agent_role: implementer
    sandbox: git_worktree
    outputs:
      - patch

  - id: verification
    type: command
    outputs:
      - test_report

  - id: review
    type: discussion
    participants:
      - reviewer
      - qa
    outputs:
      - review
```

## review_only

```yaml
id: review_only
name: Review Only

phases:
  - id: repository_scan
    type: single_agent
    agent_role: repository_scout
    outputs:
      - repository_summary

  - id: review
    type: discussion
    participants:
      - reviewer
      - architect
      - qa
    outputs:
      - review
```

---

# 6. Agent Matcherを作る

Workflowは `agent_role` を要求する。

実際にどのAgentを使うかは `Agent Matcher` が決める。

```text
Workflow:
  needs: architect

Agent Matcher:
  candidates:
    - agent.mobile_architect
    - agent.swift_architect
    - agent.web_architect

Selected:
  agent.mobile_architect
```

## Agent Matcherの評価軸

```text
- roleが一致しているか
- required_skillsを持っているか
- repositoryの技術スタックに合っているか
- 過去Runの成功率
- コスト
- 現在利用可能なProvider
- CLI Agentが必要か
- ローカル実行が必要か
```

## AgentProfile例

```yaml
id: agent.android_webview_specialist
display_name: Android WebView Specialist
phase_roles:
  - architect
  - implementer
discipline:
  - android
  - mobile
skills:
  - android_webview
  - javascript_bridge
  - blob_download
providers:
  preferred: claude_cli
  fallback:
    - codex_cli
    - gemini_cli
permissions:
  read_repository: true
  edit_repository: true
  run_tests: true
```

---

# 7. Artifact中心にする

会話ログではなくArtifactを次工程に渡す。

```text
User Request
  ↓
task_plan.json
  ↓
requirements.md
  ↓
screen_spec.md
  ↓
implementation_plan.md
  ↓
diff.patch
  ↓
test_report.md
  ↓
review.md
```

## Artifactモデル案

```python
class ArtifactType(str, Enum):
    TASK_PLAN = "task_plan"
    REQUIREMENTS = "requirements"
    ACCEPTANCE_CRITERIA = "acceptance_criteria"
    USER_FLOW = "user_flow"
    SCREEN_SPEC = "screen_spec"
    DESIGN_SPEC = "design_spec"
    IMPLEMENTATION_PLAN = "implementation_plan"
    PATCH = "patch"
    TEST_REPORT = "test_report"
    QA_REPORT = "qa_report"
    CODE_REVIEW = "code_review"
    DECISION_LOG = "decision_log"
    PR_BODY = "pr_body"

class Artifact(BaseModel):
    id: str
    task_id: str
    phase_run_id: str
    agent_run_id: str | None = None
    type: ArtifactType
    title: str
    path: str | None = None
    content: str
    content_hash: str
    created_at: datetime
    metadata: dict[str, Any] = {}
```

---

# 8. AgentSnapshot / AgentRun Ledgerを保存する

各Agentが何を受け取り、何を出したかを保存する。

## AgentSnapshot

```python
class AgentSnapshot(BaseModel):
    id: str
    name: str
    phase_roles: list[str]
    discipline: list[str]
    provider: str
    model: str | None
    persona: str
    skills: list[str]
    skill_refs: list[dict]
    permissions: dict[str, Any] = {}
    mcp_enabled: bool
    mcp_servers: list[str]
    allow_web_search: bool
    research_sources: list[str]
    prompt_hash: str | None = None
```

## AgentRun

```python
class AgentRun(BaseModel):
    id: str
    task_id: str
    phase_run_id: str
    agent_snapshot: AgentSnapshot
    input_artifacts: list[str]
    input_text: str
    system_prompt: str
    output_text: str
    output_artifacts: list[str]
    tool_calls: list[dict] = []
    status: str
    error: str | None = None
    started_at: datetime
    finished_at: datetime | None
```

これで以下を追える。

```text
誰が
どんな人格で
どんなSkillを持ち
どのProvider/Modelで
どんな指示を受け
どんなOutputを出し
どんなToolを使い
どんなArtifactを作ったか
```

---

# 9. Gateを状態機械として実装する

各Phaseの終了条件を明示する。

```python
class GateDecision(str, Enum):
    PASS = "pass"
    REWORK = "rework"
    ESCALATE = "escalate"
    BLOCKED = "blocked"

class GateResult(BaseModel):
    phase_id: str
    decision: GateDecision
    reasons: list[str]
    required_rework: list[str] = []
    approved_by: list[str] = []
```

## 状態遷移

```text
PENDING
  ↓
RUNNING
  ↓
PASSED
  or
REWORK
  or
ESCALATED
  or
FAILED
```

MVPではGateを厳しくしすぎない。

```yaml
qa_policy:
  mode: flexible
  required_reviewers: 1
  strict_mode:
    required_reviewers: 3
    require_all_pass: true
```

---

# 10. Output Contractを導入する

Agentの自由文出力だけにすると次工程で壊れる。

各PhaseごとにJSON出力を定義し、それをMarkdown Artifactへ変換する。

## 仕様整理Agent出力例

```json
{
  "summary": "ログイン画面に入力バリデーションを追加する",
  "requirements": [
    {
      "id": "REQ-001",
      "description": "メールアドレスが空の場合、エラーを表示する",
      "priority": "must"
    }
  ],
  "acceptance_criteria": [
    {
      "id": "AC-001",
      "given": "メールアドレスが空",
      "when": "ログインボタンを押す",
      "then": "メールアドレス必須エラーが表示される"
    }
  ],
  "open_questions": [],
  "blocking_issues": []
}
```

## Review Agent出力例

```json
{
  "decision": "PASS",
  "blocking_issues": [],
  "suggestions": [
    {
      "id": "SUG-001",
      "severity": "minor",
      "file": "LoginViewModel.swift",
      "description": "テストケース名をより具体的にできる"
    }
  ],
  "summary": "仕様を満たしており、blocking issueはありません"
}
```

---

# 11. Worktree情報を保存する

AIが原本リポジトリを直接変更しないように、worktree分離は維持する。

追加で以下を保存する。

```text
worktree_id
base_commit
ai_branch
dirty_files_snapshot
applied_user_diff_hash
final_diff_hash
test_command_result
```

## VersionControlSnapshot案

```python
class VersionControlSnapshot(BaseModel):
    id: str
    workflow_run_id: str
    phase_run_id: str
    repo_path: str
    worktree_path: str
    base_branch: str
    base_commit: str
    ai_branch: str
    initial_status: str
    final_status: str | None = None
    final_diff_hash: str | None = None
```

---

# 12. PromptBuilderを分割する

Prompt組み立ては肥大化しやすい。

以下のように分割する。

```text
app/prompting/
  builder.py
  sections/
    agent_identity.py
    skills.py
    mcp.py
    research.py
    code_context.py
    knowledge_context.py
    artifacts.py
    output_contract.py
```

Prompt構造は以下にする。

```text
1. Agent Identity
2. Role / Personality
3. Skills
4. Permissions
5. Task
6. Phase Goal
7. Input Artifacts
8. Repository Context
9. Output Contract
10. Quality Criteria
11. Response Format
```

---

# 13. 推奨ディレクトリ構成

```text
app/
  main.py

  models/
    agent.py
    skill.py
    task.py
    workflow.py
    artifact.py
    run.py
    gate.py

  intake/
    task_intake.py
    task_router.py

  orchestration/
    workflow_runner.py
    phase_runner.py
    conversation_runner.py
    gate_evaluator.py
    model_router.py
    agent_matcher.py

  prompting/
    builder.py
    output_contracts.py
    sections/
      agent_identity.py
      skills.py
      mcp.py
      research.py
      code_context.py
      knowledge_context.py
      artifacts.py
      output_contract.py

  providers/
    base.py
    cli.py
    ollama.py
    lm_studio.py

  storage/
    artifact_store.py
    run_store.py
    agent_store.py

  git/
    worktree.py
    diff.py

  api/
    tasks.py
    workflows.py
    agents.py
    artifacts.py
    runs.py
    refine.py
```

既存の `app/orchestrator.py` は最終的に以下へ分割する。

```text
app/orchestration/conversation_runner.py
app/orchestration/workflow_runner.py
app/orchestration/phase_runner.py
app/prompting/builder.py
app/git/diff.py
```

---

# 14. 追加したいAPI

## Task投入

```http
POST /api/tasks
```

```json
{
  "description": "ログイン画面のバリデーションを追加したい",
  "repository_path": "/path/to/repo",
  "base_branch": "main"
}
```

## Task Plan確認

```http
POST /api/tasks/plan
```

## Workflow実行

```http
POST /api/workflows/run/stream
```

## Run詳細

```http
GET /api/runs/{run_id}
GET /api/runs/{run_id}/events
GET /api/runs/{run_id}/artifacts
GET /api/runs/{run_id}/agent-runs
```

## Artifact取得

```http
GET /api/artifacts/{artifact_id}
```

## Agent履歴

```http
GET /api/agents/{agent_id}/runs
```

---

# 15. CLI案

ユーザーはAgentを意識せず、タスクを投げる。

```bash
agent-os task "ログイン画面のバリデーションを追加したい" --repo /path/to/app
agent-os plan <task_id>
agent-os run <task_id> --stream
agent-os show <run_id>
agent-os artifacts <run_id>
agent-os agent-runs <run_id>
```

詳細指定したい場合だけWorkflowを指定する。

```bash
agent-os task "Android WebViewのblobダウンロードを修正" \
  --repo /path/to/app \
  --workflow bug_fix_default
```

---

# 16. Run保存レイアウト案

最初はDBなしでファイル保存でもよい。

```text
~/.agent-refinement/tasks/<task_id>/
  task.json
  task_plan.json

~/.agent-refinement/runs/<run_id>/
  run.json
  events.ndjson

  phases/
    01-intake/
      phase.json
      artifacts/
        task_plan.json

    02-spec/
      phase.json
      agent-runs/
        001-product-owner.json
        002-ux-designer.json
        003-architect.json
      artifacts/
        requirements.md
        acceptance_criteria.md
        decision_log.md

    03-design/
      phase.json
      agent-runs/
        001-ux-designer.json
        002-ui-designer.json
      artifacts/
        user_flow.md
        screen_spec.md

    04-implementation-plan/
      phase.json
      agent-runs/
        001-architect.json
      artifacts/
        implementation_plan.md

    05-implementation/
      phase.json
      worktree.json
      agent-runs/
        001-codex-implementer.json
      artifacts/
        diff.patch
        implementation_notes.md

    06-verification/
      phase.json
      artifacts/
        test_report.md

    07-review/
      phase.json
      agent-runs/
        001-reviewer.json
        002-qa.json
      artifacts/
        code_review.md
        qa_report.md

  prompts/
    001-product-owner-system.md
    002-ux-designer-system.md
    003-architect-system.md

  outputs/
    001-product-owner.md
    002-ux-designer.md
    003-architect.md
```

---

# 17. DB設計案

DB化する場合の最小テーブルは以下。

```text
tasks
task_plans
agents
skills
workflow_runs
phase_runs
agent_runs
artifacts
gate_results
decisions
```

## tasks

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT NOT NULL,
  task_type TEXT,
  repository_path TEXT,
  base_branch TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

## task_plans

```sql
CREATE TABLE task_plans (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  inferred_task_type TEXT NOT NULL,
  selected_workflow_id TEXT NOT NULL,
  phases_json JSONB NOT NULL,
  required_agent_roles_json JSONB NOT NULL,
  required_skills_json JSONB NOT NULL,
  expected_artifacts_json JSONB NOT NULL,
  risks_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

## agents

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  phase_roles_json JSONB NOT NULL,
  discipline_json JSONB NOT NULL,
  personality_id TEXT,
  model_provider TEXT NOT NULL,
  model_name TEXT,
  permissions_json JSONB NOT NULL,
  config_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

## workflow_runs

```sql
CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_phase_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

## phase_runs

```sql
CREATE TABLE phase_runs (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  phase_id TEXT NOT NULL,
  phase_name TEXT NOT NULL,
  status TEXT NOT NULL,
  input_artifact_ids_json JSONB NOT NULL,
  output_artifact_ids_json JSONB NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
```

## agent_runs

```sql
CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  phase_run_id TEXT NOT NULL REFERENCES phase_runs(id),
  agent_id TEXT NOT NULL,
  agent_snapshot_json JSONB NOT NULL,
  input_text TEXT,
  input_artifact_ids_json JSONB NOT NULL,
  system_prompt TEXT NOT NULL,
  output_text TEXT,
  output_artifact_ids_json JSONB NOT NULL,
  tool_calls_json JSONB,
  status TEXT NOT NULL,
  error_message TEXT,
  token_input INTEGER,
  token_output INTEGER,
  cost_usd NUMERIC,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ
);
```

## artifacts

```sql
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  phase_run_id TEXT REFERENCES phase_runs(id),
  agent_run_id TEXT REFERENCES agent_runs(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT,
  content_hash TEXT NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL
);
```

---

# 18. 最小改修ロードマップ

## Sprint 1: Task Intake + Task Plan

目的：ユーザーがAgentを意識せずタスクを投げられるようにする。

やること：

```text
- TaskRequest追加
- TaskPlan追加
- TaskRouter追加
- Workflow template追加
- /api/tasks/plan 追加
```

成果：

```text
「ログイン画面を直したい」
↓
feature_development_default
↓
spec / design / plan / implementation / verification / review
```

---

## Sprint 2: AgentRun Ledger + AgentSnapshot

目的：誰が何をしたか追跡できるようにする。

やること：

```text
- AgentSnapshot追加
- AgentRun追加
- RunStore追加
- system_prompt / input / output / error / timestamp保存
```

成果：

```text
Agentごとの指示・人格・Skill・Provider・Outputを保存できる
```

---

## Sprint 3: Artifact Store

目的：会話ログではなく成果物を次工程に渡す。

やること：

```text
- Artifactモデル追加
- ArtifactStore追加
- output_jsonからMarkdown Artifact生成
- final_text依存を減らす
```

成果：

```text
requirements.md
implementation_plan.md
diff.patch
review.md
を保存・参照できる
```

---

## Sprint 4: Workflow / Phase Runner

目的：工程としてタスクを進める。

やること：

```text
- WorkflowDefinition追加
- PhaseDefinition追加
- WorkflowRunner追加
- PhaseRunner追加
- 既存orchestratorをconversation phaseとして再利用
```

成果：

```text
spec -> design -> implementation_plan -> implementation -> verification -> review
を順番に実行できる
```

---

## Sprint 5: Gate / Review Loop

目的：レビュー結果に応じて差し戻せるようにする。

やること：

```text
- GateResult追加
- PASS / REWORK / ESCALATE導入
- Review Agentの出力をJSON契約化
- REWORK時にimplementation phaseへ戻す
```

成果：

```text
レビューでblocking issueがあれば実装修正に戻せる
```

---

## Sprint 6: DashboardをTask / Run中心にする

目的：UIで進捗と履歴を見やすくする。

画面：

```text
Task Detail
  - Task Plan
  - Current Phase
  - Workflow Timeline
  - Artifacts
  - Agent Runs
  - Decisions
  - Logs

Agent Detail
  - Persona
  - Skills
  - Past Runs
  - Success Rate
  - Cost

Artifact Viewer
  - requirements.md
  - implementation_plan.md
  - diff.patch
  - review.md
```

---

# 19. 最初のPR候補

最初に入れるなら、以下がよい。

```text
feat: add task intake and planning layer
```

含める変更：

```text
1. TaskRequest model
2. TaskPlan model
3. TaskRouter
4. Workflow template定義
5. /api/tasks/plan
6. CLI: agent-os task / agent-os plan
```

理由：

```text
ユーザーがAgentを意識せずにタスクを投げる体験が作れる
既存Agent実行エンジンを壊さず追加できる
Workflow化への入口になる
```

次のPR：

```text
feat: persist agent run ledger with agent snapshots
```

含める変更：

```text
1. AgentSnapshot model
2. AgentRun model
3. RunStore
4. prompts保存
5. outputs保存
6. agent_runs保存
```

---

# 20. 結論

今後の方針は以下。

```text
Agentを直接選ばせるUIではなく、
Taskを投げるUIにする。

Task Intakeが依頼を分類し、
Workflow Routerが工程を選び、
Agent Matcherが必要なAgentを割り当て、
Workflow RunnerがPhaseを進め、
Artifact Storeが成果物を管理し、
AgentRun Ledgerが入出力履歴を保存する。
```

最短で価値を出す順番は以下。

```text
1. Task Intake / Task Router
2. Task Plan表示
3. AgentRun Ledger
4. Artifact Store
5. Workflow / Phase Runner
6. Gate / Review Loop
7. Dashboard
```

これにより、ユーザーはこう使える。

```bash
agent-os task "Android WebViewのblobダウンロードが動かないので直して" --repo /path/to/app
```

裏側では、システムが自動で以下を行う。

```text
bug_fix_default workflowを選ぶ
Repository Scoutを走らせる
QAが再現観点を作る
Architectが修正方針を作る
Implementerがworktreeで実装する
Test Runnerが動作確認する
Reviewerがdiffを見る
ArtifactとAgentRunを保存する
```

この形にすると、エージェント管理の複雑さをユーザーから隠しつつ、内部ではID / Skill / Personality / Provider / 入出力履歴をきちんと管理できる。
