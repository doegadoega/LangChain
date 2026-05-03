# Agent Refinement Platform — macOSネイティブアプリ設計仕様

## 1. 概要

既存のWeb UIベースのAgent Refinement Platformを、SwiftUI + WKWebViewのmacOSネイティブアプリとして再構築する。IDE風のレイアウトでエージェント管理・ワークフロー定義・案件管理を統合的に扱えるようにする。

## 2. 技術スタック

| レイヤー | 技術 |
|---------|------|
| ネイティブシェル | SwiftUI（NavigationSplitView, NSToolbar） |
| リッチコンテンツ | WKWebView（ワークフローキャンバス等） |
| バックエンド | Python FastAPI（サイドカープロセス） |
| バリデーション | Pydantic |
| 通信 | localhost HTTP（Swift ↔ FastAPI） |
| ストリーミング | NDJSON |
| データ永続化 | ローカルJSON / SQLite（案件・エージェント・評価） |

## 3. レイアウト構成（5ゾーン）

```
┌──────┬────────────┬──────────────────────────────┬──────────┐
│      │            │  タブバー                      │          │
│ ア   │  サイド    │  [要件・実行][組織TPL][Agent][WF]│  右      │
│ ク   │  バー      ├──────────────────────────────┤  パネル  │
│ テ   │            │                              │          │
│ ィ   │  フォルダ  │  メインコンテンツ領域           │  エージ  │
│ ビ   │  ーツリー  │                              │  ェント  │
│ テ   │            │                              │  詳細    │
│ ィ   │            │                              │  編集    │
│ バ   │            ├──────────────────────────────┤          │
│ ー   │            │  下部パネル                    │          │
│      │            │  [カルーセル | ターミナル]       │          │
└──────┴────────────┴──────────────────────────────┴──────────┘
```

### 3.1 アクティビティバー（最左端・48px）

- 案件単位の切り替えタブ（アイコン表示）
- 選択中の案件にハイライトバー
- 下部に設定ボタン

### 3.2 サイドバー（左・180-220px）

- 選択案件の作業ディレクトリをフォルダーツリー表示
- ファイル選択でコンテキスト設定に連動

### 3.3 中央タブ（メインコンテンツ）

4つのタブで切り替え:
1. 📋 要件・実行
2. 🏢 組織テンプレート
3. 🤖 エージェント管理
4. 🔀 ワークフローエディタ

### 3.4 下部パネル（ターミナル位置）

タブ切替:
- **エージェントカルーセル**: 左端に+ボタン、横スクロールでエージェントカード
- **ターミナル**: コマンド実行・ログ表示

### 3.5 右パネル（約1/3幅・220-280px）

- エージェント選択時に詳細編集フォーム表示
- 複製して作成 / 削除ボタン
- 未選択時は非表示またはプレースホルダー

## 4. 画面仕様

### 4.1 📋 要件・実行

- **要件入力バー**: テキスト入力 + 実行ボタン
- **テーブル式エージェントログ**:
  - カラム: エージェント名（ロールバッジ付き）、ステータス（完了/実行中/待機）、ログ出力
  - リアルタイムストリーミング更新
- **CEOレポートチャット**:
  - CEOエージェントがユーザーに進捗報告・質問
  - ユーザーがテキストで返答
  - 下部に入力欄 + 送信ボタン

### 4.2 🏢 組織テンプレート

- **テンプレート一覧**（左ペイン）:
  - プリセット / カスタム分類
  - 新規作成ボタン
- **テンプレート詳細**（右ペイン）:
  - メタ情報（名前、作成日、更新日）
  - 複製 / 名前変更 / 削除ボタン
  - 設定: オーケストレーションモード、ラウンド数、ワークフローモード
- **スロット定義**:
  - テンプレート = ロールスロットの集合
  - 各スロット: 組織ロール、人数（最小〜最大）、必須/任意
  - スロットにエージェントをはめ込む（ドロップダウン選択）
  - CEO推薦: 空きスロットに過去評価が高いエージェントを自動推薦
- **フッター**: 「この構成で実行」ボタン、保存ボタン

### 4.3 🤖 エージェント管理

- **ツールバー**: 検索 + ロールフィルター（8種アイコン付き）+ 新規作成ボタン
- **カードグリッド**:
  - 各カード: アイコン、名前、プロバイダー/モデル、ロールバッジ（複数表示）、ペルソナ要約、平均評価スコア
  - カード選択 → 右パネルに編集フォーム
- **右パネル編集フォーム**:
  - 名前、ID
  - 組織ロール（複数選択: タグ形式 + ドロップダウン追加）
  - 実行モード（writer / reviewer / editor）
  - プロバイダー、モデル、ペルソナ、スキル、依存先
  - MCP設定（有効/無効、config path、servers）
  - model_decision（fixed / ceo_decides）
  - 複製して作成 / 削除ボタン
- **参加案件履歴**: エージェントがどの案件に参加したか、その時の設定スナップショットと評価を一覧表示
- **スナップショットから作成**: 過去のスナップショットを選択 → 新規エージェントとして作成

### 4.4 🔀 ワークフローエディタ

- **ツールバー上部ドロップダウン**: 既存ワークフロー切替（検索、プリセット/カスタム分類、使用中バッジ、新規作成）
- **ツールバーボタン**: ズーム、元に戻す、複製、削除、「このフローで実行」
- **ノードパレット**（左ペイン）:
  - 基本ノード: スロット、ゲート、ループ、並列
  - テンプレートノード: PDCAサイクル、レビューループ（一括配置）
  - ドラッグ&ドロップでキャンバスに配置
- **キャンバス**（中央）:
  - ドット方眼グリッド
  - ノードをドラッグ配置、線で接続
  - PDCAステージラベル表示
  - ループ表示（点線枠 + ラベル）
- **プロパティパネル**（右ペイン）: 選択ノードの設定
  - スロットノード: スロット種別、アサイン済みエージェント（評価スコア付き）、合議ルール、タイムアウト
  - ゲートノード: 判定者、分岐条件（PASS/REWORK/ESCALATE → 接続先）、ループ回数上限、上限到達時の動作
  - ループノード: 対象区間、最大回数
  - 並列ノード: フォーク/ジョイン設定

#### ノード種別

| ノード | 表示 | 用途 |
|-------|------|------|
| スロット（実行） | 📦 角丸四角 | エージェントが仕事する |
| ゲート（判定） | ⛩ 黄枠 | 条件分岐（PASS/REWORK/ESCALATE） |
| ループ（繰り返し） | 🔁 紫枠 | 指定区間を条件付きで繰り返す |
| 並列（フォーク/ジョイン） | ⑃ 青枠 | 複数スロットを同時実行 |
| 開始 | ▶ 緑丸 | フローの開始点 |
| 終了 | ⏹ 赤丸 | フローの終了点 |

## 5. 組織ロール（8種 + other）

各ロールに固有アイコンと色を割り当て。1エージェントに複数ロール割り当て可能。

| ロール | アイコン | 色 | 説明 |
|--------|---------|-----|------|
| CEO | 👑 | #f9e2af | 最終意思決定、優先順位付け、モデル選定 |
| Manager | 📊 | #89b4fa | タスク分解、作業指示、進捗管理 |
| PMO | 📋 | #cba6f7 | 計画整合性チェック、進捗/リスク監視 |
| Worker | ⚒️ | #94e2d5 | 設計、実装、修正 |
| QA | ✅ | #a6e3a1 | 仕様/設計/コード検証、テストコード作成 |
| UI Designer | 🎨 | #f5c2e7 | 画面設計、情報アーキテクチャ |
| Sys Designer | 🏗 | #fab387 | システムアーキテクチャ、モジュール分割 |
| Ops Designer | 🔧 | #74c7ec | 運用設計、監視設計、障害対応 |

## 6. エージェント2層管理

### 6.1 マスターエージェント（グローバル）

アプリ全体で管理される「原本」。

フィールド:
- id, name
- org_roles: [OrgRole] （複数選択可）
- mode: writer | reviewer | editor
- provider, model
- persona, skills[], depends_on[]
- mcp_enabled, mcp_config_path, mcp_servers[], mcp_instruction, mcp_context_command, mcp_timeout_sec
- model_decision: fixed | ceo_decides
- command_template
- created_at, updated_at
- average_score（算出値）

### 6.2 案件スナップショット

案件に参加した時点のマスターエージェントのコピー。

フィールド:
- master_agent_id（元のマスターへの参照）
- snapshot_config（参加時点の全設定コピー）
- project_id
- customizations（案件内でのカスタマイズ差分）
- execution_logs[]
- evaluations[]
- created_at

### 6.3 案件へのエージェント追加方法

1. **マスターから追加**: 最新のマスター設定をコピーして案件に追加
2. **別案件のスナップショットから追加**: 過去案件のスナップショット設定をコピー
3. **CEO自動推薦**: 過去の評価スコアをベースに、空きスロットに適したエージェントを推薦

## 7. エージェント評価システム

### 7.1 評価タイミング

- **ラウンド終了時**: 軽量評価（10段階スコアのみ）
- **案件完了時**: フル評価（10段階スコア + フリーコメント）

### 7.2 評価者

CEO、Manager、PMOの3者が独立して評価。

### 7.3 評価データ

```
Evaluation:
  evaluator_role: ceo | manager | pmo
  score: 1-10
  comment: string（案件完了時のみ必須）
  round_number: int（ラウンド評価の場合）
  is_final: bool
  created_at: datetime
```

### 7.4 評価の活用

- エージェント管理画面で平均スコア表示
- スナップショット一覧で「この設定の時の評価」を表示
- CEOが次の案件でのエージェント選定・モデル選定に自動活用（高評価エージェント優先推薦）

## 8. 案件（プロジェクト）データ構造

```
Project:
  id: string
  name: string
  status: active | completed | archived
  working_directory: string
  created_at: datetime
  updated_at: datetime

  organization_template_id: string（使用中テンプレート参照）
  workflow_id: string（使用中ワークフロー参照）

  agent_snapshots: [AgentSnapshot]
  requirements: string
  execution_history: [ExecutionRound]
  ceo_chat_history: [ChatMessage]
  terminal_history: [TerminalEntry]
  evaluations: [Evaluation]
```

## 9. 組織テンプレート

### 9.1 スロットベース設計

テンプレート = ロールスロットの定義。スロットにエージェントをはめ込む。

```
OrganizationTemplate:
  id: string
  name: string
  is_preset: bool
  orchestration_mode: sequential | role_based | dependency_graph
  workflow_mode: writing | coding
  rounds: int (1-5)
  slots: [Slot]
  created_at, updated_at: datetime

Slot:
  org_role: OrgRole
  min_count: int
  max_count: int
  required: bool
  assigned_agents: [agent_id]
```

### 9.2 CEO推薦

空きスロットに対して、過去の評価スコアが高いエージェントを自動推薦。推薦ロジック:
1. スロットのorg_roleに一致するエージェントを抽出
2. 過去の案件評価スコアの加重平均でソート
3. 上位をサジェスト表示

## 10. ワークフロー定義

```
Workflow:
  id: string
  name: string
  is_preset: bool
  nodes: [WorkflowNode]
  edges: [WorkflowEdge]
  created_at, updated_at: datetime

WorkflowNode:
  id: string
  type: start | end | slot | gate | loop | fork | join
  position: {x: float, y: float}
  config: SlotConfig | GateConfig | LoopConfig | ForkConfig

SlotConfig:
  slot_role: OrgRole
  agent_count: int
  consensus_rule: unanimous | majority | any_pass（QA用）
  timeout_sec: int

GateConfig:
  judge: auto | agent | ceo
  conditions: [GateCondition]
  loop_max: int
  on_loop_exceeded: escalate | force_pass | abort

GateCondition:
  label: string (PASS, REWORK, ESCALATE)
  target_node_id: string

LoopConfig:
  target_start_node_id: string
  target_end_node_id: string
  max_iterations: int

ForkConfig:
  type: fork | join

WorkflowEdge:
  source_node_id: string
  target_node_id: string
  condition_label: string（ゲートからの場合）
```
