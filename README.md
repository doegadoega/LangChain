# Agent Refinement Platform (Local MVP)

AIエージェント同士を会話させながら文章を推敲するローカル実行プラットフォームです。

## V2 仕様

V2 の全体仕様（組織体制、インフラ構成、アプリ構成、構成図、データフロー、通信フロー）は以下を参照してください。

ドキュメント索引: [docs/README.md](docs/README.md)
タスク管理: [docs/TODO.md](docs/TODO.md)

主要仕様:

- [docs/specs/v2-system.md](docs/specs/v2-system.md) — V2 全体仕様
- [docs/specs/macos-app.md](docs/specs/macos-app.md) — macOS アプリ仕様
- [docs/specs/ui-screens-v1.md](docs/specs/ui-screens-v1.md) — 画面UI設計
- [docs/specs/skill-package-manager.md](docs/specs/skill-package-manager.md) — Skill Package Manager
- [docs/specs/skill-management-web-python-brief.md](docs/specs/skill-management-web-python-brief.md) — Web/Python 版 Skill 管理ブリーフ
- [docs/specs/orchestration-cli.md](docs/specs/orchestration-cli.md) — Orchestration CLI 仕様
- [docs/setup/mcp.md](docs/setup/mcp.md) — MCP連携設定
- [docs/setup/superpowers-local-llm.md](docs/setup/superpowers-local-llm.md) — SuperPowersWUI + ローカルLLM設定

- 既定フロー: `Drafter -> Critic -> Editor` (初期Providerは `codex_cli`)
- 追加エージェント: **最大5人**
- 各エージェントに `ペルソナ` と `スキル` を設定可能
- 推敲の進行状況をラウンド/エージェント単位でリアルタイム表示
- 組織化機能: テンプレート適用 + チーム構成の保存/読込/削除
- 画面分割: サイドバー型 `テンプレート / エージェント / 入力 / パラメータ / コーディング / 結果 / ログ`
- コーディングモード: `workflow_mode=coding` で実装/設計向けプロンプトに切替
- オーケストレーション: `orchestration_mode` で実行順を制御
  - `sequential` (登録順)
  - `role_based` (`ceo -> manager -> worker -> pmo -> qa`)
  - `dependency_graph` (`depends_on` で依存グラフ実行)
- Providerをエージェントごとに切替可能
  - `gemini_cli` (月額プラン前提のCLI運用向け)
  - `claude_cli`
  - `codex_cli`
  - `ollama` (Ollama HTTP API)
  - `lm_studio` (LM Studio OpenAI互換API)
  - `custom_cli`
- MCP連携（エージェント単位）
  - `mcp_enabled` でON/OFF
  - `mcp_servers[]` / `mcp_instruction` をプロンプトへ反映
  - `mcp_context_command` で外部MCPクライアント実行結果を注入可能
- Research設定（エージェント単位）
  - `allow_web_search` でネット検索許可をON/OFF
  - `research_sources[]` に必ず確認する技術サイトやURLを登録
  - `require_citations` で回答時の参照URL明記を要求

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

## 2.2.1 SuperPowers Localプリセット

Web UIの `Workspace` で `SuperPowers Local` を選ぶと、LM Studioのローカルモデルを使う設計前処理チームに切り替わります。

Workspace では、依頼内容を複数のワークスペースとして登録できます。左ペインの `ワークスペース管理` から登録・一覧検索・読み込み編集・削除を行い、選択中ワークスペースの入力内容、実行結果、フィードバックを保存できます。中央ペインはコンテンツ領域で、`作成・編集`、`エージェント進捗`、`履歴` のモードを切り替えます。`議論したい` / `ディベートしたい` を選んだ場合は、`エージェント進捗` が議論ログとして機能し、各エージェントの発言履歴を次の発言者へ渡して、同意・反論・補強・未決点を収束させます。`作成・編集` では実行チームを Built-in / Custom テンプレートから選択でき、選択したチームのエージェント構成をワークへコピーします。右ペインの `レビュー・ログ` はフィードバック、会話ログ、イベント、JSON確認用です。ワークスペースには `元々の依頼内容`、`前回の依頼内容`、実行結果のローカルバージョン履歴が保存され、過去バージョンの依頼内容を現在の編集状態へ戻せます。

ワークスペースの `作業モード` を `coding` にすると、作業ディレクトリ、対象ファイル、技術スタック、受け入れ条件、テストコマンドを入力できます。これらは AI チームのコーディング相談・修正方針・実装レビュー用プロンプトに渡されます。

- `Brainstorm`: 依頼の曖昧さ、対象ファイル、制約を整理
- `Spec Writer`: 短い実装仕様を作成
- `TDD Planner`: Codex向けの最小TDD計画を作成
- `QA Reviewer`: 抜け漏れを確認し、短い英語のCodex指示へ圧縮

軽いコード作業には `Local Coding Light` プリセットを使います。既定モデルIDは `qwen2.5-coder-3b-instruct` で、小さな修正案、diff案、テストコマンドの整理に使います。

設計レビュー寄りの `SuperPowers Local` では、brainstorm/spec/planに `qwen2.5-coder-3b-instruct`、QA reviewに `qwen2.5-coder-7b-instruct` を使います。Ollamaで使う場合は、プリセット適用後に各エージェントのproviderを `ollama` に変更し、modelに `qwen3:8b` などを指定してください。

Open WebUI版SuperPowersWUIをLM Studio/Ollamaへ接続する手順は [docs/setup/superpowers-local-llm.md](docs/setup/superpowers-local-llm.md) を参照してください。

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

コーディング用途は、JSONを用意せずに最小指定で実行できます。

```bash
python -m app.cli code \
  --workdir /path/to/repo \
  --request "LoginViewModel.swift のバリデーション不具合を直して" \
  --target LoginViewModel.swift \
  --test-command "swift test" \
  --provider codex_cli \
  --stream \
  --output /tmp/coding-result.json
```

- `codex_cli` / `claude_cli` / `gemini_cli` / `custom_cli`: 作業ディレクトリで直接編集できます。
- `ollama` / `lm_studio`: 直接編集せず、diff案と実装指示を返します。
- `custom_cli` を使う場合は `--command-template` を指定してください。

## 2.4 相談チャットとエージェント設定の確認

Web UI の `相談チャット` では、保存済みエージェントを選んで個別に会話できます。
送信時は、画面で選択しているエージェント設定が `/api/chats/message` に渡され、バックエンド側で `name`、`org_role`、`persona`、`provider`、`model` を使って回答を生成します。

保存済みエージェントとチャット履歴はローカルJSONとして保存されます。

## 2.5 Coding 画面

Web UI の `Coding` 画面では、VS Code 風の構成でコーディング依頼を管理できます。

- 左: コーディング依頼一覧
- 中央左: 作業ディレクトリとソースコード一覧
- 中央右: 依頼内容、対象ファイル、テストコマンド、ソース表示
- 右: エージェント作業状況、diff / file changes、実行ログ

ソース一覧は `/api/files/tree`、ファイル表示は `/api/files/read` を使います。`node_modules`、`.git`、`.venv` などの重いディレクトリは一覧から除外します。

```text
~/.agent-refinement/agents/<agent_id>.json
~/.agent-refinement/chats/chat_<agent_id>.json
```

特定エージェントが回答しているか確認する例:

```bash
AGENT_ID="new-agent-7E8DA832_team_8tzir0"

jq '{id,name,org_role,provider,model,enabled}' \
  "$HOME/.agent-refinement/agents/${AGENT_ID}.json"

jq '.messages[] | {role, agent_id, agent_name, created_at}' \
  "$HOME/.agent-refinement/chats/chat_${AGENT_ID}.json"
```

API経由で確認する場合:

```bash
curl -s "http://127.0.0.1:8000/api/chats/chat_${AGENT_ID}" | jq
```

現在のチャット履歴には `agent_id` と `agent_name` が残ります。回答時点の `provider`、`model`、`persona` まで厳密に監査したい場合は、今後 `agent_snapshot` をメッセージ単位で保存する必要があります。

## 3. Gemini月額プラン前提で使う

このMVPはAPIキー必須ではなく、CLI連携で動きます。
`gemini_cli` を使う場合は、先にGemini CLIをインストールしログインしてください。

必要ならCLIコマンドは環境変数で上書きできます。

```bash
export GEMINI_CLI_CMD='gemini -p {prompt}'
export CLAUDE_CLI_CMD='claude --print --output-format text {prompt}'
export CODEX_CLI_CMD='codex exec -c model_reasoning_effort=high --skip-git-repo-check --sandbox read-only {prompt}'
export OLLAMA_BASE_URL='http://localhost:11434/api'
export OLLAMA_MODEL='qwen3:8b'
export LM_STUDIO_BASE_URL='http://localhost:1234/v1'
export LM_STUDIO_MODEL='your-loaded-model-id'
```

`ollama` provider は Ollama の `/api/chat` を使います。エージェントの `model` が未指定の場合は `OLLAMA_MODEL`、さらに未指定なら `qwen3:8b` を使います。

`lm_studio` provider は LM Studio の OpenAI互換 `/v1/chat/completions` を使います。LM Studio側でローカルサーバーを起動し、エージェントの `model` または `LM_STUDIO_MODEL` にロード済みモデルIDを指定してください。

Agent Studio と Teams では、provider選択後に該当providerのモデル候補を取得できます。LM Studioは `/v1/models`、Ollamaは `/api/tags` を使い、Ollama APIに接続できない場合は `ollama list` にフォールバックします。

```bash
curl -s "http://127.0.0.1:8000/api/providers/lm_studio/models" | jq
curl -s "http://127.0.0.1:8000/api/providers/ollama/models" | jq
```

Teams 画面では、左カラムの保存済みチーム一覧から複数チームを管理できます。保存済みチームは `Built-in` と `Custom` のタブで切り替えられ、組み込みテンプレートと自分で保存したチームを分けて確認できます。チームを選ぶと中央で編成を編集でき、右カラムで更新保存・別名保存・削除できます。保存対象はエージェント一覧、enabled、persona、provider、model、depends_on、Research設定、workflow_mode、orchestration_mode、rounds です。

削除できない組み込みチームテンプレートとして、標準フルチーム、軽量ローカルコーディング、Codex実装チーム、設計レビュー、SuperPowers風ワークフローを用意しています。組み込みテンプレートを編集した場合、保存時にはユーザーチームとして複製されます。

各エージェントの `persona` は、実行時プロンプトの「人格・振る舞い指示」としてローカルLLM/CLIに渡されます。チーム内で人格や回答方針を変えたい場合は、Teams または Agent Studio で persona を編集してください。

各エージェントの Research 設定では、ネット検索の許可、必ず確認する技術サイト、最大検索件数、参照URLを回答に残すかを指定できます。`allow_web_search=false` のエージェントには Research Context を渡しません。`allow_web_search=true` かつ `research_sources` がある場合は、登録URLを実行時に取得し、タイトル・抜粋・取得エラーを Research Context としてプロンプト、エージェントログ、サブワークのダウンロードMarkdownに残します。

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
  - `name`, `org_role(ceo/manager/worker/pmo/qa/ui_designer/system_designer/ops_designer/other)`, `provider`
  - `persona`, `skills[]`, `depends_on[]`, `command_template`, `model`, `is_custom`
  - `mcp_enabled`, `mcp_config_path`, `mcp_servers[]`
  - `mcp_instruction`, `mcp_context_command`, `mcp_timeout_sec`

`provider` は `gemini_cli` / `claude_cli` / `codex_cli` / `ollama` / `lm_studio` / `custom_cli` を指定できます。

制約:

- `is_custom=true` のエージェントは最大5

## 5. 仕組み

1. 各ラウンドでオーケストレーションモードに応じて実行順を決定
2. 各エージェントが `org_role` に応じた観点で出力
3. 出力を依存関係に沿って引き継ぎ
4. 最終稿と差分、会話ログを返却

`/api/refine/stream` は以下イベントを順次返します。

- `run_started`
- `round_started`
- `turn_started`
- `turn_completed`
- `round_completed`
- `run_completed`
