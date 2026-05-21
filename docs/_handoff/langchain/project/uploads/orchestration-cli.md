# Orchestration CLI 仕様

## 1. 目的とスコープ

Web UI と完全に同じデータモデル（`ManagedRequest` / `WorkspaceVersion` / `Template` / `AgentConfig` / `SkillReference`）を、コマンドラインから操作できるようにする。

達成する体験:

1. **ワーク登録**: 雛形 Markdown を生成して編集する（`init`）
2. **チーム / エージェント選択**: 既存 Team Template / 個別 Agent を Markdown で指定（`team`）
3. **実行前プレビュー**: 解決後のプロンプト・参加メンバー・MCP・Skill を確認（`plan`）
4. **実行**: NDJSON ストリームで進捗表示、結果を `runs/<id>/v<n>/` に保存（`run`）
5. **結果確認**: turns / final_text / diff / file_changes を表示（`show`）
6. **一覧**: 過去の実行と登録済み `run.md` を一覧（`list`）
7. **再開・追跡**: 既存 `ManagedRequest` に追記実行（`resume`）

非スコープ:

- TUI（対話画面）。`init` の対話入力を除き、すべて非対話で完結する設計。
- Web UI 専用機能（リアルタイム協調編集など）。

## 2. ワーク単位とデータモデル

CLI 上の **`run.md` 1 ファイル = `ManagedRequest` 1 件 = 1 ワーク**。

| Web UI 概念 | CLI ファイル | 補足 |
|---|---|---|
| `ManagedRequest` | `run.md` | front matter + 本文（source_text） |
| `ManagedRequest.template_id` | `team:` フィールド | Template ID 参照、または `team.md` パス |
| `WorkspaceVersion[]` | `runs/<request_id>/v<n>/` | 実行ごとに 1 ディレクトリ |
| `RefineRequest.code_context` | front matter `code_context` | working_directory 等を含む |
| `RefineRequest.agents` | `team:` 解決結果（インライン上書き可） | 個別 Agent 上書きは agents セクション |

`run.md` を編集 → `orchestrate run` で実行 → `versions[]` に積む、というループが一周。

## 3. `run.md` フォーマット

### 3.1 雛形

```markdown
---
id: req_20260504_120000
title: Feature X 実装
status: draft

workflow_mode: coding
orchestration_mode: dependency_graph
rounds: 2

template_id: team_local_full          # team.md パス指定も可
working_directory: /Users/me/repos/foo

code_context:
  repository: foo
  target_paths:
    - app/services/payment.py
    - tests/test_payment.py
  tech_stack: Python 3.13, FastAPI, Stripe
  acceptance_criteria: |
    - 決済成功時に webhook を受信できる
    - 失敗時はエラーログに stripe_id が残る
  test_command: pytest -k payment

skills:
  - ./skills/python-fastapi/SKILL.md
  - swiftui-implementation@1.3.0       # library installed id

references:
  - path: ./design.md
    inject: true                       # 本文を system prompt に注入
  - url: https://stripe.com/docs/api
    fetch: false                       # URL のみ参照として渡す

mcp:
  enabled: true
  config_path: ~/.config/mcp/config.json
  servers: [playwright, context7]
  instruction: 必要なときだけ呼び出すこと

agents:                                # 任意。team を上書き
  - id: ceo
    enabled: false                     # team の CEO を無効化
  - id: extra_qa
    name: 追加 QA
    org_role: qa
    provider: anthropic_api
    model: claude-sonnet-4-6
    persona: 受入条件への網羅性を見る
    depends_on: [worker_1]
---

# 依頼内容

ここに自由記述の依頼本文を書く。これが `RefineRequest.source_text` に入る。

## 目的

- ...

## 受入条件

- ...
```

### 3.2 必須フィールド

- `id`（無い場合は `init` が `req_<YYYYMMDD>_<rand>` を自動生成）
- `title`
- `workflow_mode` ∈ `{writing, coding}`
- `orchestration_mode` ∈ `{sequential, role_based, dependency_graph}`
- `team` または `agents`（最低 1 名のエージェント）
- 本文（`source_text`）が空の場合は `run` がエラー終了

### 3.3 任意フィールド

`status`, `rounds`, `template_id`, `working_directory`, `code_context.*`, `skills`, `references`, `mcp`, `agents`

### 3.4 解決順序

1. `template_id` が指定されていれば `Template.agents` を初期メンバーに展開
2. `agents` セクションがあれば、id 一致で上書き、新規 id は追加、`enabled: false` で除外
3. `skills` 各エントリを SkillStore で解決し、provider/role に合わせて Markdown を System Prompt に追加
4. `references[]` を `inject: true` のものから順に本文取得 → System Prompt 末尾に追加。`fetch: false` は参考 URL として明示
5. `mcp.enabled: true` なら各 Agent の MCP 設定をマージ
6. `code_context` を `RefineRequest.code_context` にマップ
7. 解決結果から `RefineRequest` を組み立てて backend に POST、または直接 `app.orchestrator.run_refinement` を呼ぶ

## 4. `team.md` フォーマット

`run.md` の `team:` がパス参照のとき、または `orchestrate team --export` でエクスポートしたとき使う形式。

```markdown
---
id: team_local_full
name: 標準フルチーム
description: CEO + Manager + PMO + Worker x3 + QA x3
workflow_mode: coding
orchestration_mode: role_based
rounds: 1
is_builtin: false
---

## Agent: CEO

- id: ceo
- org_role: ceo
- provider: codex_cli
- model_decision: fixed
- skills: [decision, prioritization]

最終意思決定とモデル選定を行う。

## Agent: Manager

- id: manager
- org_role: manager
- provider: codex_cli
- depends_on: [ceo]

タスク分解と進行管理。
```

front matter は Web UI の `Template` JSON と可逆。本文 `## Agent: <name>` セクションで `AgentConfig` を表現。リスト値（skills / depends_on）は YAML 配列、persona は本文段落。

## 5. サブコマンド

すべて `python -m app.cli <subcommand>` または `agent-refine <subcommand>`（エイリアス検討）で起動。

### 5.1 `orchestrate init <name>`

```bash
agent-refine orchestrate init feature-x [--dir ./works] [--non-interactive]
```

- `<name>` をベースに `<dir>/<name>/run.md` を生成（既定 `--dir ./works`）
- 対話モード（既定）: title / workflow_mode / template_id を順に質問
- `--non-interactive`: 雛形のみ書き出し、空フィールドはデフォルト
- `--from-template <id|path>`: 指定 Template の workflow_mode / orchestration_mode / rounds / agents を `agents:` に展開した状態で出力
- 終了コード: `0` 成功 / `2` ファイル既存（`--force` で上書き）

### 5.2 `orchestrate team <run.md>`

```bash
agent-refine orchestrate team ./works/feature-x/run.md \
  --select team_local_full \
  [--add-agent agent_xyz] \
  [--remove-agent ceo] \
  [--export ./team.md]
```

- `--select <id>`: `template_id` を書き換え
- `--add-agent <id>` / `--remove-agent <id>`: `agents:` セクションを編集
- `--export <path>`: 解決後のチームを `team.md` として書き出す（共有用）
- フラグ無しで起動した場合は現状の team を表示するだけ

### 5.3 `orchestrate plan <run.md>`

```bash
agent-refine orchestrate plan ./works/feature-x/run.md [--format json|table]
```

- 解決結果を表示。**実行はしない**
- 表示項目:
  - 参加 Agent 一覧（id / name / role / provider / model / depends_on）
  - 解決された Skill（id / version / 適用 provider / role）
  - References（path / url / inject 可否）
  - MCP（servers / config_path / instruction）
  - 最終 System Prompt の **頭 2KB**（プレビュー）
  - エラー / 警告（テンプレート未解決、循環依存など）
- 終了コード: `0` 健全 / `3` 警告あり / `4` 解決失敗

### 5.4 `orchestrate run <run.md>`

```bash
agent-refine orchestrate run ./works/feature-x/run.md \
  [--stream] [--no-persist] \
  [--output ./out/result.json] [--pretty]
```

- 実行し、`runs/<id>/v<n>/` に結果一式を保存
- `--stream`: NDJSON を stdout へ流す（既存 `app.cli run --stream` と同形式）
- `--no-persist`: ローカル `runs/` には書かず、Web UI 側 `/api/requests` への同期もしない
- `--output <path>`: 最終 JSON のみ別途出力
- `--pretty`: 最終 JSON を整形して stdout
- 既定では `/api/requests` を叩いて Web UI と同期する。`--no-sync` で抑止
- 終了コード: `0` run_completed / `5` run_failed / `130` 中断

### 5.5 `orchestrate show <id|path>`

```bash
agent-refine orchestrate show req_20260504_120000 [--version <n>] [--format md|json|pretty]
agent-refine orchestrate show ./works/feature-x/run.md [--version latest]
```

- `runs/<id>/v<n>/` を読み込んで表示。`--version` 省略時は latest
- `--format md`: turns を Markdown で連結
- `--format json`: WorkspaceVersion 構造をそのまま出力
- `--format pretty`: turns / final_text / diff を色付き表形式で

### 5.6 `orchestrate list`

```bash
agent-refine orchestrate list [--filter status=running] [--limit 50]
```

- `runs/` 配下と `/api/requests` の両方をマージして一覧
- 列: id / title / status / template_id / 最終実行日 / 最新 version / 直近 final_text 1 行
- `--filter` で `status` / `template_id` / `workflow_mode` を絞り込み

### 5.7 `orchestrate resume <id>`

```bash
agent-refine orchestrate resume req_20260504_120000 \
  [--feedback <kind>:<comment>] \
  [--stream]
```

- 既存 `ManagedRequest` に対する追加実行。`run.md` を最新スナップショットに復元してから `run` と同じ動きをする
- `--feedback`: `verification_feedback[]` に追加してから再実行（kind: `more_detail` / `change_direction` / `fix_request` / `approved`）
- 結果は次の `WorkspaceVersion` として積まれる

## 6. 結果保存レイアウト

```
~/.agent-refinement/
  runs/
    <request_id>/
      run.md                # 実行時のスナップショット（front matter + 本文）
      v1/
        result.json         # final_text / diff / file_changes / status
        events.ndjson       # ストリームイベント全件
        prompt-system.md    # 最終 System Prompt（解決済み）
        turns/
          01-ceo.md
          02-manager.md
          ...
      v2/
        ...
      meta.json             # 統計（version 数、最終 status、累計 token 等）
```

- `request_id` は `run.md` の `id` と一致
- `v<n>` は **実行成功時のみ**インクリメント。失敗実行は `v<n>-failed` として残す
- `meta.json` だけで一覧画面が成立するように、十分な情報を持たせる

## 7. Web UI / ManagedRequest との同期

| 動作 | 同期方向 | API |
|---|---|---|
| `init` 後の `run.md` 保存 | CLI → Web | `POST /api/requests`（status=draft） |
| `run` 開始 | CLI → Web | `PUT /api/requests/<id>`（status=running） |
| `run` 完了 | CLI → Web | `PUT /api/requests/<id>`（status=completed, versions[] に追加） |
| Web UI 編集 | Web → CLI | `orchestrate pull <id>` で `run.md` を最新化（後段実装） |

`--no-sync` 指定時はローカル `runs/` のみを更新。Web UI 側の `/api/requests` には書かない。

## 8. エラーハンドリングと終了コード

| コード | 意味 |
|---|---|
| 0 | 成功 |
| 2 | 入力不正（ファイル既存・必須フィールド欠落） |
| 3 | 警告あり（plan 時のみ。実行は許可） |
| 4 | 解決失敗（テンプレート未発見・循環依存・skill 未解決） |
| 5 | 実行失敗（run_failed） |
| 6 | 同期失敗（API 到達不能。ローカル保存は完了） |
| 130 | ユーザ中断（Ctrl-C） |

stderr にエラーメッセージ、stdout には NDJSON / JSON のみを出す（パイプ可能性を担保）。

## 9. 既存 `app.cli run` との関係

- 既存 `python -m app.cli run --config <json> --stream` は **互換維持**
- 新 `orchestrate` サブコマンド群は別系統として併走
- 内部実装は共有（`app.orchestrator.run_refinement` / `iter_refinement_events`）
- `run.md` → `RefineRequest` 変換器を `app/cli_orchestrate.py` 等の新モジュールに分離

## 10. 実装ステップ

1. `app/cli_orchestrate.py` を新設、`run.md` パーサ + `RefineRequest` ビルダ
2. `app/cli.py` の subparsers に `orchestrate <subcommand>` 群を追加
3. `team.md` パーサ（既存 `Template` JSON と相互変換できる単体ユーティリティ）
4. Skill 解決は Mac 側 `SkillStore` 相当を Python 移植 or 簡易実装。当面 frontmatter 解釈のみ
5. `runs/<id>/v<n>/` 書き出しユーティリティ
6. Web UI 同期（`/api/requests`）
7. テスト（`tests/test_orchestrate_cli.py`）
   - `init` 雛形生成
   - `team` 編集
   - `plan` 解決とエラー検出
   - `run` のローカル保存とイベント発火
   - `resume` 連鎖

## 11. 関連ドキュメント

- [v2-system.md](v2-system.md) — V2 全体仕様
- [skill-package-manager.md](skill-package-manager.md) — Skill 解決規則
- [setup/mcp.md](../setup/mcp.md) — MCP 設定
- [TODO.md](../TODO.md) — Orchestration CLI セクション

## 12. 未決事項（仕様レビュー時に詰める）

- `init` 既定保存先 `./works/` か `~/.agent-refinement/works/` か
- `references[].fetch: true` のサイズ上限と timeout
- Web UI 側で `versions[]` 削除時に CLI 側 `runs/<id>/v<n>/` も同期削除するか
- `team.md` の `## Agent:` セクションを YAML 配列で内包するか別ファイル分割するか（現案: 同一ファイル内）
- `orchestrate watch` のような `--follow` モードを将来追加するか
