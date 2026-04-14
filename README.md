# Agent Refinement Platform (Local MVP)

AIエージェント同士を会話させながら文章を推敲するローカル実行プラットフォームです。

## V2 仕様

V2 の全体仕様（組織体制、インフラ構成、アプリ構成、構成図、データフロー、通信フロー）は以下を参照してください。

- [docs/V2_SYSTEM_SPEC.md](/Users/sfidante-he/workspace/LangChain/docs/V2_SYSTEM_SPEC.md)
- [docs/PROJECT_SUMMARY_2026-04-14.md](/Users/sfidante-he/workspace/LangChain/docs/PROJECT_SUMMARY_2026-04-14.md)（ここまでの意思決定サマリー）
- [docs/UI_SCREEN_SPEC_V1.md](/Users/sfidante-he/workspace/LangChain/docs/UI_SCREEN_SPEC_V1.md)（画面UI設計）
- [docs/MCP_SETUP.md](/Users/sfidante-he/workspace/LangChain/docs/MCP_SETUP.md)（MCP連携設定）

- 既定フロー: `Drafter -> Critic -> Editor` (初期Providerは `codex_cli`)
- 追加エージェント: **最大5人**
- 各エージェントに `ペルソナ` と `スキル` を設定可能
- 推敲の進行状況をラウンド/エージェント単位でリアルタイム表示
- 組織化機能: テンプレート適用 + チーム構成の保存/読込/削除
- 画面分割: サイドバー型 `テンプレート / エージェント / 入力 / パラメータ / コーディング / 結果 / ログ`
- コーディングモード: `workflow_mode=coding` で実装/設計向けプロンプトに切替
- オーケストレーション: `orchestration_mode` で実行順を制御
  - `sequential` (登録順)
  - `role_based` (`writer -> reviewer -> editor`)
  - `dependency_graph` (`depends_on` で依存グラフ実行)
- Providerをエージェントごとに切替可能
  - `gemini_cli` (月額プラン前提のCLI運用向け)
  - `claude_cli`
  - `codex_cli`
  - `custom_cli`
- MCP連携（エージェント単位）
  - `mcp_enabled` でON/OFF
  - `mcp_servers[]` / `mcp_instruction` をプロンプトへ反映
  - `mcp_context_command` で外部MCPクライアント実行結果を注入可能

## 1. セットアップ

```bash
cd /Users/sfidante-he/workspace/LangChain
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. 起動

```bash
uvicorn app.main:app --reload --port 8000
```

ブラウザで `http://127.0.0.1:8000` を開きます。

## 2.1 テンプレートで組織化

画面上部の `組織テンプレート` から用途ごとのチーム構成を適用できます。

- `文章推敲チーム`
- `設計レビュー組織`
- `実装デリバリーチーム`

作成した構成はブラウザの `localStorage` に保存され、再読込後も利用できます。

## 2.2 コーディングモード

`パラメータ` でモードを `coding` にすると、`コーディング` ページが有効になります。
コーディングページではウィザード形式で次を指定できます。

- 作業ディレクトリ (`working_directory`)
- リポジトリ名 / 機能名
- 対象ファイル・ディレクトリ
- 技術スタック・制約
- 受け入れ条件
- テストコマンド

これらはエージェントのプロンプトに自動注入され、設計/実装レビュー向けの出力になります。

## 2.3 CLI実行

ブラウザUI以外に、CLI形式でも同じ実行ができます。

```bash
cd /Users/sfidante-he/workspace/LangChain
python -m app.cli run --config /path/to/request.json --stream
```

- `--stream`: NDJSONイベントを順次出力
- `--output /path/to/result.json`: 最終結果をファイル保存
- `--pretty`: 最終結果JSONを整形して標準出力

設定ファイルの例は以下で生成できます。

```bash
python -m app.cli sample-config --path /tmp/langchain-request.sample.json
```

## 3. Gemini月額プラン前提で使う

このMVPはAPIキー必須ではなく、CLI連携で動きます。
`gemini_cli` を使う場合は、先にGemini CLIをインストールしログインしてください。

必要ならCLIコマンドは環境変数で上書きできます。

```bash
export GEMINI_CLI_CMD='gemini -p {prompt}'
export CLAUDE_CLI_CMD='claude --print --output-format text {prompt}'
export CODEX_CLI_CMD='codex exec -c model_reasoning_effort=high --skip-git-repo-check --sandbox read-only {prompt}'
```

`custom_cli` を選んだエージェントは、画面上で `command_template` を必ず設定してください。

MCP連携時、`command_template` と `mcp_context_command` では以下のプレースホルダが使えます。

- `{prompt}` / `{query}`: 実行プロンプト
- `{model}`: モデル名（未指定時は空）
- `{mcp_config_path}`: MCP設定ファイルパス
- `{mcp_servers_csv}`: MCPサーバー一覧（カンマ区切り）
- `{mcp_servers_json}`: MCPサーバー一覧（JSON配列）

## 4. API

`POST /api/refine`
`POST /api/refine/stream` (NDJSONストリーム)

主な入力フィールド:

- `source_text`: 推敲対象テキスト
- `workflow_mode`: `writing` or `coding`
- `orchestration_mode`: `sequential` / `role_based` / `dependency_graph`
- `objective`: 目的
- `global_instruction`: 全体ルール
- `code_context`: コーディングモード用コンテキスト
  - `working_directory`: 実コード生成を行う作業ディレクトリ (任意)
- `rounds`: ラウンド数 (1-5)
- `agents`: エージェント配列
  - `name`, `mode(writer/reviewer/editor)`, `provider`
  - `persona`, `skills[]`, `depends_on[]`, `command_template`, `model`, `is_custom`
  - `mcp_enabled`, `mcp_config_path`, `mcp_servers[]`
  - `mcp_instruction`, `mcp_context_command`, `mcp_timeout_sec`

制約:

- `is_custom=true` のエージェントは最大5
- editorモードのエージェントを最低1つ必須

## 5. 仕組み

1. 各ラウンドでオーケストレーションモードに応じて実行順を決定
2. reviewerは改善指摘を出力
3. writer/editorは本文を書き換え
4. 最終稿と差分、会話ログを返却

`/api/refine/stream` は以下イベントを順次返します。

- `run_started`
- `round_started`
- `turn_started`
- `turn_completed`
- `round_completed`
- `run_completed`
