# Agent Refinement Platform (Local MVP)

AIエージェント同士を会話させながら文章を推敲するローカル実行プラットフォームです。

- 既定フロー: `Drafter -> Critic -> Editor` (初期Providerは `codex_cli`)
- 追加エージェント: **最大5人**
- 各エージェントに `ペルソナ` と `スキル` を設定可能
- 推敲の進行状況をラウンド/エージェント単位でリアルタイム表示
- 組織化機能: テンプレート適用 + チーム構成の保存/読込/削除
- 画面分割: `1.組織設計` `2.実行設定` `3.実行ログ・結果`
- コーディングモード: `workflow_mode=coding` で実装/設計向けプロンプトに切替
- Providerをエージェントごとに切替可能
  - `gemini_cli` (月額プラン前提のCLI運用向け)
  - `claude_cli`
  - `codex_cli`
  - `custom_cli`

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

`2.実行設定` でモードを `coding` にすると、追加で次の項目を指定できます。

- リポジトリ名 / 機能名
- 対象ファイル・ディレクトリ
- 技術スタック・制約
- 受け入れ条件
- テストコマンド

これらはエージェントのプロンプトに自動注入され、設計/実装レビュー向けの出力になります。

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

## 4. API

`POST /api/refine`
`POST /api/refine/stream` (NDJSONストリーム)

主な入力フィールド:

- `source_text`: 推敲対象テキスト
- `workflow_mode`: `writing` or `coding`
- `objective`: 目的
- `global_instruction`: 全体ルール
- `code_context`: コーディングモード用コンテキスト
- `rounds`: ラウンド数 (1-5)
- `agents`: エージェント配列
  - `name`, `mode(writer/reviewer/editor)`, `provider`
  - `persona`, `skills[]`, `command_template`, `model`, `is_custom`

制約:

- `is_custom=true` のエージェントは最大5
- editorモードのエージェントを最低1つ必須

## 5. 仕組み

1. 各ラウンドでエージェントを順番実行
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
