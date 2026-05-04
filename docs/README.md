# ドキュメント索引

プロジェクトのドキュメントは目的別に整理しています。

## specs/ — 現行仕様

実装の正規となる仕様書。

- [v2-system.md](specs/v2-system.md) — V2 全体仕様（組織体制・インフラ・データフロー）
- [macos-app.md](specs/macos-app.md) — macOS ネイティブアプリ仕様
- [ui-screens-v1.md](specs/ui-screens-v1.md) — 画面UI設計
- [skill-package-manager.md](specs/skill-package-manager.md) — Skill Package Manager（パッケージ化・候補承認・Resolver）
- [skill-management-web-python-brief.md](specs/skill-management-web-python-brief.md) — Web/Python 版 Skill 管理の現状・実装ブリーフ
- [agent-studio-skill-refs-brief.md](specs/agent-studio-skill-refs-brief.md) — Agent Studio に skill_refs エディタを追加する実装ブリーフ
- [orchestration-cli.md](specs/orchestration-cli.md) — Orchestration CLI（`run.md` と `team.md` をベースに実行・同期）

## setup/ — セットアップ・運用手順

- [mcp.md](setup/mcp.md) — MCP連携設定
- [superpowers-local-llm.md](setup/superpowers-local-llm.md) — SuperPowersWUI + ローカルLLM設定

## designs/ — 設計検討メモ（日付付き）

設計の論点を切ったドキュメント。実装後も意思決定の根拠として参照する。

- [2026-04-14-mac-app-redesign-design.md](designs/2026-04-14-mac-app-redesign-design.md)
- [2026-04-17-mac-input-composer-design.md](designs/2026-04-17-mac-input-composer-design.md)
- [2026-05-02-web-workspace-redesign-design.md](designs/2026-05-02-web-workspace-redesign-design.md)

## plans/ — 実装プラン（日付付き）

フェーズ単位の実装計画。

- [2026-04-14-appstore-native.md](plans/2026-04-14-appstore-native.md)
- [2026-04-14-phase1-foundation.md](plans/2026-04-14-phase1-foundation.md)
- [2026-04-14-phase2-screens.md](plans/2026-04-14-phase2-screens.md)
- [2026-04-14-phase3-workflow-evaluation.md](plans/2026-04-14-phase3-workflow-evaluation.md)
- [2026-04-17-mac-input-composer-implementation.md](plans/2026-04-17-mac-input-composer-implementation.md)
- [2026-05-02-web-workspace-redesign.md](plans/2026-05-02-web-workspace-redesign.md)

## history/ — スナップショット・取り込み

時点で凍結された情報。最新状態の正規ではない。

- [2026-04-14-project-summary.md](history/2026-04-14-project-summary.md) — 2026-04-14 時点の意思決定サマリー
- [2026-04-18-notion-import-ai-agent-extensions.md](history/2026-04-18-notion-import-ai-agent-extensions.md) — Notion からの取り込み（AIエージェント拡張）

## 整理ルール

- **specs/** は現行のみ。古くなったら delete または history/ に降格。
- **setup/** はバージョン非依存の手順。バージョン固有なら spec 側へ書く。
- **plans/ / designs/** はファイル名先頭に `YYYY-MM-DD-` を付ける（時系列で並べるため）。
- **history/** は内容を後から書き換えない（スナップショットとして固定）。
- 新規 .md を追加したらこの README にリンクを足す。
