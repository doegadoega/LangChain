# TODO

## Workspace request management — 残作業

段階A（ワークスペース一覧の store 化、新規登録・編集・削除、起動時自動取得、左ペイン管理UI）まで完了。
Workspace 画面では、複数の依頼内容をワークスペースとして登録し、左ペイン一覧から読み込み、編集・削除できる。
中央ペインはコンテンツモードとして `作成・編集` / `エージェント進捗` / `履歴` を切り替える。
`作成・編集` では実行チームを Built-in / Custom テンプレートから選択し、選択したエージェント構成をワークへコピーできる。
右ペインは `レビュー・ログ` としてフィードバック、会話ログ、イベント、JSON確認に限定する。
ワークスペース内で `original_request` / `previous_request` / `versions[]` を保持し、実行結果をローカルバージョンとして管理できる。
`coding` モードでは Workspace から code context を編集し、エージェントにコーディング相談・修正方針作成を依頼できる。

### 段階B: フィードバックを store-backed に統一

- Status: done
- Priority: high
- Owner: Codex

実装済み。`feedbackText` は入力中ドラフトとしてローカル state のまま残し、保存済みフィードバックは `managedRequests[].verification_feedback` を単一ソースとして扱う。

やること:

- [x] フィードバック追加・削除を store のアクション経由で `managedRequests` を直接更新する
- [x] 「フィードバック追加 → 保存」を 1 アクションにまとめる
- [x] 他画面（Logs, QAGate）も同じソースを参照するよう統一
- [x] 入力中のドラフト（未送信コメント）は引き続きローカル state で管理

完了条件:

- 別画面に切替えてもフィードバックが消えない
- リロードしても保存済みフィードバックが残る
- 削除も即時 API に反映

### 段階C: per-request 並列実行

- Status: pending
- Priority: medium
- Owner: unassigned

現状 `run: RunState` がグローバル 1 件で、複数依頼の同時実行ができない。

やること:

- `run` を `runs: Map<requestId, RunState>` に置換
- `abortCtrl` も `Map<requestId, AbortController>` 化
- `startRun(id)` / `stopRun(id)` を request id 引数化
- イベントストリームの紐付けを `request.id` 単位に
- Workspace UI で「複数同時実行中」のバッジ表示
- Logs / Execution / QAGate も `runs.get(currentId)` を参照する形へ追従

リスク:

- 786 行ある Workspace.tsx と 約 830 行の [store.ts](../app/web/src/state/store.ts) に広く触る大きめリファクタ
- イベントストリームの取り違えが起こると全画面に波及するため、慎重なテストが必要

### 段階D: Team Picker（per-request team selection）

- Status: in progress
- Priority: medium
- Owner: Codex

Codex が `ManagedRequest.template_id` を追加し、`Template` に `workflow_mode` / `orchestration_mode` / `rounds` / `is_builtin` / `locked` / `category` も拡張済み。

完了済み:

- [x] `ManagedRequest` に `template_id?: string` を追加
- [x] Template から workflow_mode / orchestration_mode / rounds をクローン展開できるようにする

残り:

- [ ] Workspace 中央ペインに Template Picker を UI として配置（ManagedRequest 切替時に template_id を読み込む）
- [ ] Template 編集後、紐づく依頼に追従するか・ピン留めするか挙動を決める
- [ ] Template 削除時の依頼側挙動（孤児化を許すか自動デタッチするか）

### 段階E: ワークスペース版管理

- Status: in progress
- Priority: medium
- Owner: Codex

Codex が `ManagedRequest.original_request` / `previous_request` / `versions[]` と `WorkspaceVersion` 型を追加。実行結果をバージョン単位で保存できるようになっている。

残り:

- [ ] `WorkspaceVersion` の差分表示 UI（前バージョンとの diff）
- [ ] 任意のバージョンへ「巻き戻し」できる UI
- [ ] CLI 側の `runs/<request_id>/v<n>/` レイアウトを `WorkspaceVersion` と 1:1 対応させる（CLI 仕様書側で詳細化）

## Agent Studio 機能追加

### 新規登録にテンプレート機能

- Status: pending
- Priority: high
- Owner: unassigned

新規エージェント作成時に、目的別テンプレートから雛形を選べるようにする。

やること:

- エージェント用テンプレートを定義（`AgentTemplate`：name / org_role / provider / persona / skills / mcp 設定 などの初期値）
- AgentStudio の「新規」ボタン横にテンプレートピッカーを追加
- 選択するとフォームに初期値が流し込まれる
- builtin と user 作成テンプレートを混在表示
- Backend に `/api/agent-templates` CRUD（または当面 frontend bundled のみ）

検討事項:

- 既存の Team `Template` と命名衝突しないように `AgentTemplate` で別物として扱う
- スキル系は Skill Package Manager 完了後は SkillReference を初期値に入れる

### Built-in エージェントも参照できるようにする

- Status: in progress
- Priority: medium
- Owner: unassigned

現状 `defaultAgents()` が code 側に hard-coded。

完了済み:

- [x] Team 編成画面の候補プールに built-in を併合表示（`is_custom === false` を Built-in バッジで識別）
- [x] `builtinAgents()` を store から export

残り:

- [ ] Agent Studio 側でも built-in を一覧表示（読み取り専用 / コピー編集）
- [ ] `is_builtin: true` フラグを `AgentConfig` に正式追加し、`is_custom` 反転で判定する曖昧さを解消
- [ ] 削除ガード（Mac 側と同じ「Delete default agent is blocked」相当）

## コーディング機能

- Status: pending
- Priority: high
- Owner: unassigned

現状の `workflow_mode=coding` は Web UI 側ではプロンプト切替のみ。実コード生成・パッチ適用が UI から完結しない。

やること:

- Workspace から作業ディレクトリ（working_directory）を指定して実行
- Code Context（target_paths / tech_stack / acceptance_criteria / test_command）を Workspace 中央ペインで編集できる
- 実行後に file_changes を diff ビューアで表示
- diff の適用 / 破棄 / コミット作成（git）の操作 UI

検討事項:

- パッチ適用は CLI provider（codex / claude / gemini）経由か、別途 patch エンドポイントを持つか
- リスク：作業ディレクトリ外への書き込みが起きないようバックエンドで sandbox を強制

## Advanced Run

ローカル LLM で要件を整理 → CLI エージェントでレビュー → 設計書に従って実装 を 1 フローにする。

### A. チーム選択

- Status: pending
- Priority: high
- Owner: unassigned

Advanced Run 起動時に、保存済み Team Template から実行チームを選択できる。
Team Picker の実装は Workspace 段階D と同じ仕組みを共有する想定。

### B. 作業ディレクトリ選択

- Status: pending
- Priority: high
- Owner: unassigned

OS のフォルダピッカー（macOS native は Mac app 側で `NSOpenPanel`、Web 側は手入力 + 履歴）から作業ディレクトリを選び、`code_context.working_directory` に注入。

### C. 要件定義チャット（ローカル LLM）

- Status: pending
- Priority: high
- Owner: unassigned

ユーザの曖昧なリクエストをローカル LLM（LM Studio / Ollama）が対話で吸収し、構造化された要件定義（Spec）を生成する。

やること:

- Advanced Run 内に専用チャット UI を配置
- セッション内のメッセージ履歴を保持し、最終出力を「要件定義 Markdown」として確定
- 要件定義は `ManagedRequest.spec` のような新フィールドに保存（`docs/designs/` への永続化はオプション）
- 既定モデルは `qwen2.5-coder-3b-instruct`（[setup/superpowers-local-llm.md](setup/superpowers-local-llm.md) と統一）

### D. 要件定義レビュー（CLI エージェント）

- Status: pending
- Priority: high
- Owner: unassigned

C で確定した要件定義を Codex / Gemini / Claude Code などの CLI エージェントが並列レビューし、抜け漏れ・矛盾・実装リスクを指摘する。

やること:

- レビュアーは Team Template から選択（複数並列）
- 各レビュアー出力を仕様書の脇に並べて diff ライクに表示
- ユーザが採用するコメントを選別し、要件定義を更新するループ

### E. 設計書に基づいて作業を開始

- Status: pending
- Priority: high
- Owner: unassigned

確定した要件定義 + 作業ディレクトリを入力として、コーディングエージェント（Codex CLI 等）が作業を開始し、生成された file_changes を diff ビューアに返す。「コーディング機能」項目との統合実装が望ましい。

やること:

- Advanced Run 完了画面に「この設計書で作業開始」ボタンを置く
- 押下時、現在の依頼に紐づく作業ディレクトリと要件定義 Markdown をプロンプトに注入して `startRun` を呼ぶ
- D のレビュー結果（採用コメント）も追加コンテキストとして同梱
- 進捗は通常の Workspace ストリーム（turn_started / turn_completed）に流す

## Provider 拡充

### OpenAI / Anthropic API プロバイダ

- Status: done (Codex)
- Priority: high
- Owner: Codex

Codex が `ProviderKind.OPENAI_API = "openai_api"` / `ProviderKind.ANTHROPIC_API = "anthropic_api"` を追加済み。Codex CLI / Claude Code とは別契約・別経路で並列利用できる。

残り:

- [ ] README §3 の export 例に `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / 各 base_url を追記
- [ ] `list_provider_models` の動作確認（OpenAI は `/v1/models`、Anthropic はハードコード or `/v1/models` β対応）
- [ ] uvicorn の再起動が必要（前回 `--reload` なしで起動しているため）

## Orchestration CLI

[orchestration-cli.md](specs/orchestration-cli.md) を参照。仕様確定後にサブコマンド（init / team / plan / run / show / list / resume）を実装する。

## 開発の優先方針

- **Web / Python アプリを正本**として開発する
- **Mac アプリは Web 版が完成した後にトレース移植する**（Web → Mac の片方向）
- Mac 側に既にあるコード（Skill Package Manager 等）は設計参考として残すが、新機能は Web で先に作る
- Web で確立した API / モデル / UI を Mac に写し取る形で Mac 版を再構築

## Skill Package Manager — Web/Python 実装

実装ブリーフ: [skill-management-web-python-brief.md](specs/skill-management-web-python-brief.md)
設計参照: [skill-package-manager.md](specs/skill-package-manager.md)（Mac 側の正本仕様）

### Phase 1: Backend（最優先）

- Status: pending
- Priority: high
- Owner: 未定（ブリーフ末尾の Claude Code 用プロンプトを利用）

ブリーフ §「Backend Implementation Plan」+ §「API Plan」と完全一致。

- [ ] `app/skills/{models,parser,store,resolver}.py`
- [ ] `AgentConfig.skill_refs: list[SkillReference]` を追加（既存 `skills: list[str]` 併存・後方互換維持）
- [ ] `app/orchestrator.py` に解決結果を注入
- [ ] `/api/skills` 系最小 API（一覧 / install / 削除 / candidates / approve / discard）
- [ ] テスト（parser / store / resolver / API / orchestrator 注入）

### Phase 2: Web UI

- Status: done
- Priority: high

完了済み:

- [x] Skill Library 画面（[Skills.tsx](../app/web/src/screens/Skills.tsx)）
- [x] Candidates タブ（取り込み / 承認 / 破棄）
- [x] Agent Studio の `skill_refs` エディタ（version 要求 / enabled / 不適合警告）

### Phase 3: 取り込み導線（GitHub / AI 探索）

- Status: pending
- Priority: medium

ブリーフでは「first pass の対象外」と明記。Phase 1〜2 が動いた後に着手。

- [ ] GitHub URL → `git clone --depth=1` → Candidates、commit SHA 固定
- [ ] AI 候補探索（候補追加のみ、自動インストール禁止）
- [ ] バンドル Skill の初回起動 bootstrap（`./skills/default/`）

### Phase 4: 拡張

- Status: pending
- Priority: low

- [ ] SemVer 比較、`latestCompatible` の正式実装（現状は文字列降順）
- [ ] 候補バッチの空ディレクトリ掃除
- [ ] CLI（`orchestrate run`）が同じ Skill Store を参照するよう統合（[orchestration-cli.md](specs/orchestration-cli.md) §3.4）

## Mac アプリ — Web 完成後にトレース移植

Web 版完成後に着手するフェーズ。Web 側で確定したスキーマ・API・UI を Mac に写し取る。

- Status: deferred
- Priority: low（Web 完成までブロック）
- Owner: 未定

トレース対象（Web 側で実装が落ち着いたら確定する）:

- [ ] ManagedRequest / WorkspaceVersion / Template / Skill 系モデル
- [ ] `/api/requests` 等のバックエンド I/F を `SidecarManager` 経由 or 直接呼び出し
- [ ] Workspace / Team Composer / Agent Studio / Skill Library 画面の SwiftUI 移植
- [ ] Orchestration CLI と同じ `run.md` / `team.md` フォーマットを Mac 側でも開ける

既存 Mac コードの扱い:

- 設計書として保持（[skill-package-manager.md](specs/skill-package-manager.md) など）
- 新機能の追実装はしない
- Web 完成時点でディレクトリ構造をリセットしてトレース移植開始する選択肢もあり

## Backlog

### SuperPowers core local workflow integration

- Status: deferred
- Priority: medium
- Owner: unassigned

Goal:

Use the original SuperPowers project as the basis for an in-app local workflow engine, instead of porting SuperPowersWUI directly.

Context:

- SuperPowersWUI is an Open WebUI Tool and depends on Open WebUI internals such as `generate_chat_completion`, Tool Calling metadata, and Fileshed-style storage.
- The original SuperPowers project is easier to adapt because its core behavior is mostly skill markdown, command markdown, prompt templates, and hooks.
- The current app already has provider/model selection for `lm_studio`, `ollama`, and CLI providers.

Proposed approach:

1. Vendor or reference the original SuperPowers repo under a clearly licensed path.
2. Load selected skills such as `brainstorming`, `writing-plans`, `executing-plans`, and `verification-before-completion`.
3. Create an app-native workflow engine that maps those skills onto existing providers.
4. Use local LLMs for brainstorm/spec/plan/diff proposals.
5. Use Codex/CLI providers for actual file edits and verification.
6. Save generated specs and plans under `docs/designs` and `docs/plans`, or a dedicated app storage path.

Open questions:

- Should this be a dedicated `SuperPowers Workflow` screen or remain a Workspace preset?
- Should skill files be vendored into this repo or referenced from a local path?
- Which local model should be the default for each phase?
- How much of the original hook/skill auto-trigger behavior should be reproduced?

Not doing now:

- Directly porting SuperPowersWUI's Open WebUI Tool implementation.
- Allowing LM Studio/Ollama HTTP providers to edit files directly without a file-edit execution layer.
