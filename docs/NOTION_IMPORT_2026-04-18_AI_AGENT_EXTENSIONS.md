# Notion取り込み: AIエージェント拡張（2026-04-18）

## 1. 取り込み元
- ソースページ: [AIエージェントの拡張](https://www.notion.so/341cbc75502680e6ad4bc4ead3bc47fb)
- 取得日時: 2026-04-18
- 目的: 「開発で今すぐ使える要素」だけをこのリポジトリ運用に取り込む

## 2. 取り込み方針
- 採用: インストール手順が明確で、開発フローに直結するもの
- 保留: 対象リポジトリが曖昧、または用途が未確定のもの

## 3. 採用（開発に必要）

### 3.1 SuperPowers（開発ワークフロー）
- URL: [obra/superpowers](https://github.com/obra/superpowers)
- 取り込み理由:
  - 設計/TDD/レビュー/検証の標準手順化に直結
  - 本リポジトリ運用と整合
- 状態:
  - 本環境では既に利用中（スキル群を確認済み）

### 3.2 Playwright MCP（UI検証・ブラウザ自動化）
- URL: [microsoft/playwright](https://github.com/microsoft/playwright)
- URL: [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)
- 取り込み理由:
  - 画面操作・遷移確認・フォーム検証を自動化できる
- Codex導入コマンド:
```bash
codex mcp add playwright npx "@playwright/mcp@latest"
```

### 3.3 Context7（最新版ドキュメント参照）
- URL: [upstash/context7](https://github.com/upstash/context7)
- 取り込み理由:
  - API仕様の参照精度を上げ、実装時のハルシネーションを減らす
- Codex導入コマンド:
```bash
codex mcp add context7 npx "-y" "@upstash/context7-mcp" "--api-key" "$CONTEXT7_API_KEY"
```
- 備考:
  - `CONTEXT7_API_KEY` は環境変数で設定

### 3.4 agentmemory（任意: 永続メモリ）
- URL: [elizaOS/agentmemory](https://github.com/elizaOS/agentmemory)
- 取り込み理由:
  - 長期タスク/ナレッジの蓄積に有効
- 導入コマンド:
```bash
pip install agentmemory
```

### 3.5 afm / maclocal-api（任意: ローカルモデルAPI）
- URL: [scouzi1966/maclocal-api](https://github.com/scouzi1966/maclocal-api)
- 取り込み理由:
  - Apple Silicon環境でローカルモデルをOpenAI互換API化できる
- 導入コマンド:
```bash
brew install scouzi1966/afm/afm
# or
pip install macafm
```
- 前提:
  - Apple Silicon
  - macOS 26以降
  - Apple Intelligence有効

## 4. 保留（追加情報待ち）
- `argue` (`arguai` 候補): 名称/前提の最終確認待ち
- `Ground Station`: 対象リポジトリ未特定
- `Sam3`: 公式リポジトリ未特定（SAM2等との混同可能性）
- `Asana` CLI系: 対象リポジトリ未確定
- `Upstash Agent Skills`: Codex向け手順が未確認

## 5. このリポジトリでの適用ルール
- MCPを使うエージェントは `mcp_servers` に `playwright`, `context7` を明示
- 追加ルールは [docs/MCP_SETUP.md](/Users/sfidante-he/workspace/LangChain/docs/MCP_SETUP.md) に準拠
- 保留項目は「対象リポジトリ確定後」に再評価して追記

## 6. 最小チェックリスト
- [ ] `playwright` MCPを追加
- [ ] `context7` MCPを追加（APIキー設定）
- [ ] MCP利用エージェントの `mcp_servers` を更新
- [ ] 保留項目のリポジトリを特定して採用可否を再判定
