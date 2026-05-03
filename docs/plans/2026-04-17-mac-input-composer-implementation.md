# Mac Input Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 要件入力・CEOチャット・Terminal入力を複数行入力化し、`Enter=改行` / `Cmd+Enter=送信(実行)` を統一しつつ、Observableな状態管理で運用する。

**Architecture:** `NSTextView` をラップした共通コンポーネント `MultilineComposer` を導入し、3画面で再利用する。入力ドラフトは `AppState` に寄せ、画面側は `Binding` による表示・操作に限定する。IME変換中ガードと空入力ガードを共通化して誤送信を防ぐ。

**Tech Stack:** SwiftUI, AppKit (`NSTextView` / `NSViewRepresentable`), Swift Testing (`Testing`)

---

## File Structure / Responsibilities

- Modify: `AgentRefinementApp/AgentRefinementApp/AppState.swift`
  - 入力ドラフト状態（要件・チャット・Terminal）を `@Published` で管理
  - 空入力判定と送信後クリアを行う小さなヘルパーを提供
- Create: `AgentRefinementApp/AgentRefinementApp/Views/Components/MultilineComposer.swift`
  - `NSTextView` ベース共通入力
  - プレースホルダ、高さ自動調整、`Cmd+Enter` 検知、IME変換中ガード
- Modify: `AgentRefinementApp/AgentRefinementApp/Views/Screens/RequirementsScreen.swift`
  - 要件入力を `MultilineComposer` に置換
  - `AppState.requirementsDraft` をバインド
- Modify: `AgentRefinementApp/AgentRefinementApp/Views/Components/CEOChatView.swift`
  - チャット入力を `MultilineComposer` に置換
  - `AppState.chatDraft` をバインド
- Modify: `AgentRefinementApp/AgentRefinementApp/Views/Components/TerminalView.swift`
  - Terminal入力を `MultilineComposer` に置換
  - `AppState.terminalDraft` は使わず画面ローカルを維持（プロセス結合が強いため）
- Test: `AgentRefinementApp/AgentRefinementAppTests/AppStateTests.swift`
  - 入力ドラフトの空白ガードと送信時クリアの回帰テスト
- Create: `AgentRefinementApp/AgentRefinementAppTests/Views/MultilineComposerKeyTests.swift`
  - `Cmd+Enter` 判定の純粋ロジックをテスト（UI依存を避ける）

### Task 1: AppState に入力ドラフト状態を集約

**Files:**
- Modify: `AgentRefinementApp/AgentRefinementApp/AppState.swift`
- Test: `AgentRefinementApp/AgentRefinementAppTests/AppStateTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
@Test("Requirements draft submit trims text and clears state")
@MainActor
func requirementsDraftSubmit() {
    let state = AppState(dataStore: DataStore(baseDirectory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)))
    state.requirementsDraft = "  hello\nworld  "

    let submitted = state.consumeRequirementsDraft()

    #expect(submitted == "hello\nworld")
    #expect(state.requirementsDraft.isEmpty)
}

@Test("Requirements draft submit returns nil for blank text")
@MainActor
func requirementsDraftRejectsBlank() {
    let state = AppState(dataStore: DataStore(baseDirectory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)))
    state.requirementsDraft = "   \n  "

    let submitted = state.consumeRequirementsDraft()

    #expect(submitted == nil)
    #expect(state.requirementsDraft == "   \n  ")
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter AppStateTests`
Expected: FAIL with `AppState` に `requirementsDraft` / `consumeRequirementsDraft` が未定義

- [ ] **Step 3: Write minimal implementation**

```swift
@Published var requirementsDraft: String = ""
@Published var chatDraft: String = ""

func consumeRequirementsDraft() -> String? {
    let trimmed = requirementsDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    requirementsDraft = ""
    return trimmed
}

func consumeChatDraft() -> String? {
    let trimmed = chatDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    chatDraft = ""
    return trimmed
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `swift test --filter AppStateTests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add AgentRefinementApp/AgentRefinementApp/AppState.swift AgentRefinementApp/AgentRefinementAppTests/AppStateTests.swift
git commit -m "feat: add observable drafts for requirements and chat input"
```

### Task 2: MultilineComposer 共通コンポーネントを追加

**Files:**
- Create: `AgentRefinementApp/AgentRefinementApp/Views/Components/MultilineComposer.swift`
- Create: `AgentRefinementApp/AgentRefinementAppTests/Views/MultilineComposerKeyTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
@Test("Cmd+Enter triggers submit key action")
func cmdEnterAction() {
    let action = MultilineComposerKeyResolver.resolve(keyCode: 36, modifierFlags: [.command], hasMarkedText: false)
    #expect(action == .submit)
}

@Test("Enter without command inserts newline")
func enterAction() {
    let action = MultilineComposerKeyResolver.resolve(keyCode: 36, modifierFlags: [], hasMarkedText: false)
    #expect(action == .newline)
}

@Test("IME marked text prevents submit")
func imeMarkedTextBlocksSubmit() {
    let action = MultilineComposerKeyResolver.resolve(keyCode: 36, modifierFlags: [.command], hasMarkedText: true)
    #expect(action == .none)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter MultilineComposerKeyTests`
Expected: FAIL with `MultilineComposerKeyResolver` 未定義

- [ ] **Step 3: Write minimal implementation**

```swift
enum ComposerKeyAction: Equatable { case none, newline, submit }

enum MultilineComposerKeyResolver {
    static func resolve(keyCode: UInt16, modifierFlags: NSEvent.ModifierFlags, hasMarkedText: Bool) -> ComposerKeyAction {
        guard keyCode == 36 else { return .none }
        guard !hasMarkedText else { return .none }
        return modifierFlags.contains(.command) ? .submit : .newline
    }
}
```

`MultilineComposer` 本体では `NSTextView` サブクラスで `keyDown` をオーバーライドし、上記 resolver の結果で `onSubmit` 呼び出し or `insertNewline` を実行する。

- [ ] **Step 4: Run test to verify it passes**

Run: `swift test --filter MultilineComposerKeyTests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add AgentRefinementApp/AgentRefinementApp/Views/Components/MultilineComposer.swift AgentRefinementApp/AgentRefinementAppTests/Views/MultilineComposerKeyTests.swift
git commit -m "feat: add multiline composer with cmd-enter submit behavior"
```

### Task 3: RequirementsScreen に MultilineComposer を適用

**Files:**
- Modify: `AgentRefinementApp/AgentRefinementApp/Views/Screens/RequirementsScreen.swift`
- Test: `AgentRefinementApp/AgentRefinementAppTests/AppStateTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
@Test("Requirements consume clears draft and preserves multiline")
@MainActor
func requirementsConsumePreservesNewline() {
    let state = AppState(dataStore: DataStore(baseDirectory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)))
    state.requirementsDraft = "a\nb"
    let submitted = state.consumeRequirementsDraft()
    #expect(submitted == "a\nb")
    #expect(state.requirementsDraft == "")
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter AppStateTests`
Expected: FAIL before Task 1 merged; after Task 1 mergedなら PASS（この場合は次Stepへ）

- [ ] **Step 3: Write minimal implementation**

`RequirementsScreen` の `TextField` を `MultilineComposer` に置換し、次のように呼び出す。

```swift
MultilineComposer(
    text: $appState.requirementsDraft,
    placeholder: "要件を入力...",
    minHeight: 36,
    maxHeight: 140,
    isEnabled: !appState.isExecuting
) {
    startExecution()
}
```

`startExecution()` 冒頭を以下に変更。

```swift
guard let requirements = appState.consumeRequirementsDraft() else { return }
```

補助テキストとして `Cmd+Enter で実行` を表示。

- [ ] **Step 4: Run tests**

Run: `swift test --filter AppStateTests`
Expected: PASS

Run: `swift test`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add AgentRefinementApp/AgentRefinementApp/Views/Screens/RequirementsScreen.swift AgentRefinementApp/AgentRefinementAppTests/AppStateTests.swift
git commit -m "feat: migrate requirements input to multiline composer"
```

### Task 4: CEOChatView に MultilineComposer を適用

**Files:**
- Modify: `AgentRefinementApp/AgentRefinementApp/Views/Components/CEOChatView.swift`
- Modify: `AgentRefinementApp/AgentRefinementApp/Views/Screens/RequirementsScreen.swift`
- Test: `AgentRefinementApp/AgentRefinementAppTests/AppStateTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
@Test("Chat draft submit trims text and clears state")
@MainActor
func chatDraftSubmit() {
    let state = AppState(dataStore: DataStore(baseDirectory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)))
    state.chatDraft = "  ping  "

    let submitted = state.consumeChatDraft()

    #expect(submitted == "ping")
    #expect(state.chatDraft.isEmpty)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter AppStateTests`
Expected: FAIL before `consumeChatDraft` 実装; Task 1後は PASS（この場合は次Stepへ）

- [ ] **Step 3: Write minimal implementation**

`CEOChatView` の `@State private var inputText` を削除し、`@Binding var inputText: String` を受ける。

```swift
struct CEOChatView: View {
    @Binding var inputText: String
    let messages: [ChatMessage]
    let onSend: (String) -> Void
}
```

入力欄を `MultilineComposer` に置換。

```swift
MultilineComposer(
    text: $inputText,
    placeholder: "メッセージを入力...",
    minHeight: 34,
    maxHeight: 120,
    isEnabled: true,
    onSubmit: send
)
```

`RequirementsScreen` からは `appState.chatDraft` を渡す。

```swift
CEOChatView(inputText: $appState.chatDraft, messages: chatMessages) { message in
    chatMessages.append(ChatMessage(sender: "あなた", icon: "👤", content: message, isUser: true))
}
```

`send()` 内は trim + 空判定 + 送信後クリアを維持。

- [ ] **Step 4: Run tests**

Run: `swift test --filter AppStateTests`
Expected: PASS

Run: `swift test`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add AgentRefinementApp/AgentRefinementApp/Views/Components/CEOChatView.swift AgentRefinementApp/AgentRefinementApp/Views/Screens/RequirementsScreen.swift AgentRefinementApp/AgentRefinementAppTests/AppStateTests.swift
git commit -m "feat: migrate ceo chat input to observable multiline composer"
```

### Task 5: TerminalView に MultilineComposer を適用

**Files:**
- Modify: `AgentRefinementApp/AgentRefinementApp/Views/Components/TerminalView.swift`
- Test: `AgentRefinementApp/AgentRefinementAppTests/Views/MultilineComposerKeyTests.swift`

- [ ] **Step 1: Write the failing test**

`MultilineComposerKeyTests` に次を追加。

```swift
@Test("Non-enter key returns none")
func otherKeyAction() {
    let action = MultilineComposerKeyResolver.resolve(keyCode: 0, modifierFlags: [.command], hasMarkedText: false)
    #expect(action == .none)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `swift test --filter MultilineComposerKeyTests`
Expected: FAIL before test追加対応; 既存実装不足なら FAIL

- [ ] **Step 3: Write minimal implementation**

`TerminalView` の `TextField` を `MultilineComposer` に置換。

```swift
MultilineComposer(
    text: $inputText,
    placeholder: "コマンドを入力...",
    minHeight: 30,
    maxHeight: 120,
    isEnabled: true,
    onSubmit: sendCommand
)
```

`sendCommand()` は `trimmingCharacters(in: .whitespacesAndNewlines)` で空コマンド送信を防ぐ。

```swift
let cmd = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
guard !cmd.isEmpty else { return }
```

- [ ] **Step 4: Run tests**

Run: `swift test --filter MultilineComposerKeyTests`
Expected: PASS

Run: `swift test`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add AgentRefinementApp/AgentRefinementApp/Views/Components/TerminalView.swift AgentRefinementApp/AgentRefinementAppTests/Views/MultilineComposerKeyTests.swift
git commit -m "feat: migrate terminal input to multiline composer"
```

### Task 6: 最終検証（手動）

**Files:**
- Modify: なし（検証のみ）

- [ ] **Step 1: Build and test**

Run: `swift test`
Expected: PASS (all tests)

- [ ] **Step 2: Run app and verify key interactions**

Run: `swift run`
Expected: App launch

手動確認:
- 要件入力: Enter改行、Cmd+Enter実行、空入力は無効
- CEOチャット: Enter改行、Cmd+Enter送信、送信後クリア
- Terminal: Enter改行、Cmd+Enter投入
- 日本語IME変換中 Cmd+Enter で送信されない

- [ ] **Step 3: Commit verification note (optional if docs更新する場合のみ)**

```bash
git add docs/superpowers/specs/2026-04-17-mac-input-composer-design.md
# docs変更がある場合のみ
git commit -m "docs: record verification results for multiline composer"
```

## Self-Review Checklist

- Spec coverage:
  - `Enter/Cmd+Enter` 統一: Task 2/3/4/5 で対応
  - 要件・CEO複数行化: Task 3/4 で対応
  - Terminal複数行 + Cmd+Enter: Task 5 で対応
  - IME変換中送信抑止: Task 2 で対応
  - Observable志向: Task 1/4 で入力ドラフトを AppState 集約
- Placeholder scan: `TBD` / `TODO` / vague step なし
- Type consistency:
  - `requirementsDraft`, `chatDraft`, `consumeRequirementsDraft`, `consumeChatDraft`
  - `MultilineComposerKeyResolver.resolve(...)`
  - `MultilineComposer(text:placeholder:minHeight:maxHeight:isEnabled:onSubmit:)`
