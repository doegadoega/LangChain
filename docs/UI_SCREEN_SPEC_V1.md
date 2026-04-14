# 画面UI設計書（V1）

## 1. 対象
- 製品名: AI Agent Orchestration Platform
- 対応クライアント:
  - Web UI（先行実装）
  - Mac App（同一情報設計で追従）

## 2. 画面構成
- `Dashboard`
- `Team Composer`
- `Agent Studio`
- `Execution (Coding Mode)`
- `QA Gate`
- `Logs & Artifacts`
- `Settings`

## 3. 共通レイアウト
- ヘッダー:
  - プロジェクト選択
  - 実行Run選択
  - 環境バッジ（local/aws/gcp）
  - 実行開始/停止ボタン
- 左ナビ:
  - 上記7画面への遷移
  - 現在画面の強調表示
- メイン領域:
  - 画面ごとの主要コンテンツ
- 右サイドパネル（任意開閉）:
  - 選択項目の詳細
  - ヘルプ/検証メッセージ

## 4. 画面別UI仕様

## 4.1 Dashboard
- 目的: CEO/Manager が全体状況を即時把握する
- 主要コンポーネント:
  - KPIカード（Active Runs, PASS率, Rework件数, Escalation件数）
  - 実行タイムライン（最新イベント）
  - 意思決定キュー（CEO承認待ち）
  - アラート一覧（失敗Run、未解決Issue）
- 主要操作:
  - 承認待ち案件の詳細を開く
  - 該当Runへジャンプ

## 4.2 Team Composer
- 目的: 実行前に組織編成を決める
- 主要コンポーネント:
  - ロール一覧（CEO, Manager, Worker, PMO, QA, Optional Roles）
  - ロール有効/無効トグル
  - Provider/Model設定
  - `model_decision` 切替（`fixed` / `ceo_decides`）
  - デフォルトテンプレート読込
- 主要操作:
  - ロール追加/無効化
  - 人員数変更（Worker, QA）
  - 実行用構成として保存

## 4.3 Agent Studio
- 目的: エージェント個別設定とスキル管理
- 主要コンポーネント:
  - エージェント一覧テーブル
  - 編集フォーム（name, org_role, mode, provider, model, persona）
  - スキルカタログ（タグ検索）
  - MCP設定（ON/OFF, server list, config path, context command, instruction）
  - 依存関係設定（depends_on）
  - デフォルト値 vs 実行時上書きの比較表示
- 主要操作:
  - スキル割当
  - ペルソナ編集
  - 依存関係検証

## 4.4 Execution (Coding Mode)
- 目的: 実行制御と進行可視化
- 主要コンポーネント:
  - Run設定フォーム（workflow_mode, orchestration_mode, rounds, working_directory）
  - ストリーミングイベントログ（run_started, turn_started, turn_completed）
  - エージェント出力タブ
  - 差分ビューア（file changes / patch）
  - テスト結果バッジ（pass/fail/skip）
- 主要操作:
  - 実行開始/停止
  - ラウンド単位の確認
  - 失敗ターン再実行

## 4.5 QA Gate
- 目的: 3名QAの合意判定
- 主要コンポーネント:
  - QA1/QA2/QA3 判定レーン
  - 判定サマリー（PASS/REWORK/ESCALATE）
  - 不明仕様Issueパネル
  - CEOエスカレーション送信ボタン
- 主要操作:
  - 判定提出
  - 差し戻し理由の記録
  - エスカレーション発行

## 4.6 Logs & Artifacts
- 目的: 監査性と再現性の担保
- 主要コンポーネント:
  - ログテーブル（role, status, timestamp, run_id）
  - 成果物一覧（spec, architecture, flow, test report）
  - プレビュー（Markdown/JSON）
  - エクスポート操作
- 主要操作:
  - フィルタ検索
  - 成果物比較
  - Runスナップショット出力

## 4.7 Settings
- 目的: システム共通設定管理
- 主要コンポーネント:
  - Provider接続設定（ローカルLLM接続先）
  - デフォルトテンプレート管理
  - スキルカタログ管理
  - 監査ログ保存ポリシー
- 主要操作:
  - 設定テスト
  - デフォルト更新

## 5. 状態表示ルール
- ステータス色:
  - PASS: 緑
  - REWORK: 橙
  - ESCALATE: 赤
  - RUNNING: 青
  - IDLE: 灰
- 非同期処理:
  - 実行中は操作可能範囲を制御
  - 中断時はターン単位で一貫性を維持

## 6. レスポンシブ方針
- Web:
  - Desktop最適化を先行
  - 幅狭時は右パネルをドロワー化
- Mac:
  - 同一情報設計を採用
  - 分割ビュー（可変幅）を標準化

## 7. 実装優先順
1. `Execution`
2. `Team Composer`
3. `Agent Studio`
4. `QA Gate`
5. `Dashboard`
6. `Logs & Artifacts`
7. `Settings`

## 8. Figma反映方針
- 先に低忠実度で画面遷移と情報量を確定。
- 次に高忠実度モックを `Dashboard / Execution / QA Gate` から作成。
- 最後にトークン定義（色、余白、タイポ）を確定して実装へ接続。
