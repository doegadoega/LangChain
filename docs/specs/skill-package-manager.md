# Skill Package Manager 仕様

## 1. 目的

Skill を「タグ列」ではなく**パッケージ**として管理する。Agent からは Skill 本体を直接持たず、参照（`SkillReference`）だけを保持し、実行時に Resolver が provider / model / role に適合する Markdown を選び System Prompt に注入する。

GitHub URL や AI 探索で見つけた未承認 Skill は Library に直接入れず、Candidates に隔離 → ユーザー承認 → Library 昇格、というフローで安全性を担保する。

## 2. 全体構成

| 階層 | 役割 |
|---|---|
| **Skill Library** | 正式に利用可能な Skill。バージョンごとに保存。 |
| **Skill Candidates** | GitHub / AI 探索で取得した未承認 Skill の一時保管。 |
| **Agent SkillReference** | Agent が「どの Skill を、どのバージョンで、有効か」を参照のみ保持。 |
| **SkillResolver / Renderer** | 実行時に Reference → 実体を解決し、provider / role に合う Markdown を組み立てる。 |

## 3. ディスクレイアウト

```
~/.agent-refinement/
  skills/
    library/
      <skill-id>/
        index.json
        versions/
          <version>/
            SKILL.md
    candidates/
      <batch-id>/
        <skill-id>/
          SKILL.md
    cache/
      git/
        github.com-<owner>-<repo>/   # 取り込み元の shallow clone
```

`index.json` は Library 側のみで保持し、複数バージョンをマージ管理する。

```json
{
  "id": "swiftui-implementation",
  "name": "SwiftUI Implementation",
  "source": "user",
  "installedVersions": ["1.4.0", "1.3.0"],
  "latestInstalledVersion": "1.4.0"
}
```

## 4. SKILL.md 形式

```markdown
---
id: swiftui-implementation
name: SwiftUI Implementation
version: 1.3.0
description: SwiftUI 実装ガイド
providers: [codex_cli, claude_cli]
roles: [worker, qa]
tags: [swift, swiftui]
---

共通ガイダンス本文。

## Provider: codex_cli
codex 固有の指示。

## Provider: claude_cli
claude 固有の指示。

## Role: worker
worker 固有の指示。
```

- 必須 front matter は `id` のみ。`name` 既定 = id、`version` 既定 = `0.0.0`。
- 配列値は YAML サブセット（`[a, b]` または `a, b`）として簡易解析。
- 本文は `## Provider: <kind>` / `## Role: <role>` 見出しでセクション化。それ以外は共通として扱う。

## 5. 参照モデル（Swift）

```swift
enum SkillSource: String { case bundled, user, imported, discovered }

enum SkillVersionRequirement {
    case exact(String)
    case latestCompatible
    case latest
}

struct SkillReference {
    var id: String
    var source: SkillSource
    var versionRequirement: SkillVersionRequirement
    var enabled: Bool
}
```

- Agent (`MasterAgent`) は `skillRefs: [SkillReference]` を持つ（旧 `skills: [String]` はタグとして併存）。
- バージョン固定は `latestCompatible` を推奨デフォルトとする想定（現状の API デフォルトは `.latest`）。

## 6. 解決ルール

`SkillPromptRenderer.render(skills:references:provider:role:)` の挙動：

1. `references` のうち `enabled == true` のみ評価。
2. 各 reference について `id` と `source` で `SkillDocument` 候補を絞る。
3. `versionRequirement`：
   - `.exact(v)` → `version == v`
   - `.latestCompatible` / `.latest` → 文字列降順で最大を選ぶ（将来 SemVer 比較に置換）。
4. 選ばれた Skill から、共通本文 + 該当 provider セクション + 該当 role セクションを連結。
5. 最終出力は `[<Skill 名>]` 見出し付きで複数 Skill を結合。

該当 provider / role のセクションが無くても共通本文があれば必ず出力する（フォールバック）。

## 7. プロンプト注入

`PromptBuilder.buildSystemDirective(agent:installedSkills:)` が `SkillResolver` を呼び、戻り値を「インストール済みスキル:」セクションとして既存 directive 末尾近くに挿入する。空文字なら出力しない。

`Orchestrator.RunConfig.installedSkills` で渡す。AppState は `SkillStore.loadInstalledSkills()` の結果を毎回注入する（書き込み頻度が低いのでキャッシュは不要）。

## 8. SkillStore API

```swift
SkillStore(baseDirectory: URL?)

func loadInstalledSkills() throws -> [SkillDocument]
func installSkillMarkdown(_ markdown: String, source: SkillSource) throws -> SkillDocument
func loadCandidates() throws -> [CandidateBatch]
func importLocalDirectoryAsCandidates(_ sourceDirectory: URL) throws -> [SkillDocument]
func approveCandidate(skillId: String, batchId: String, source: SkillSource) throws -> SkillDocument
func removeSkill(id: String) throws
func removeSkillVersion(id: String, version: String) throws
```

- `installSkillMarkdown` は同一 id の既存 `index.json` を読み、バージョンをマージ書き込みする。
- `removeSkillVersion` は最終バージョン削除時にディレクトリごと撤去する。
- `approveCandidate` は候補 SKILL.md を読み Library に install した後、候補ディレクトリを削除する（バッチが空になっても物理的にはバッチディレクトリは残置：将来掃除）。

## 9. 取り込みフロー

| 経路 | 配置先 | 承認 |
|---|---|---|
| バンドル | `library/` に直接（`source: bundled`） | 不要 |
| ローカルディレクトリ | `candidates/local-<timestamp>/` | 必要 |
| GitHub URL | `cache/git/...` に shallow clone → SKILL.md 走査 → `candidates/github-<owner>-<repo>-<timestamp>/`（未実装） | 必要 |
| AI 探索 | `candidates/ai-<timestamp>/` （未実装） | 必要 |

外部由来は **必ず Candidates を経由**し、自動で Library に入れない。

## 10. Codable 後方互換

旧 JSON（`skillRefs` フィールドなし）でも `MasterAgent` を読めるよう、`init(from:)` を手書きし、`decodeIfPresent ?? []` で吸収する。`encode(to:)` は CodingKeys 経由で自動合成。

## 11. 未実装 / 次フェーズ

- UI: Skill Library 画面、Candidates 画面、Agent 詳細の `skillRefs` エディタ。
- GitHub Importer（`SidecarManager` 経由 `git clone --depth=1`、commit SHA 固定）。
- AI 候補探索（候補追加のみ、自動インストール禁止）。
- SemVer 比較、`latestCompatible` の正式実装。
- バンドル Skill の同梱配布。
- 候補バッチの空ディレクトリ掃除。

## 12. 関連ソース

- モデル: [AgentRefinementApp/AgentRefinementApp/Models/Skill.swift](../../AgentRefinementApp/AgentRefinementApp/Models/Skill.swift)
- ストア: [AgentRefinementApp/AgentRefinementApp/Services/SkillStore.swift](../../AgentRefinementApp/AgentRefinementApp/Services/SkillStore.swift)
- レンダラ: [AgentRefinementApp/AgentRefinementApp/Engine/SkillPromptRenderer.swift](../../AgentRefinementApp/AgentRefinementApp/Engine/SkillPromptRenderer.swift)
- 注入箇所: [AgentRefinementApp/AgentRefinementApp/Engine/PromptBuilder.swift](../../AgentRefinementApp/AgentRefinementApp/Engine/PromptBuilder.swift)
- 配線: [AgentRefinementApp/AgentRefinementApp/Engine/Orchestrator.swift](../../AgentRefinementApp/AgentRefinementApp/Engine/Orchestrator.swift), [AgentRefinementApp/AgentRefinementApp/AppState.swift](../../AgentRefinementApp/AgentRefinementApp/AppState.swift)
- テスト: [AgentRefinementApp/AgentRefinementAppTests/Services/SkillStoreTests.swift](../../AgentRefinementApp/AgentRefinementAppTests/Services/SkillStoreTests.swift), [AgentRefinementApp/AgentRefinementAppTests/Engine/PromptBuilderTests.swift](../../AgentRefinementApp/AgentRefinementAppTests/Engine/PromptBuilderTests.swift), [AgentRefinementApp/AgentRefinementAppTests/Models/MasterAgentCodableTests.swift](../../AgentRefinementApp/AgentRefinementAppTests/Models/MasterAgentCodableTests.swift)
