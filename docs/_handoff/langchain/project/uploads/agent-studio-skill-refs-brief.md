# Agent Studio `skill_refs` Editor Brief

このブリーフは Web/Python 版 Agent Studio に **Skill Reference エディタ**を追加する実装依頼です。

## 前提（既に実装済み）

- バックエンド Skill Package Manager（`app/skills/`）
  - `SkillStore`、`SkillPromptRenderer`、`/api/skills/*` 系エンドポイント
- `AgentConfig.skill_refs: list[SkillReference]`（Pydantic）
- 旧 `skills: list[str]` はタグ用に併存
- フロント
  - 型: `SkillReference / SkillSource / SkillVersionRequirement / SkillDocument` ([app/web/src/types.ts](../../app/web/src/types.ts))
  - API クライアント: `api.listSkills` 等 ([app/web/src/api/client.ts](../../app/web/src/api/client.ts))
  - 画面: `Skills` 画面（Library / Candidates 管理） ([app/web/src/screens/Skills.tsx](../../app/web/src/screens/Skills.tsx))

参照仕様:
- [skill-management-web-python-brief.md](skill-management-web-python-brief.md)
- [skill-package-manager.md](skill-package-manager.md)（Mac 側の正本仕様）

## 目的

Agent Studio で **インストール済み Skill を agent に紐付け**できるようにする。
現在 Agent Studio では `skills: string[]`（自由文字列）しか編集できない。

## ゴール

`AgentEditor` に「**インストール済みスキルから選ぶ**」セクションを追加：

1. Library から Skill を選んで `skill_refs[]` に追加
2. 各 ref の **バージョン要求**（exact / latest_compatible / latest）を選択
3. 各 ref の **enabled トグル**
4. 不適合警告: 選んだ Skill の `providers[]` / `roles[]` が agent の `provider` / `org_role` と一致しないときバッジ表示
5. ref の削除
6. Skill 詳細プレビュー（hover or expand）

旧 `skills: string[]` の自由文字列タグは**そのまま残す**（薄いラベル用途）。

## 編集対象

- `app/web/src/screens/AgentStudio.tsx` の `AgentEditor` コンポーネント

## UI 仕様

`AgentEditor` の既存セクション（基本情報 / persona / skills 文字列 など）の下に追加：

```
┌─ インストール済みスキル ─────────────────────┐
│ [+ スキルを追加] (Library から選択 picker)    │
│                                              │
│ ▸ swiftui-implementation                ⚠   │
│   version: [latest ▾]   enabled: [✔]   [×]  │
│   ⚠ provider mismatch (claude_cli)          │
│                                              │
│ ▸ python-fastapi                            │
│   version: [exact: 1.2.0 ▾]   [✔]    [×]   │
└──────────────────────────────────────────────┘
```

操作:
- **追加 Picker**: ドロップダウン or モーダル。Library から id を選び `version_requirement: { kind: "latest" }`、`enabled: true`、`source: "user"` でデフォルト追加
- **version dropdown**: `latest` / `latest_compatible` / `exact: <version>`（exact のときは installed バージョン一覧を select）
- **enabled トグル**: チェックボックス
- **削除**: × アイコン
- **不適合警告**: agent.provider が skill.metadata.providers に含まれない、または agent.org_role が skill.metadata.roles に含まれない場合、`AlertTriangle` 黄色アイコン + tooltip で理由表示。providers / roles が空配列なら「全 provider / 全 role に適用」とみなし警告しない

## データフロー

```ts
// AgentStudio で Library を読み込む
const installedSkills = await api.listSkills();

// agent.skill_refs を編集して保存（既存 saveAgent と同じ経路）
const updated: AgentConfig = { ...agent, skill_refs: nextRefs };
await api.updateAgent(agent.id, updated);
```

`AgentConfig.skill_refs` は既に Pydantic で受け付けるので backend 変更不要。

## 受入条件

- [ ] AgentEditor に「インストール済みスキル」セクションが表示される
- [ ] Library から Skill を追加して保存できる
- [ ] `skill_refs[]` の中身（version_requirement / enabled）を編集して保存できる
- [ ] 個別削除できる
- [ ] provider / role 不適合のとき警告アイコンとメッセージが出る
- [ ] Built-in agent では編集不可（既存の `isBuiltin` 判定をそのまま流用）
- [ ] tsc エラーなし
- [ ] 旧 `skills: string[]` 編集 UI は残置（壊さない）

## やらないこと（このブリーフのスコープ外）

- GitHub からの Skill 取り込み（Phase 3）
- AI 候補探索（Phase 3）
- SemVer の正式実装（Phase 4）
- Skill Picker のリッチプレビュー（最低限 description が見えれば OK）

## Codex 用プロンプト（コピペ用）

```text
Implement the Agent Studio skill_refs editor described in
docs/specs/agent-studio-skill-refs-brief.md.

Scope:
- Edit only app/web/src/screens/AgentStudio.tsx (and small shared utils if needed).
- Add an "インストール済みスキル" section to AgentEditor.
- Load installed skills via api.listSkills().
- Allow adding/removing skill_refs, choosing version requirement, toggling enabled.
- Show a warning badge when the selected skill's providers or roles
  do not include the current agent's provider / org_role
  (empty providers / roles means applies to all, no warning).
- Built-in agents stay read-only (use the existing isBuiltin helper).
- Keep the existing free-form skills: string[] editor intact.

Constraints:
- No backend changes. AgentConfig.skill_refs already accepted by Pydantic.
- Keep the diff focused, do not refactor unrelated code.
- Run `npx tsc -b --noEmit` from app/web/ and confirm exit 0.
- No new dependencies.

After implementation, briefly note in TODO.md that
"Skill Package Manager Phase 2: Agent Studio skill_refs editor" is done.
```

## 補足

- 既存 [Skills.tsx](../../app/web/src/screens/Skills.tsx) を参考に provider/role 表示の見た目を揃えると統一感が出る
- `Library` 全件を AgentStudio マウント時に取得しておく方法と、Picker を開いた瞬間に取りに行く方法の両方あり。前者で十分（一覧は小さい）
