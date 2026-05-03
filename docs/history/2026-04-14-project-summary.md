# プロジェクト要約（2026-04-14時点）

## 1. 目的
- AIエージェント同士を組織化して、設計・実装・レビュー・改善を回せるプラットフォームを構築する。
- ローカル起動可能（Web UI + CLI）で、推敲用途からソフトウェア開発用途まで拡張する。

## 2. 現時点の確定方針
- アカウント共有はしない。
- UI利用者はオーケストレーター経由で利用する。
- 主実行基盤は `AWS/GCP 上のローカルLLM`（社内利用想定）。
- シークレット/認証情報はサーバ側で管理し、クライアントへ配布しない。
- 既存の外部CLI連携（`codex_cli` / `claude_cli` / `gemini_cli`）は、将来必要時のみ利用可能な拡張として扱う。

## 3. 組織モデル（デフォルト）
- `CEO x1`: 最終意思決定、チーム構成判断、モデル選定
- `Manager x1`: 計画作成、指示、進行管理
- `Worker x3`: 設計・実装
- `PMO x1`: 計画整合/リスク監視
- `QA x3`: 成果物検証（全員レビュー）

### オプションロール（必要時）
- `UI Designer`
- `System Designer`
- `Ops Designer`

## 4. 開発/運用方式
- 基本方式: `Stage-Gate + PDCA`
- 流れ:
  - `Plan`: Manager + PMO
  - `Do`: Worker
  - `Check`: QA（3名）
  - `Act`: CEO + Manager

## 5. 品質ゲート（QA）
- QAは最低3名で稼働。
- 3名全員が成果物を個別評価。
- 判定:
  - `PASS`: 次工程へ進行
  - `REWORK`: 差し戻し
  - `ESCALATE`: 仕様不明点をManager/CEOへ報告
- テスト方針:
  - `unit + integration + smoke` を標準実施
  - テストコード作成と動作確認をQA責務に含める

## 6. プラットフォーム要件（MVP→V2）
- 実行チャネル:
  - Web UI
  - CLI
- オーケストレーション:
  - `sequential`
  - `role_based`
  - `dependency_graph`
- モード:
  - `writing`
  - `coding`
- エージェント設定:
  - エージェントごとの `role/provider/model/persona/skills/depends_on`
  - エージェントごとの `MCP設定`（servers/instruction/context command）
  - デフォルト設定 + 個別上書き
  - CEOによるモデル/構成決定（`ceo_decides`）

## 7. カスタマイズ方針
- 役割単位ファイルを用意し、必要時に上書きして使う。
- 例:
  - `roles/ceo.yaml`
  - `roles/manager.yaml`
  - `roles/worker.yaml`
  - `roles/qa.yaml`
  - `skills/catalog.yaml`
- UIからも設定変更可能にする（将来はMacアプリも同一APIで接続）。

## 8. クラウド展開の考え方
- 現フェーズ: ローカル/社内利用中心。
- 次フェーズ: AWS/GCP展開を想定（商用公開ではなく社内利用）。
- 10人規模利用を見据え、将来は実行キュー・永続DB・監査ログ基盤を追加。

## 9. 現在の成果物
- V2詳細仕様書:
  - [docs/specs/v2-system.md](../specs/v2-system.md)
- 本サマリー:
  - [docs/history/2026-04-14-project-summary.md](2026-04-14-project-summary.md)

## 10. 次に実装する優先項目（提案）
1. `CEO決定ロジック`（チーム構成 + モデル選定）の実装
2. `role/skill` 設定ファイルの読み書き基盤
3. UIの設定画面分離（組織/スキル/実行/ログ）
4. CLIで同等機能を操作できるサブコマンド拡張
