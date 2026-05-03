# AgentRefinement macOS App 仕様書

## 1. 概要

| 項目 | 内容 |
|------|------|
| 製品名 | AgentRefinement |
| 種別 | macOS ネイティブアプリ（SwiftUI + AppKit） |
| 最小 OS | macOS 14 Sonoma |
| バックエンド | FastAPI（`http://127.0.0.1:8000`）をサイドカーで起動 |
| 永続化 | `~/.agent-refinement/` 以下に JSON ファイルとして保存 |
| 状態管理 | `AppState: ObservableObject`（`@MainActor`） |

---

## 2. レイアウト構造

```
┌──────────────────────────────────────────────────────────────────────┐
│  ActivityBar(48)│  Sidebar(180-240)  │  MainArea(flex)  │Detail(260) │
│                 │                    │  ┌──────────────┐ │            │
│  [Project N]    │  EXPLORER          │  │ Tab Bar      │ │ Agent Edit │
│  [Project N]    │  working_dir/      │  ├──────────────┤ │ Form       │
│                 │    ├ src/          │  │ Screen View  │ │            │
│  [Spacer]       │    ├ README.md     │  │              │ │            │
│                 │                    │  ├──────────────┤ │            │
│  [+]            │                    │  │ Bottom Panel │ │            │
│  [⚙]            │                    │  └──────────────┘ │            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. ActivityBar

**ファイル:** `Views/ActivityBar.swift`

### 表示
- 幅 48pt、高さ全体
- 各プロジェクトを 34×34pt の正方形ボタンで表示（プロジェクト名の頭文字）
- 選択中は `accentColor.opacity(0.2)` の背景
- ホバーで `.help(project.name)` ツールチップ

### 操作
| 操作 | 動作 |
|------|------|
| プロジェクトをクリック | `selectedProjectId` を更新 → 全画面が差し替わる |
| `+` ボタン | **新規プロジェクト作成シート**を開く（★未実装） |
| `⚙` ボタン | 設定画面（未実装） |

### 新規プロジェクト作成シート（未実装）
- `NewProjectSheet.swift` を新規作成
- 入力項目:
  - プロジェクト名 `TextField`
  - 作業ディレクトリ `TextField` + `📂 選択` ボタン（`NSOpenPanel`）
- 作成後 `appState.addProject(name:workingDirectory:)` を呼び出す
- **現状の問題:** `onAddProject` が `name: "New Project", workingDirectory: "/tmp"` をハードコード

---

## 4. Sidebar — ファイルエクスプローラー

**ファイル:** `Views/SidebarView.swift`, `Views/Components/FileTreeView.swift`

### 表示
- 幅 180–240pt（理想 200pt）
- ヘッダー: `EXPLORER` ラベル + 選択プロジェクトの `workingDirectory` のフォルダ名
- ボディ: `FileTreeView(rootPath: workingDirectory)` — 深さ3まで再帰展開
- プロジェクト未選択時は「案件を選択してください」プレースホルダー

### FileTreeView 仕様
- 隠しファイルは非表示（`.skipsHiddenFiles`）
- ディレクトリ → ファイルの順にソート、各カテゴリ内は辞書順
- 展開/折りたたみ可（デフォルト展開）
- インデント: 14pt/depth

---

## 5. MainTabView — 4タブ

**ファイル:** `Views/MainTabView.swift`

| タブ | 日本語名 | アイコン | Screen |
|------|---------|---------|--------|
| `.requirements` | 要件・実行 | 📋 | `RequirementsScreen` |
| `.templates` | 組織テンプレート | 🏢 | `TemplatesScreen` |
| `.agents` | エージェント管理 | 🤖 | `AgentsScreen` |
| `.workflow` | ワークフローエディタ | 🔀 | `WorkflowScreen` |

選択中タブは太字 + `accentColor.opacity(0.1)` 背景 + 下線バー

---

## 5.1 要件・実行 (RequirementsScreen)

**ファイル:** `Views/Screens/RequirementsScreen.swift`

### 構成
1. **要件バー**（上端）: テキストフィールド + `▶ 実行` ボタン
2. **実行ログ領域**: `ExecutionLogTable` — エージェント × ステータス × ログのテーブル
3. **CEO チャット**（下端、高さ 100pt）: `CEOChatView` — チャット履歴 + 入力フィールド

### 実行フロー
1. 要件テキストを入力 → `実行` ボタン
2. `appState.executeRefinement(requirements:)` を非同期呼び出し
3. FastAPI `POST /api/refine/stream` をSSEストリーミング
4. イベント種別: `turn_start / turn_output / turn_end / run_complete / run_failed`
5. 実行中は `isExecuting=true` でボタン無効化

---

## 5.2 組織テンプレート (TemplatesScreen)

**ファイル:** `Views/Screens/TemplatesScreen.swift`

### 構成（HSplitView）
- **左ペイン（200-260pt）**: テンプレート一覧 + `新規` ボタン
- **右ペイン**: 選択テンプレートの編集フォーム

### 編集フォーム (TemplateDetailView)
| フィールド | 型 | 説明 |
|-----------|-----|------|
| テンプレート名 | TextField | |
| オーケストレーション | Picker | `sequential / dependency_graph / role_based` |
| ラウンド数 | Picker | 1–5 |
| モード | Picker | `writing / coding` |
| スロット定義 | SlotEditor リスト | ロール・人数・必須フラグ |

---

## 5.3 エージェント管理 (AgentsScreen)

**ファイル:** `Views/Screens/AgentsScreen.swift`, `Views/Components/AgentCard.swift`

### 構成
- **ツールバー**: 検索フィールド + ロールフィルターバー + `新規エージェント` ボタン
- **カードグリッド**: `LazyVGrid(adaptive: 220-300)` — `AgentCard` を並べる

### AgentCard 表示項目
- ロールアイコン（背景色付き 36×36）
- エージェント名 + プロバイダー・モデル
- ロールバッジ（複数）
- ペルソナ冒頭2行

### 詳細編集は DetailPanel（右側）で行う

---

## 5.4 ワークフローエディタ (WorkflowScreen)

**ファイル:** `Views/Screens/WorkflowScreen.swift`

### 構成
- **ツールバー**: ワークフロー選択ポップオーバー + 削除 + 保存 + `▶ このフローで実行`
- **キャンバス**: `WorkflowCanvasView`（WKWebView ラッパー） — HTML/JS ノードエディタ
- **プロパティパネル（右）**: `WorkflowPropertiesPanel` — 選択ノードの設定

### WorkflowBridge (Swift ↔ JS)
- `WorkflowBridge.swift`: `WKScriptMessageHandler` でJS→Swift通知
- メッセージ種別: `nodeSelected / nodeAdded / edgeAdded / workflowData`
- Swift→JS: `bridge.loadWorkflow()`, `bridge.deleteSelectedNode()`, `bridge.getWorkflowData()`

### ノード種別
`start / end / slot / gate / loop / fork / join`

---

## 6. BottomPanel

**ファイル:** `Views/BottomPanelView.swift`

固定高さ 80pt。2タブ構成。

### エージェントタブ
- 横スクロールのカルーセル
- 各エージェントカードは約 110pt 幅：ロールアイコン + 名前 + ロール一覧
- 先頭に `+` ボタン（新規エージェント追加）
- 選択中は `accentColor` の枠線

### ターミナルタブ（★未実装）
- 現状: `"ターミナル（Phase 2で実装）"` のプレースホルダー
- 目標: 組み込みシェルターミナル
- 実装方針: `Process` + 疑似端末（PTY）または `NSTask` + `Pipe` で Zsh を起動し、`TextEditor` でI/O表示

---

## 7. DetailPanel — エージェント編集

**ファイル:** `Views/DetailPanelView.swift`

幅 220–300pt（理想 260pt）。`appState.selectedAgent` が nil の場合はプレースホルダー。

### AgentEditForm フィールド
| フィールド | 型 | 対応モデルプロパティ |
|-----------|-----|-------------------|
| 名前 | TextField | `name` |
| 組織ロール | 複数選択タグ | `orgRoles: [OrgRole]` |
| 実行モード | Segmented Picker | `mode: AgentMode` |
| プロバイダー | Picker | `provider: ProviderKind` |
| モデル | TextField | `model: String?` |
| ペルソナ | TextEditor (60pt) | `persona: String?` |
| スキル | TextField（カンマ区切り） | `skills: [String]` |
| モデル決定 | Segmented Picker | `modelDecision: ModelDecision` |
| MCP有効 | Toggle | `mcpEnabled: Bool` |
| MCP Config Path | TextField（MCP有効時） | `mcpConfigPath: String?` |

ボタン: `複製して作成` / `削除` / `保存`

---

## 8. データモデル

### Project
```
id: UUID, name: String, status: ProjectStatus, workingDirectory: String
templateId: String?, workflowId: String?, requirements: String?
agentSnapshots: [AgentSnapshot], createdAt: Date, updatedAt: Date
```

### MasterAgent
```
id: String (slug), name: String, orgRoles: [OrgRole], mode: AgentMode
provider: ProviderKind, model: String?, persona: String?
skills: [String], dependsOn: [String], commandTemplate: String?
mcpEnabled: Bool, mcpConfigPath: String?, mcpServers: [String]
mcpInstruction: String?, mcpContextCommand: String?, mcpTimeoutSec: Int
modelDecision: ModelDecision, createdAt: Date, updatedAt: Date
```

### OrganizationTemplate
```
id: UUID, name: String, isPreset: Bool
orchestrationMode: String, workflowMode: String, rounds: Int
slots: [Slot], createdAt: Date, updatedAt: Date
```

### Workflow
```
id: UUID, name: String, isPreset: Bool
nodes: [WorkflowNode], edges: [WorkflowEdge]
createdAt: Date, updatedAt: Date
```

### OrgRole (enum)
`ceo / manager / worker / pmo / qa / uiDesigner / systemDesigner / opsDesigner / other`

---

## 9. 永続化

`DataStore.swift` — `~/.agent-refinement/` 以下に JSON ファイル

| エンティティ | ファイルパス |
|-------------|-------------|
| Agent | `.../agents/<id>.json` |
| Project | `.../projects/<uuid>.json` |
| Template | `.../templates/<uuid>.json` |
| Workflow | `.../workflows/<uuid>.json` |

---

## 10. 未実装・課題一覧

| # | 問題 | 影響 | 対応方針 |
|---|------|------|---------|
| 1 | 新規プロジェクト作成が `name="New Project"`, `workingDirectory="/tmp"` にハードコード | 作業ディレクトリが `/tmp` 固定になる | `NewProjectSheet.swift` を作成、`NSOpenPanel` でディレクトリ選択 |
| 2 | プロジェクト更新 API がない（`updateProject` 未実装） | プロジェクト名・ディレクトリを作成後に変更できない | `AppState.updateProject(_:)` を追加 |
| 3 | ターミナルタブがプレースホルダー | ボトムパネルのターミナルタブが空 | `TerminalView` を実装（PTY + Zsh） |
| 4 | プロジェクト右クリックメニューなし | リネーム・削除が ActivityBar からできない | コンテキストメニューを追加 |
| 5 | `⚙` 設定ボタンが no-op | 設定画面がない | 設定シートを実装（APIエンドポイント設定など） |

---

## 11. 実装優先順

1. **新規プロジェクト作成シート**（`NewProjectSheet.swift` + `NSOpenPanel`）← 最優先
2. **`AppState.updateProject(_:)`** の追加
3. **プロジェクト右クリックメニュー**（リネーム・削除）
4. **ターミナルタブ**（`TerminalView.swift`）
5. **設定画面**（API URL、テーマなど）
