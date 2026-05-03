# SuperPowersWUI Local LLM Setup

このプロジェクトでは、SuperPowersWUIを2通りで使います。

1. Agent Refinement Webの `SuperPowers Local` プリセット
2. Open WebUIにSuperPowersWUI Toolを入れて、LM StudioまたはOllamaへ接続

SuperPowersWUI本体はOpen WebUI専用のToolです。内部でOpen WebUIのチャット生成関数を呼ぶため、このリポジトリへそのまま移植しても単体では動きません。Agent Refinement側では、同じ流れをローカルLLM向けのチームプリセットとして扱います。

## Agent Refinement Web

Web UIの `Workspace` では、2つのローカルLLM向けプリセットを使えます。

### Local Coding Light

小さなコード修正案、diff案、テスト方針を軽量モデルで作ります。

| Agent | Role | Provider | Model | Purpose |
|---|---|---|---|---|
| Local Coder Light | worker | `lm_studio` | `qwen2.5-coder-3b-instruct` | 小さなコード変更案と最小diff案を作成 |
| Local Code QA | qa | `lm_studio` | `qwen2.5-coder-3b-instruct` | テスト不足、リスク、スコープ逸脱を確認 |

LM Studio/OllamaのHTTP providerは、このアプリから直接ファイルを書き換えません。ローカルLLMには `diff案` と `Codex向け指示` を出させ、実際のファイル編集はCodexまたはCLI providerに任せます。

### SuperPowers Local

`SuperPowers Local` を選ぶと、以下のローカルLLMチームに切り替わります。

| Agent | Role | Provider | Model | Purpose |
|---|---|---|---|---|
| Brainstorm | manager | `lm_studio` | `qwen2.5-coder-3b-instruct` | 依頼の曖昧さ、対象ファイル、制約を整理 |
| Spec Writer | system_designer | `lm_studio` | `qwen2.5-coder-3b-instruct` | 短い実装仕様を作成 |
| TDD Planner | worker | `lm_studio` | `qwen2.5-coder-3b-instruct` | TDD前提の作業手順を作成 |
| QA Reviewer | qa | `lm_studio` | `qwen2.5-coder-7b-instruct` | 抜け漏れを確認し、Codex向け英語指示に圧縮 |

別モデルを使う場合は、各エージェントの `model` をAgent StudioまたはTeams画面で変更してください。

起動例:

```bash
export LM_STUDIO_BASE_URL='http://localhost:1234/v1'
export LM_STUDIO_MODEL='qwen2.5-coder-3b-instruct'
uvicorn app.main:app --reload --port 8000
```

Ollamaで使う場合は、プリセット適用後に各エージェントのproviderを `ollama` に変更し、modelに `qwen3:8b` などのOllamaモデル名を指定します。

```bash
export OLLAMA_BASE_URL='http://localhost:11434/api'
export OLLAMA_MODEL='qwen3:8b'
```

## Open WebUI + SuperPowersWUI

Open WebUIでGitHub版SuperPowersWUIを使う場合は、Open WebUI側にローカルLLMを登録します。

Repository:

```text
https://github.com/tkalevra/SuperPowersWUI
```

手順:

1. LM StudioまたはOllamaのローカルサーバーを起動する
2. Open WebUIの管理画面でローカルLLM endpointを登録する
3. 対象モデルでNative Function Callingを有効にする
4. `Workspace -> Tools -> Add Tool` で `superpowers_tool.py` の内容を貼る
5. そのToolを対象モデルで有効化する

LM StudioをMac上で起動している場合:

| Open WebUIの実行形態 | Base URL |
|---|---|
| macOS native | `http://127.0.0.1:1234/v1` |
| Docker | `http://host.docker.internal:1234/v1` |

OllamaをMac上で起動している場合:

| Open WebUIの実行形態 | Base URL |
|---|---|
| macOS native | `http://127.0.0.1:11434` |
| Docker | `http://host.docker.internal:11434` |

SuperPowersWUIの主なValves:

| Valve | 推奨値 | Note |
|---|---|---|
| `STORAGE_BASE_PATH` | `/app/backend/data/user_files` | Open WebUI Docker既定に合わせる |
| `FILESHED_COMPATIBLE` | `True` | Fileshed併用時 |
| `COMPLEXITY` | `simple` | ローカル軽量モデルでは短めを推奨 |
| `ENABLE_SHELLCHECK` | `True` | shell script検証 |
| `ENABLE_ESLINT` | `False` | 必要になったら有効化 |

## Recommended Use

Codexのトークン消費を抑える目的では、ローカルLLMにはコード全体を読ませず、次の4点だけを整理させます。

- target files
- goal
- constraints
- output format

最終的にCodexへ渡す指示はこの形にします。

```text
Fix the issue in <target files> only.
Keep the diff minimal.
Do not refactor unrelated code.
Run <test command>.
Return a brief summary and the changed files.
```

Open WebUI版SuperPowersWUIは、Tool Callingが安定するモデルで使ってください。ツール呼び出しが発火しない場合は、Open WebUI側でNative Function Callingが有効か、LM Studio/Ollama側でそのモデルがTool Calling対応として認識されているかを確認します。
