# App Store向け macOSネイティブアプリ — Python排除 + Xcode Project化

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現在の Swift Package + Python FastAPI 構成から、Python依存を完全に排除し、App Store審査に通る正式なXcodeプロジェクト（.app バンドル、コード署名、App Sandbox）を作成する。

**Architecture:** Pythonバックエンド（providers.py 156行 + orchestrator.py 571行）をSwiftに移植。CLI実行は `Process` API、プロンプト構築は Swift 文字列テンプレート、トポロジカルソートは Swift アルゴリズムで置き換え。FastAPI/HTTP通信層は不要になり、直接関数呼び出しに変更。

**Tech Stack:** Swift 5.9+, SwiftUI, WKWebView, Xcode 15+, App Sandbox

---

## 作業フォルダー

全ての作業は `/Users/sfidante-he/workspace/LangChain/AgentRefinementApp/` に新規作成。既存の `AgentRefinement/` (Package.swift版) は残す。

---

## File Structure

```
AgentRefinementApp/
├── AgentRefinementApp.xcodeproj/           — Xcode Project
├── AgentRefinementApp/
│   ├── AgentRefinementApp.swift            — @main App entry
│   ├── Info.plist                          — Bundle metadata
│   ├── AgentRefinementApp.entitlements     — App Sandbox + Network
│   ├── Assets.xcassets/                    — App icon
│   ├── Models/                             — COPY from existing + minor adjustments
│   │   ├── OrgRole.swift
│   │   ├── Agent.swift
│   │   ├── Evaluation.swift
│   │   ├── Project.swift
│   │   ├── OrganizationTemplate.swift
│   │   └── Workflow.swift
│   ├── Engine/                             — NEW: Python移植コア
│   │   ├── CLIProvider.swift               — providers.py 移植
│   │   ├── PromptBuilder.swift             — プロンプト構築
│   │   ├── Orchestrator.swift              — orchestrator.py 移植
│   │   └── GitHelper.swift                 — git操作ヘルパー
│   ├── Services/
│   │   ├── DataStore.swift                 — COPY
│   │   └── WorkflowBridge.swift            — COPY
│   ├── AppState.swift                      — MODIFY: APIClient除去、Engine直接呼出し
│   ├── Views/                              — COPY all views
│   └── Resources/
│       └── workflow-canvas/                — COPY canvas.html/css/js
├── AgentRefinementAppTests/
│   ├── Engine/
│   │   ├── CLIProviderTests.swift
│   │   ├── PromptBuilderTests.swift
│   │   ├── OrchestratorTests.swift
│   │   └── GitHelperTests.swift
│   └── Models/                             — COPY existing tests
```

---

### Task 1: Xcode Project作成 + 既存コード移植

**Files:**
- Create: `AgentRefinementApp/` ディレクトリ構造全体
- Copy: 既存Models, Views, Services を新プロジェクトへ

- [ ] **Step 1: Xcodeプロジェクト用ディレクトリ作成**

```bash
cd /Users/sfidante-he/workspace/LangChain
mkdir -p AgentRefinementApp/AgentRefinementApp/{Models,Engine,Services,Views/{Screens,Components},Resources/workflow-canvas}
mkdir -p AgentRefinementApp/AgentRefinementAppTests/{Engine,Models,Services}
```

- [ ] **Step 2: Package.swift作成（Xcode Projectへの移行準備）**

Create `AgentRefinementApp/Package.swift`:

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AgentRefinementApp",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "AgentRefinementApp",
            path: "AgentRefinementApp",
            resources: [
                .copy("Resources/workflow-canvas")
            ]
        ),
        .testTarget(
            name: "AgentRefinementAppTests",
            dependencies: ["AgentRefinementApp"],
            path: "AgentRefinementAppTests"
        ),
    ]
)
```

- [ ] **Step 3: 既存Modelsをコピー**

```bash
cp AgentRefinement/AgentRefinement/Models/OrgRole.swift AgentRefinementApp/AgentRefinementApp/Models/
cp AgentRefinement/AgentRefinement/Models/Agent.swift AgentRefinementApp/AgentRefinementApp/Models/
cp AgentRefinement/AgentRefinement/Models/Evaluation.swift AgentRefinementApp/AgentRefinementApp/Models/
cp AgentRefinement/AgentRefinement/Models/Project.swift AgentRefinementApp/AgentRefinementApp/Models/
cp AgentRefinement/AgentRefinement/Models/OrganizationTemplate.swift AgentRefinementApp/AgentRefinementApp/Models/
cp AgentRefinement/AgentRefinement/Models/Workflow.swift AgentRefinementApp/AgentRefinementApp/Models/
```

- [ ] **Step 4: 既存Servicesをコピー（APIClient除外）**

```bash
cp AgentRefinement/AgentRefinement/Services/DataStore.swift AgentRefinementApp/AgentRefinementApp/Services/
cp AgentRefinement/AgentRefinement/Services/WorkflowBridge.swift AgentRefinementApp/AgentRefinementApp/Services/
```

APIModels.swift と SidecarManager.swift と APIClient.swift は**コピーしない**（不要）。

- [ ] **Step 5: 既存Viewsをコピー**

```bash
cp AgentRefinement/AgentRefinement/Views/ActivityBar.swift AgentRefinementApp/AgentRefinementApp/Views/
cp AgentRefinement/AgentRefinement/Views/BottomPanelView.swift AgentRefinementApp/AgentRefinementApp/Views/
cp AgentRefinement/AgentRefinement/Views/ContentView.swift AgentRefinementApp/AgentRefinementApp/Views/
cp AgentRefinement/AgentRefinement/Views/DetailPanelView.swift AgentRefinementApp/AgentRefinementApp/Views/
cp AgentRefinement/AgentRefinement/Views/MainTabView.swift AgentRefinementApp/AgentRefinementApp/Views/
cp AgentRefinement/AgentRefinement/Views/SidebarView.swift AgentRefinementApp/AgentRefinementApp/Views/
cp AgentRefinement/AgentRefinement/Views/Components/*.swift AgentRefinementApp/AgentRefinementApp/Views/Components/
cp AgentRefinement/AgentRefinement/Views/Screens/*.swift AgentRefinementApp/AgentRefinementApp/Views/Screens/
```

- [ ] **Step 6: workflow-canvasリソースをコピー**

```bash
cp AgentRefinement/AgentRefinement/Views/workflow-canvas/* AgentRefinementApp/AgentRefinementApp/Resources/workflow-canvas/
```

- [ ] **Step 7: 既存テストをコピー**

```bash
cp AgentRefinement/AgentRefinementTests/Models/*.swift AgentRefinementApp/AgentRefinementAppTests/Models/
cp AgentRefinement/AgentRefinementTests/Services/*.swift AgentRefinementApp/AgentRefinementAppTests/Services/
cp AgentRefinement/AgentRefinementTests/AppStateTests.swift AgentRefinementApp/AgentRefinementAppTests/
```

- [ ] **Step 8: App entry point作成**

Create `AgentRefinementApp/AgentRefinementApp/AgentRefinementApp.swift`:

```swift
import SwiftUI

@main
struct AgentRefinementAppEntry: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .onAppear {
                    appState.loadAll()
                }
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1400, height: 900)
    }
}
```

- [ ] **Step 9: AppState.swiftをコピーしてAPIClient参照を除去**

既存のAppState.swiftをコピーし、以下の変更を適用:
- `let apiClient: APIClient` を削除
- init から `apiClient` パラメータを削除
- `executionEvents: [StreamEvent]` を `executionEvents: [[String: Any]]` に変更（StreamEvent依存排除）
- `executeRefinement` メソッドは次のタスクで書き直すのでプレースホルダーにする

```swift
// executeRefinement は Task 4 で Engine.Orchestrator を使って書き直す
func executeRefinement(requirements: String) async {
    // TODO: Task 4 で実装
}
```

- [ ] **Step 10: WorkflowCanvasViewのリソースパス修正**

`WorkflowCanvasView.swift` 内のリソースパスを修正:
```swift
// 旧: subdirectory: "Views/workflow-canvas"
// 新: subdirectory: "Resources/workflow-canvas"
if let htmlURL = Bundle.main.url(forResource: "canvas", withExtension: "html", subdirectory: "Resources/workflow-canvas") {
```

- [ ] **Step 11: ビルド確認**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinementApp
swift build
```

コンパイルエラーがあれば修正（APIClient/SidecarManager/StreamEvent参照の除去など）。

- [ ] **Step 12: コミット**

```bash
git add AgentRefinementApp/
git commit -m "feat: create App Store project with existing code, no Python dependency"
```

---

### Task 2: CLIProvider — providers.py のSwift移植

**Files:**
- Create: `AgentRefinementApp/AgentRefinementApp/Engine/CLIProvider.swift`
- Create: `AgentRefinementApp/AgentRefinementAppTests/Engine/CLIProviderTests.swift`

- [ ] **Step 1: Write failing tests**

Create `AgentRefinementApp/AgentRefinementAppTests/Engine/CLIProviderTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("CLIProvider Tests")
struct CLIProviderTests {

    @Test("Build args replaces prompt placeholder")
    func buildArgsReplacesPrompt() {
        let provider = CLIProvider(commandTemplate: "echo {prompt}", timeoutSec: 30)
        let args = provider.buildArgs(prompt: "hello world", model: nil, mcpConfigPath: nil, mcpServers: nil)
        #expect(args == ["echo", "hello world"])
    }

    @Test("Build args appends prompt when no placeholder")
    func buildArgsAppendsPrompt() {
        let provider = CLIProvider(commandTemplate: "echo", timeoutSec: 30)
        let args = provider.buildArgs(prompt: "hello", model: nil, mcpConfigPath: nil, mcpServers: nil)
        #expect(args == ["echo", "hello"])
    }

    @Test("Build args replaces model placeholder")
    func buildArgsReplacesModel() {
        let provider = CLIProvider(commandTemplate: "cli --model {model} {prompt}", timeoutSec: 30)
        let args = provider.buildArgs(prompt: "test", model: "gpt-4", mcpConfigPath: nil, mcpServers: nil)
        #expect(args.contains("gpt-4"))
        #expect(args.contains("test"))
    }

    @Test("Build args replaces MCP servers CSV")
    func buildArgsMcpServers() {
        let provider = CLIProvider(commandTemplate: "cli --servers {mcp_servers_csv} {prompt}", timeoutSec: 30)
        let args = provider.buildArgs(prompt: "x", model: nil, mcpConfigPath: nil, mcpServers: ["a", "b"])
        #expect(args.contains("a,b"))
    }

    @Test("Resolve provider returns correct template for gemini")
    func resolveGemini() throws {
        let provider = try CLIProvider.resolve(providerKind: .geminiCli, commandTemplate: nil, codingMode: false)
        #expect(provider.commandTemplate.contains("gemini"))
    }

    @Test("Resolve provider requires template for custom")
    func resolveCustomRequiresTemplate() {
        #expect(throws: CLIProviderError.self) {
            try CLIProvider.resolve(providerKind: .customCli, commandTemplate: nil, codingMode: false)
        }
    }

    @Test("Generate runs echo command")
    func generateRunsEcho() throws {
        let provider = CLIProvider(commandTemplate: "echo {prompt}", timeoutSec: 10)
        let result = try provider.generate(prompt: "hello", model: nil, cwd: nil, mcpConfigPath: nil, mcpServers: nil)
        #expect(result == "hello")
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinementApp
swift test --filter CLIProviderTests
```

Expected: FAIL

- [ ] **Step 3: Implement CLIProvider**

Create `AgentRefinementApp/AgentRefinementApp/Engine/CLIProvider.swift`:

```swift
import Foundation

enum CLIProviderError: Error, LocalizedError {
    case commandNotFound(String)
    case timeout(Int)
    case nonZeroExit(Int, String)
    case emptyOutput
    case unsupportedProvider(String)
    case customRequiresTemplate

    var errorDescription: String? {
        switch self {
        case .commandNotFound(let cmd): "command not found: \(cmd)"
        case .timeout(let sec): "command timed out after \(sec)s"
        case .nonZeroExit(let code, let detail): "CLI exited with code \(code): \(detail)"
        case .emptyOutput: "CLI returned empty output"
        case .unsupportedProvider(let p): "unsupported provider: \(p)"
        case .customRequiresTemplate: "custom_cli requires command_template"
        }
    }
}

struct CLIProvider: Sendable {
    let commandTemplate: String
    let timeoutSec: Int

    init(commandTemplate: String, timeoutSec: Int = 300) {
        self.commandTemplate = commandTemplate
        self.timeoutSec = timeoutSec
    }

    func buildArgs(
        prompt: String,
        model: String?,
        mcpConfigPath: String?,
        mcpServers: [String]?
    ) -> [String] {
        let servers = mcpServers ?? []
        let replacements: [(String, String)] = [
            ("{prompt}", prompt),
            ("{query}", prompt),
            ("{model}", model ?? ""),
            ("{mcp_config_path}", mcpConfigPath ?? ""),
            ("{mcp_servers_csv}", servers.joined(separator: ",")),
            ("{mcp_servers_json}", String(data: (try? JSONSerialization.data(withJSONObject: servers)) ?? Data(), encoding: .utf8) ?? "[]"),
        ]

        let tokens = shellSplit(commandTemplate)
        var built: [String] = []

        for token in tokens {
            var replaced = token
            for (key, value) in replacements {
                replaced = replaced.replacingOccurrences(of: key, with: value)
            }
            built.append(replaced)
        }

        let hasPromptPlaceholder = tokens.contains { $0.contains("{prompt}") || $0.contains("{query}") }
        if !hasPromptPlaceholder {
            built.append(prompt)
        }

        return built.filter { !$0.isEmpty }
    }

    func generate(
        prompt: String,
        model: String?,
        cwd: String?,
        mcpConfigPath: String?,
        mcpServers: [String]?
    ) throws -> String {
        let args = buildArgs(prompt: prompt, model: model, mcpConfigPath: mcpConfigPath, mcpServers: mcpServers)
        guard !args.isEmpty else { throw CLIProviderError.emptyOutput }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = args
        if let cwd { process.currentDirectoryURL = URL(fileURLWithPath: cwd) }
        process.environment = ProcessInfo.processInfo.environment

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        do {
            try process.run()
        } catch {
            throw CLIProviderError.commandNotFound(args.first ?? "")
        }

        let timer = DispatchSource.makeTimerSource()
        timer.schedule(deadline: .now() + .seconds(timeoutSec))
        timer.setEventHandler { process.terminate() }
        timer.resume()

        process.waitUntilExit()
        timer.cancel()

        let stdout = String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if process.terminationStatus != 0 {
            let detail = stderr.isEmpty ? (stdout.isEmpty ? "unknown CLI error" : stdout) : stderr
            throw CLIProviderError.nonZeroExit(Int(process.terminationStatus), detail)
        }

        if !stdout.isEmpty { return stdout }
        if !stderr.isEmpty { return stderr }
        throw CLIProviderError.emptyOutput
    }

    // MARK: - Factory

    static let defaultCommands: [ProviderKind: String] = [
        .geminiCli: "gemini -p {prompt}",
        .claudeCli: "claude --print --output-format text {prompt}",
        .codexCli: "codex exec -c model_reasoning_effort=high --skip-git-repo-check --sandbox read-only {prompt}",
    ]

    static let codingCommands: [ProviderKind: String] = [
        .codexCli: "codex exec -c model_reasoning_effort=high --full-auto {prompt}",
        .claudeCli: "claude --print --output-format text {prompt}",
        .geminiCli: "gemini -p {prompt}",
    ]

    static func resolve(
        providerKind: ProviderKind,
        commandTemplate: String?,
        codingMode: Bool = false
    ) throws -> CLIProvider {
        if providerKind == .customCli {
            guard let template = commandTemplate, !template.isEmpty else {
                throw CLIProviderError.customRequiresTemplate
            }
            return CLIProvider(commandTemplate: template)
        }

        let template: String
        if codingMode {
            template = commandTemplate ?? codingCommands[providerKind] ?? defaultCommands[providerKind] ?? ""
        } else {
            template = commandTemplate ?? defaultCommands[providerKind] ?? ""
        }

        guard !template.isEmpty else {
            throw CLIProviderError.unsupportedProvider(providerKind.rawValue)
        }

        return CLIProvider(commandTemplate: template)
    }

    // MARK: - Shell Split

    private func shellSplit(_ command: String) -> [String] {
        var tokens: [String] = []
        var current = ""
        var inSingleQuote = false
        var inDoubleQuote = false

        for char in command {
            if char == "'" && !inDoubleQuote {
                inSingleQuote.toggle()
            } else if char == "\"" && !inSingleQuote {
                inDoubleQuote.toggle()
            } else if char == " " && !inSingleQuote && !inDoubleQuote {
                if !current.isEmpty {
                    tokens.append(current)
                    current = ""
                }
            } else {
                current.append(char)
            }
        }
        if !current.isEmpty { tokens.append(current) }
        return tokens
    }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinementApp
swift test --filter CLIProviderTests
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add AgentRefinementApp/
git commit -m "feat: add CLIProvider — Swift port of providers.py"
```

---

### Task 3: PromptBuilder + GitHelper — orchestrator.py の分離移植

**Files:**
- Create: `AgentRefinementApp/AgentRefinementApp/Engine/PromptBuilder.swift`
- Create: `AgentRefinementApp/AgentRefinementApp/Engine/GitHelper.swift`
- Create: `AgentRefinementApp/AgentRefinementAppTests/Engine/PromptBuilderTests.swift`
- Create: `AgentRefinementApp/AgentRefinementAppTests/Engine/GitHelperTests.swift`

- [ ] **Step 1: Write PromptBuilder tests**

Create `AgentRefinementApp/AgentRefinementAppTests/Engine/PromptBuilderTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("PromptBuilder Tests")
struct PromptBuilderTests {

    @Test("System directive includes agent name and role")
    func systemDirective() {
        let agent = MasterAgent(id: "test", name: "TestAgent", orgRoles: [.worker], mode: .writer, provider: .claudeCli, persona: "テストペルソナ", skills: ["Swift", "テスト"])
        let directive = PromptBuilder.buildSystemDirective(agent: agent)
        #expect(directive.contains("TestAgent"))
        #expect(directive.contains("worker"))
        #expect(directive.contains("テストペルソナ"))
        #expect(directive.contains("Swift"))
    }

    @Test("Coding instruction includes role hint for CEO")
    func codingInstructionCeo() {
        let instruction = PromptBuilder.buildCodingInstruction(orgRole: .ceo, hasWorkingDir: true)
        #expect(instruction.contains("最終判断者"))
    }

    @Test("Writing instruction includes role hint for QA")
    func writingInstructionQa() {
        let instruction = PromptBuilder.buildWritingInstruction(orgRole: .qa)
        #expect(instruction.contains("検証観点"))
    }

    @Test("Truncate output clips long text")
    func truncateOutput() {
        let long = String(repeating: "a", count: 5000)
        let truncated = PromptBuilder.truncateOutput(long, maxChars: 100)
        #expect(truncated.count < 200)
        #expect(truncated.contains("truncated"))
    }

    @Test("Dependency context block lists dependencies")
    func dependencyContext() {
        let agent = MasterAgent(id: "editor", name: "Editor", orgRoles: [.worker], mode: .editor, provider: .claudeCli, dependsOn: ["writer"])
        let block = PromptBuilder.buildDependencyContextBlock(agent: agent, roundOutputs: ["writer": "draft text here"])
        #expect(block.contains("writer"))
        #expect(block.contains("draft text here"))
    }
}
```

- [ ] **Step 2: Implement PromptBuilder**

Create `AgentRefinementApp/AgentRefinementApp/Engine/PromptBuilder.swift`:

```swift
import Foundation

enum PromptBuilder {

    static func buildSystemDirective(agent: MasterAgent) -> String {
        let persona = agent.persona?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "なし"
        let skills = agent.skills.isEmpty
            ? "- なし"
            : agent.skills.map { "- \($0)" }.joined(separator: "\n")

        let orgRole = agent.orgRoles.first?.rawValue ?? "worker"

        let mcpBlock: String
        if agent.mcpEnabled {
            let servers = agent.mcpServers.isEmpty ? "未指定" : agent.mcpServers.joined(separator: ", ")
            let instruction = agent.mcpInstruction?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "特になし"
            mcpBlock = """
                MCP設定:
                - 有効化: 有効
                - サーバー: \(servers)
                - 設定ファイル: \(agent.mcpConfigPath ?? "未指定")
                - 参照コマンド: \(agent.mcpContextCommand ?? "未指定")
                - MCP指示:
                \(instruction)
                """
        } else {
            mcpBlock = "MCP設定:\n- 有効化: 無効"
        }

        return """
            あなたは \(agent.name) です。
            組織ロール: \(orgRole)
            ペルソナ:
            \(persona)

            活用するスキル:
            \(skills)
            \(mcpBlock)
            """
    }

    static func buildCodingInstruction(orgRole: OrgRole, hasWorkingDir: Bool) -> String {
        let roleHint: String = switch orgRole {
        case .ceo: "最終判断者として、優先順位と受け入れ基準を明確化してください。"
        case .manager: "計画整合と分解可能性を重視し、実行指示を具体化してください。"
        case .pmo: "計画の抜け漏れ・依存リスク・進捗リスクを明示してください。"
        case .qa: "テスト観点と品質ゲート観点を最優先で確認してください。"
        default: "担当ロールとして成果物を前進させる具体的な変更を出してください。"
        }

        if hasWorkingDir {
            return """
                リポジトリで直接作業してください。
                必要なファイルを作成・修正し、変更内容を要約してください。
                テストコマンドがある場合は実行して結果を含めてください。
                \(roleHint)
                """
        }

        return """
            現在のドラフトを実装計画として改善してください。
            出力は以下の見出しを含めてください: `変更概要` `変更ファイル` `実装手順` `テスト計画` `リスク`。
            \(roleHint)
            """
    }

    static func buildWritingInstruction(orgRole: OrgRole) -> String {
        let roleHint: String = switch orgRole {
        case .ceo: "意思決定しやすい簡潔さを重視してください。"
        case .manager: "段取りと依存関係が伝わる構成にしてください。"
        case .pmo: "抜け漏れと曖昧表現を排除してください。"
        case .qa: "検証観点が明確になるようにしてください。"
        default: "読み手に伝わる明瞭さを重視してください。"
        }
        return """
            現在の下書きを改善してください。
            必要なら修正案と本文をまとめて返してください。
            \(roleHint)
            """
    }

    static func buildDependencyContextBlock(agent: MasterAgent, roundOutputs: [String: String]) -> String {
        guard !agent.dependsOn.isEmpty else {
            return "依存エージェント出力: なし\n"
        }
        var lines = ["依存エージェント出力:"]
        for dep in agent.dependsOn {
            let output = roundOutputs[dep] ?? ""
            if output.isEmpty {
                lines.append("- \(dep): (未実行または出力なし)")
            } else {
                lines.append("- \(dep):\n```text\n\(truncateOutput(output))\n```")
            }
        }
        return lines.joined(separator: "\n") + "\n"
    }

    static func buildMcpContextBlock(context: String, error: String?) -> String {
        if !context.isEmpty {
            return "MCP参照コンテキスト:\n```text\n\(truncateOutput(context, maxChars: 6000))\n```"
        }
        if let error {
            return "MCP参照コンテキスト: 取得失敗 (\(error))"
        }
        return "MCP参照コンテキスト: なし"
    }

    static func truncateOutput(_ text: String, maxChars: Int = 2800) -> String {
        if text.count <= maxChars { return text }
        return String(text.prefix(maxChars)) + "\n...(truncated)"
    }

    static func computeDiff(before: String, after: String) -> String {
        let beforeLines = before.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let afterLines = after.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)

        var diff: [String] = ["--- original", "+++ refined"]
        for line in beforeLines where !afterLines.contains(line) {
            diff.append("- \(line)")
        }
        for line in afterLines where !beforeLines.contains(line) {
            diff.append("+ \(line)")
        }
        return diff.joined(separator: "\n")
    }
}
```

- [ ] **Step 3: Write GitHelper tests**

Create `AgentRefinementApp/AgentRefinementAppTests/Engine/GitHelperTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("GitHelper Tests")
struct GitHelperTests {

    @Test("isGitRepo returns false for non-repo")
    func isGitRepoFalse() {
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).path
        try? FileManager.default.createDirectory(atPath: tmp, withIntermediateDirectories: true)
        #expect(GitHelper.isGitRepo(path: tmp) == false)
        try? FileManager.default.removeItem(atPath: tmp)
    }

    @Test("ensureWorkingDir creates directory and git repo")
    func ensureWorkingDir() throws {
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).path
        try GitHelper.ensureWorkingDir(tmp)
        #expect(GitHelper.isGitRepo(path: tmp))
        try FileManager.default.removeItem(atPath: tmp)
    }
}
```

- [ ] **Step 4: Implement GitHelper**

Create `AgentRefinementApp/AgentRefinementApp/Engine/GitHelper.swift`:

```swift
import Foundation

enum GitHelper {

    static func isGitRepo(path: String) -> Bool {
        runGit(["rev-parse", "--git-dir"], cwd: path, timeout: 10) != nil
    }

    static func hasCommits(path: String) -> Bool {
        runGit(["rev-parse", "HEAD"], cwd: path, timeout: 10) != nil
    }

    static func captureGitDiff(workingDirectory: String) -> String {
        _ = runGit(["add", "-A"], cwd: workingDirectory, timeout: 30)
        return runGit(["diff", "--staged", "HEAD"], cwd: workingDirectory, timeout: 30) ?? ""
    }

    static func ensureWorkingDir(_ path: String) throws {
        try FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)

        if !isGitRepo(path: path) {
            _ = runGit(["init"], cwd: path, timeout: 15)
        }
        if !hasCommits(path: path) {
            _ = runGit(["commit", "--allow-empty", "-m", "initial empty commit"], cwd: path, timeout: 15)
        }
    }

    private static func runGit(_ args: [String], cwd: String, timeout: Int) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        process.arguments = args
        process.currentDirectoryURL = URL(fileURLWithPath: cwd)

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()

        do {
            try process.run()
        } catch {
            return nil
        }

        let timer = DispatchSource.makeTimerSource()
        timer.schedule(deadline: .now() + .seconds(timeout))
        timer.setEventHandler { process.terminate() }
        timer.resume()

        process.waitUntilExit()
        timer.cancel()

        guard process.terminationStatus == 0 else { return nil }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinementApp
swift test --filter "PromptBuilderTests|GitHelperTests"
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add AgentRefinementApp/
git commit -m "feat: add PromptBuilder and GitHelper — orchestrator prompt/git port"
```

---

### Task 4: Orchestrator — メインの実行エンジン

**Files:**
- Create: `AgentRefinementApp/AgentRefinementApp/Engine/Orchestrator.swift`
- Create: `AgentRefinementApp/AgentRefinementAppTests/Engine/OrchestratorTests.swift`
- Modify: `AgentRefinementApp/AgentRefinementApp/AppState.swift` — Orchestrator呼び出し

- [ ] **Step 1: Write Orchestrator tests**

Create `AgentRefinementApp/AgentRefinementAppTests/Engine/OrchestratorTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("Orchestrator Tests")
struct OrchestratorTests {

    @Test("Sequential batches returns one agent per batch")
    func sequentialBatches() {
        let agents = [
            MasterAgent(id: "a1", name: "A1", orgRoles: [.worker], mode: .writer, provider: .claudeCli),
            MasterAgent(id: "a2", name: "A2", orgRoles: [.qa], mode: .reviewer, provider: .claudeCli),
        ]
        let batches = Orchestrator.executionBatches(agents: agents, mode: "sequential")
        #expect(batches.count == 2)
        #expect(batches[0].count == 1)
        #expect(batches[1].count == 1)
    }

    @Test("Role-based batches groups by org role")
    func roleBased() {
        let agents = [
            MasterAgent(id: "w1", name: "W1", orgRoles: [.worker], mode: .writer, provider: .claudeCli),
            MasterAgent(id: "w2", name: "W2", orgRoles: [.worker], mode: .writer, provider: .geminiCli),
            MasterAgent(id: "q1", name: "Q1", orgRoles: [.qa], mode: .reviewer, provider: .claudeCli),
        ]
        let batches = Orchestrator.executionBatches(agents: agents, mode: "role_based")
        // Workers together, then QA
        #expect(batches.count == 2)
    }

    @Test("Dependency graph topological sort")
    func dependencyGraph() {
        let agents = [
            MasterAgent(id: "a", name: "A", orgRoles: [.worker], mode: .writer, provider: .claudeCli),
            MasterAgent(id: "b", name: "B", orgRoles: [.qa], mode: .reviewer, provider: .claudeCli, dependsOn: ["a"]),
            MasterAgent(id: "c", name: "C", orgRoles: [.worker], mode: .editor, provider: .claudeCli, dependsOn: ["a", "b"]),
        ]
        let batches = Orchestrator.executionBatches(agents: agents, mode: "dependency_graph")
        #expect(batches.count == 3)
        #expect(batches[0][0].id == "a")
        #expect(batches[1][0].id == "b")
        #expect(batches[2][0].id == "c")
    }

    @Test("Cycle detection throws")
    func cycleDetection() {
        let agents = [
            MasterAgent(id: "x", name: "X", orgRoles: [.worker], mode: .writer, provider: .claudeCli, dependsOn: ["y"]),
            MasterAgent(id: "y", name: "Y", orgRoles: [.worker], mode: .writer, provider: .claudeCli, dependsOn: ["x"]),
        ]
        let batches = Orchestrator.executionBatches(agents: agents, mode: "dependency_graph")
        // Should return empty or partial on cycle
        #expect(batches.isEmpty || batches.flatMap { $0 }.count < agents.count)
    }
}
```

- [ ] **Step 2: Implement Orchestrator**

Create `AgentRefinementApp/AgentRefinementApp/Engine/Orchestrator.swift`:

```swift
import Foundation

struct RefinementEvent: Sendable {
    let type: String
    let data: [String: Any]

    @Sendable init(type: String, data: [String: Any] = [:]) {
        self.type = type
        self.data = data
    }
}

enum Orchestrator {

    struct RunConfig {
        let agents: [MasterAgent]
        let sourceText: String
        let objective: String
        let globalInstruction: String
        let workflowMode: String
        let orchestrationMode: String
        let rounds: Int
        let workingDirectory: String?
        let codeContext: CodeContext?
    }

    struct CodeContext {
        let repository: String
        let targetPaths: [String]
        let techStack: String
        let acceptanceCriteria: String
        let testCommand: String
    }

    // MARK: - Execution Batches

    static func executionBatches(agents: [MasterAgent], mode: String) -> [[MasterAgent]] {
        switch mode {
        case "sequential":
            return agents.map { [$0] }

        case "role_based":
            let roleOrder: [OrgRole] = [.ceo, .manager, .worker, .pmo, .qa, .uiDesigner, .systemDesigner, .opsDesigner]
            var batches: [[MasterAgent]] = []
            for role in roleOrder {
                let group = agents.filter { $0.orgRoles.contains(role) }
                if !group.isEmpty { batches.append(group) }
            }
            return batches

        case "dependency_graph":
            return topologicalSort(agents: agents)

        default:
            return agents.map { [$0] }
        }
    }

    private static func topologicalSort(agents: [MasterAgent]) -> [[MasterAgent]] {
        let byId = Dictionary(uniqueKeysWithValues: agents.map { ($0.id, $0) })
        let indexMap = Dictionary(uniqueKeysWithValues: agents.enumerated().map { ($1.id, $0) })
        var indegree = Dictionary(uniqueKeysWithValues: agents.map { ($0.id, $0.dependsOn.count) })
        var reverse: [String: [String]] = [:]
        for agent in agents {
            for dep in agent.dependsOn {
                reverse[dep, default: []].append(agent.id)
            }
        }

        var ready = agents.filter { indegree[$0.id] == 0 }.map(\.id)
            .sorted { (indexMap[$0] ?? 0) < (indexMap[$1] ?? 0) }
        var batches: [[MasterAgent]] = []
        var visited = 0

        while !ready.isEmpty {
            let batch = ready.compactMap { byId[$0] }
            batches.append(batch)
            visited += ready.count

            var next: [String] = []
            for current in ready {
                for nxt in reverse[current] ?? [] {
                    indegree[nxt] = (indegree[nxt] ?? 1) - 1
                    if indegree[nxt] == 0 {
                        next.append(nxt)
                    }
                }
            }
            ready = next.sorted { (indexMap[$0] ?? 0) < (indexMap[$1] ?? 0) }
        }

        if visited != agents.count {
            return [] // cycle detected
        }
        return batches
    }

    // MARK: - Run

    static func run(config: RunConfig, onEvent: @escaping (RefinementEvent) -> Void) {
        var draft = config.sourceText
        let original = draft
        let batches = executionBatches(agents: config.agents, mode: config.orchestrationMode)
        let isCoding = config.workflowMode == "coding"
        let workingDir = config.workingDirectory

        if let dir = workingDir, isCoding {
            try? GitHelper.ensureWorkingDir(dir)
        }

        onEvent(RefinementEvent(type: "run_started", data: [
            "rounds": config.rounds,
            "agent_count": config.agents.count,
        ]))

        for roundIndex in 1...config.rounds {
            var roundOutputs: [String: String] = [:]
            onEvent(RefinementEvent(type: "round_started", data: ["round_index": roundIndex]))

            for batch in batches {
                for agent in batch {
                    if let dir = workingDir, isCoding {
                        let diff = GitHelper.captureGitDiff(workingDirectory: dir)
                        draft = diff.isEmpty
                            ? "元の要件:\n\(original)\n\nまだファイル変更はありません。"
                            : "元の要件:\n\(original)\n\n現在のリポジトリ変更:\n```diff\n\(diff)\n```"
                    }

                    onEvent(RefinementEvent(type: "turn_started", data: [
                        "agent_id": agent.id,
                        "agent_name": agent.name,
                    ]))

                    let prompt = buildFullPrompt(agent: agent, draft: draft, config: config, roundIndex: roundIndex, roundOutputs: roundOutputs)

                    do {
                        let provider = try CLIProvider.resolve(
                            providerKind: agent.provider,
                            commandTemplate: agent.commandTemplate,
                            codingMode: isCoding && workingDir != nil
                        )
                        let output = try provider.generate(
                            prompt: prompt,
                            model: agent.model,
                            cwd: workingDir,
                            mcpConfigPath: agent.mcpConfigPath,
                            mcpServers: agent.mcpServers
                        )
                        roundOutputs[agent.id] = output
                        if workingDir == nil || !isCoding {
                            draft = output
                        }

                        onEvent(RefinementEvent(type: "turn_completed", data: [
                            "agent_id": agent.id,
                            "agent_name": agent.name,
                            "output": PromptBuilder.truncateOutput(output, maxChars: 500),
                            "success": true,
                        ]))

                    } catch {
                        roundOutputs[agent.id] = ""
                        onEvent(RefinementEvent(type: "turn_completed", data: [
                            "agent_id": agent.id,
                            "agent_name": agent.name,
                            "error": error.localizedDescription,
                            "success": false,
                        ]))
                    }
                }
            }

            onEvent(RefinementEvent(type: "round_completed", data: ["round_index": roundIndex]))
        }

        let finalDiff = (workingDir != nil && isCoding)
            ? GitHelper.captureGitDiff(workingDirectory: workingDir!)
            : PromptBuilder.computeDiff(before: original, after: draft)

        onEvent(RefinementEvent(type: "run_completed", data: [
            "final_text": draft,
            "diff": finalDiff,
        ]))
    }

    private static func buildFullPrompt(
        agent: MasterAgent,
        draft: String,
        config: RunConfig,
        roundIndex: Int,
        roundOutputs: [String: String]
    ) -> String {
        let orgRole = agent.orgRoles.first ?? .worker
        let depBlock = PromptBuilder.buildDependencyContextBlock(agent: agent, roundOutputs: roundOutputs)

        let roleInstruction: String
        if config.workflowMode == "coding" {
            roleInstruction = PromptBuilder.buildCodingInstruction(orgRole: orgRole, hasWorkingDir: config.workingDirectory != nil)
        } else {
            roleInstruction = PromptBuilder.buildWritingInstruction(orgRole: orgRole)
        }

        return """
            \(PromptBuilder.buildSystemDirective(agent: agent))

            ワークフローモード: \(config.workflowMode)
            オーケストレーション: \(config.orchestrationMode)
            ラウンド: \(roundIndex)
            目的:
            \(config.objective.isEmpty ? "特になし" : config.objective)

            グローバル指示:
            \(config.globalInstruction.isEmpty ? "特になし" : config.globalInstruction)

            \(depBlock)

            現在の状態:
            <<DRAFT>>
            \(draft)
            <</DRAFT>>

            タスク:
            \(roleInstruction)
            """
    }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinementApp
swift test --filter OrchestratorTests
```

Expected: All 4 tests PASS

- [ ] **Step 4: Update AppState to use Orchestrator**

Modify `AppState.swift` — replace the placeholder `executeRefinement`:

```swift
func executeRefinement(requirements: String) async {
    guard !isExecuting else { return }
    isExecuting = true

    let config = Orchestrator.RunConfig(
        agents: agents,
        sourceText: requirements,
        objective: "",
        globalInstruction: "",
        workflowMode: "coding",
        orchestrationMode: "sequential",
        rounds: 1,
        workingDirectory: selectedProject?.workingDirectory,
        codeContext: nil
    )

    await withCheckedContinuation { continuation in
        DispatchQueue.global().async {
            Orchestrator.run(config: config) { event in
                Task { @MainActor in
                    // Store events for UI consumption
                }
            }
            Task { @MainActor in
                self.isExecuting = false
                continuation.resume()
            }
        }
    }
}
```

- [ ] **Step 5: Build and verify**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinementApp
swift build
```

- [ ] **Step 6: Run all tests**

```bash
swift test
```

- [ ] **Step 7: Commit**

```bash
git add AgentRefinementApp/
git commit -m "feat: add Orchestrator — full execution engine in Swift, no Python needed"
```

---

### Task 5: App Sandbox Entitlements + Info.plist

**Files:**
- Create: `AgentRefinementApp/AgentRefinementApp/Info.plist`
- Create: `AgentRefinementApp/AgentRefinementApp/AgentRefinementApp.entitlements`

- [ ] **Step 1: Create entitlements**

Create `AgentRefinementApp/AgentRefinementApp/AgentRefinementApp.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.process.allow-exec</key>
    <true/>
</dict>
</plist>
```

Note: `process.allow-exec` is needed for CLI provider subprocess calls. This entitlement is available for developer-signed apps but may require justification for App Store review.

- [ ] **Step 2: Create Info.plist**

Create `AgentRefinementApp/AgentRefinementApp/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>ja</string>
    <key>CFBundleDisplayName</key>
    <string>Agent Refinement</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2026. All rights reserved.</string>
    <key>NSMainStoryboardFile</key>
    <string></string>
</dict>
</plist>
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinementApp
swift build
```

- [ ] **Step 4: Commit**

```bash
git add AgentRefinementApp/
git commit -m "feat: add App Sandbox entitlements and Info.plist for App Store"
```

---

## Completion Checklist

After all 5 tasks:

- [ ] `swift build` succeeds in `AgentRefinementApp/`
- [ ] `swift test` passes all tests (models + engine + services)
- [ ] No Python imports or dependencies anywhere in `AgentRefinementApp/`
- [ ] No FastAPI/APIClient/SidecarManager references
- [ ] CLIProvider correctly executes subprocess commands
- [ ] Orchestrator produces execution events via callback
- [ ] PromptBuilder generates Japanese prompts matching Python版
- [ ] GitHelper initializes and diffs git repos
- [ ] Entitlements and Info.plist are present
- [ ] App binary is produced at `.build/debug/AgentRefinementApp`

**Next steps (future work, not in this plan):**
- Xcode project (.xcodeproj) 作成（`xcodegen` or 手動）
- App icon (Assets.xcassets) デザイン
- Apple Developer証明書でコード署名
- TestFlight配布テスト
- App Store Connect 提出
