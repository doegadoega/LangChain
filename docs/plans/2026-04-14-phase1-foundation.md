# Phase 1: Foundation — Xcode Scaffold + Data Layer + Backend Updates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the macOS Xcode project with SwiftUI 5-zone layout shell, extend the Python backend with project/evaluation/workflow APIs, and establish the Swift ↔ FastAPI communication layer.

**Architecture:** SwiftUI native shell using NavigationSplitView for the 5-zone IDE layout. FastAPI backend runs as a sidecar process managed by the Swift app. Communication via localhost HTTP + NDJSON streaming. Data persisted in JSON files under `~/.agent-refinement/`.

**Tech Stack:** Swift 5.9+, SwiftUI, WKWebView, Python 3.13, FastAPI 0.117.1, Pydantic 2.11.9

---

## Phase Breakdown

This is Phase 1 of 3:
- **Phase 1 (this plan):** Xcode scaffold, data models, backend API updates, SwiftUI shell layout
- **Phase 2:** Screens 1-3 (要件・実行, 組織テンプレート, エージェント管理)
- **Phase 3:** Workflow editor (WKWebView canvas), evaluation system integration

## File Structure

### New Files — Swift (macOS App)

```
AgentRefinement/
├── AgentRefinement.xcodeproj/
├── AgentRefinement/
│   ├── AgentRefinementApp.swift          — App entry point, sidecar lifecycle
│   ├── ContentView.swift                 — Root 5-zone layout
│   ├── Models/
│   │   ├── OrgRole.swift                 — Organization role enum + icon/color
│   │   ├── Agent.swift                   — MasterAgent, AgentSnapshot models
│   │   ├── Project.swift                 — Project model
│   │   ├── OrganizationTemplate.swift    — Template + Slot models
│   │   ├── Workflow.swift                — Workflow + Node + Edge models
│   │   ├── Evaluation.swift              — Evaluation model
│   │   └── APIModels.swift               — RefineRequest/Response DTOs
│   ├── Services/
│   │   ├── SidecarManager.swift          — FastAPI process lifecycle
│   │   ├── APIClient.swift               — HTTP client for localhost FastAPI
│   │   └── DataStore.swift               — JSON file persistence
│   ├── Views/
│   │   ├── ActivityBar.swift             — Left-most project tabs
│   │   ├── SidebarView.swift             — Folder tree
│   │   ├── MainTabView.swift             — Central tab container
│   │   ├── BottomPanelView.swift         — Agent carousel + terminal
│   │   └── DetailPanelView.swift         — Right-side agent edit form
│   └── AgentRefinement.entitlements
├── AgentRefinementTests/
│   ├── Models/
│   │   ├── OrgRoleTests.swift
│   │   ├── AgentTests.swift
│   │   ├── ProjectTests.swift
│   │   └── WorkflowTests.swift
│   └── Services/
│       ├── SidecarManagerTests.swift
│       ├── APIClientTests.swift
│       └── DataStoreTests.swift
```

### Modified Files — Python Backend

```
app/
├── models.py            — Add Project, Evaluation, Workflow, Slot models
├── main.py              — Add CRUD endpoints for projects, agents, templates, workflows
├── orchestrator.py      — Add evaluation hooks
└── store.py             — NEW: JSON file persistence layer
requirements.txt         — No changes needed
```

---

### Task 1: Xcode Project Scaffolding

**Files:**
- Create: `AgentRefinement/AgentRefinement.xcodeproj` (via Xcode CLI)
- Create: `AgentRefinement/AgentRefinement/AgentRefinementApp.swift`

- [ ] **Step 1: Create Xcode project**

```bash
cd /Users/sfidante-he/workspace/LangChain
mkdir -p AgentRefinement
```

Create the project using `xcodegen` or manual creation. We'll use a Package.swift approach for simplicity:

```bash
mkdir -p AgentRefinement/AgentRefinement
mkdir -p AgentRefinement/AgentRefinementTests
```

- [ ] **Step 2: Create Package.swift**

Create `AgentRefinement/Package.swift`:

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AgentRefinement",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "AgentRefinement",
            path: "AgentRefinement"
        ),
        .testTarget(
            name: "AgentRefinementTests",
            dependencies: ["AgentRefinement"],
            path: "AgentRefinementTests"
        ),
    ]
)
```

- [ ] **Step 3: Create app entry point**

Create `AgentRefinement/AgentRefinement/AgentRefinementApp.swift`:

```swift
import SwiftUI

@main
struct AgentRefinementApp: App {
    @StateObject private var sidecarManager = SidecarManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sidecarManager)
                .onAppear {
                    sidecarManager.start()
                }
                .onDisappear {
                    sidecarManager.stop()
                }
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1400, height: 900)
    }
}
```

- [ ] **Step 4: Create placeholder ContentView**

Create `AgentRefinement/AgentRefinement/ContentView.swift`:

```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        Text("Agent Refinement Platform")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
```

- [ ] **Step 5: Create placeholder SidecarManager**

Create `AgentRefinement/AgentRefinement/Services/SidecarManager.swift`:

```swift
import Foundation
import SwiftUI

final class SidecarManager: ObservableObject {
    @Published var isRunning = false
    @Published var port: Int = 8000

    func start() {
        isRunning = true
    }

    func stop() {
        isRunning = false
    }
}
```

- [ ] **Step 6: Verify project builds**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift build
```

Expected: BUILD SUCCEEDED

- [ ] **Step 7: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: scaffold Xcode project with SwiftUI entry point"
```

---

### Task 2: Swift Data Models — OrgRole

**Files:**
- Create: `AgentRefinement/AgentRefinement/Models/OrgRole.swift`
- Create: `AgentRefinement/AgentRefinementTests/Models/OrgRoleTests.swift`

- [ ] **Step 1: Write failing test for OrgRole**

Create `AgentRefinement/AgentRefinementTests/Models/OrgRoleTests.swift`:

```swift
import Testing
@testable import AgentRefinement

@Suite("OrgRole Tests")
struct OrgRoleTests {

    @Test("All 8 roles have unique icons")
    func allRolesHaveUniqueIcons() {
        let icons = OrgRole.allCases.map(\.icon)
        #expect(Set(icons).count == OrgRole.allCases.count)
    }

    @Test("All 8 roles have display names")
    func allRolesHaveDisplayNames() {
        for role in OrgRole.allCases {
            #expect(!role.displayName.isEmpty)
        }
    }

    @Test("CEO icon is crown")
    func ceoIcon() {
        #expect(OrgRole.ceo.icon == "👑")
    }

    @Test("OrgRole encodes to JSON string")
    func encodesToJSON() throws {
        let data = try JSONEncoder().encode(OrgRole.ceo)
        let str = String(data: data, encoding: .utf8)
        #expect(str == "\"ceo\"")
    }

    @Test("OrgRole decodes from JSON string")
    func decodesFromJSON() throws {
        let data = Data("\"worker\"".utf8)
        let role = try JSONDecoder().decode(OrgRole.self, from: data)
        #expect(role == .worker)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter OrgRoleTests
```

Expected: FAIL — `OrgRole` not defined

- [ ] **Step 3: Implement OrgRole**

Create `AgentRefinement/AgentRefinement/Models/OrgRole.swift`:

```swift
import SwiftUI

enum OrgRole: String, Codable, CaseIterable, Identifiable, Sendable {
    case ceo
    case manager
    case pmo
    case worker
    case qa
    case uiDesigner = "ui_designer"
    case systemDesigner = "system_designer"
    case opsDesigner = "ops_designer"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .ceo: "👑"
        case .manager: "📊"
        case .pmo: "📋"
        case .worker: "⚒️"
        case .qa: "✅"
        case .uiDesigner: "🎨"
        case .systemDesigner: "🏗"
        case .opsDesigner: "🔧"
        }
    }

    var color: Color {
        switch self {
        case .ceo: Color(red: 0.976, green: 0.886, blue: 0.686)
        case .manager: Color(red: 0.537, green: 0.706, blue: 0.98)
        case .pmo: Color(red: 0.796, green: 0.651, blue: 0.969)
        case .worker: Color(red: 0.58, green: 0.886, blue: 0.835)
        case .qa: Color(red: 0.651, green: 0.89, blue: 0.631)
        case .uiDesigner: Color(red: 0.961, green: 0.761, blue: 0.906)
        case .systemDesigner: Color(red: 0.98, green: 0.702, blue: 0.529)
        case .opsDesigner: Color(red: 0.455, green: 0.78, blue: 0.925)
        }
    }

    var displayName: String {
        switch self {
        case .ceo: "CEO"
        case .manager: "Manager"
        case .pmo: "PMO"
        case .worker: "Worker"
        case .qa: "QA"
        case .uiDesigner: "UI Designer"
        case .systemDesigner: "Sys Designer"
        case .opsDesigner: "Ops Designer"
        }
    }

    var shortName: String {
        switch self {
        case .ceo: "CEO"
        case .manager: "Mgr"
        case .pmo: "PMO"
        case .worker: "Worker"
        case .qa: "QA"
        case .uiDesigner: "UI"
        case .systemDesigner: "Sys"
        case .opsDesigner: "Ops"
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter OrgRoleTests
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add OrgRole enum with icons, colors, and display names"
```

---

### Task 3: Swift Data Models — Agent + Evaluation

**Files:**
- Create: `AgentRefinement/AgentRefinement/Models/Agent.swift`
- Create: `AgentRefinement/AgentRefinement/Models/Evaluation.swift`
- Create: `AgentRefinement/AgentRefinementTests/Models/AgentTests.swift`

- [ ] **Step 1: Write failing test for Agent models**

Create `AgentRefinement/AgentRefinementTests/Models/AgentTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinement

@Suite("Agent Model Tests")
struct AgentTests {

    @Test("MasterAgent has multiple org roles")
    func masterAgentMultipleRoles() {
        let agent = MasterAgent(
            id: "director",
            name: "Director",
            orgRoles: [.ceo, .manager],
            mode: .writer,
            provider: .claudeCli
        )
        #expect(agent.orgRoles.count == 2)
        #expect(agent.orgRoles.contains(.ceo))
        #expect(agent.orgRoles.contains(.manager))
    }

    @Test("MasterAgent primary role is first role")
    func primaryRole() {
        let agent = MasterAgent(
            id: "arch",
            name: "Architect",
            orgRoles: [.systemDesigner, .worker],
            mode: .writer,
            provider: .geminiCli
        )
        #expect(agent.primaryRole == .systemDesigner)
    }

    @Test("MasterAgent encodes and decodes to JSON")
    func roundTripJSON() throws {
        let agent = MasterAgent(
            id: "test",
            name: "Test Agent",
            orgRoles: [.worker],
            mode: .writer,
            provider: .claudeCli,
            model: "claude-sonnet-4-6",
            persona: "テストエージェント",
            skills: ["コーディング", "テスト"]
        )
        let data = try JSONEncoder().encode(agent)
        let decoded = try JSONDecoder().decode(MasterAgent.self, from: data)
        #expect(decoded.id == agent.id)
        #expect(decoded.orgRoles == agent.orgRoles)
        #expect(decoded.skills == agent.skills)
    }

    @Test("AgentSnapshot preserves config at creation time")
    func snapshotPreservesConfig() {
        let agent = MasterAgent(
            id: "dev",
            name: "Developer",
            orgRoles: [.worker],
            mode: .writer,
            provider: .geminiCli,
            persona: "Original persona"
        )
        let snapshot = AgentSnapshot(masterAgentId: agent.id, config: agent, projectId: "proj-1")
        #expect(snapshot.config.persona == "Original persona")
        #expect(snapshot.masterAgentId == "dev")
        #expect(snapshot.projectId == "proj-1")
    }

    @Test("Evaluation has score 1-10 range")
    func evaluationScoreRange() {
        let eval = Evaluation(
            evaluatorRole: .ceo,
            score: 8,
            comment: "Good work",
            roundNumber: 1,
            isFinal: false
        )
        #expect(eval.score == 8)
        #expect(eval.evaluatorRole == .ceo)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter AgentTests
```

Expected: FAIL — `MasterAgent` not defined

- [ ] **Step 3: Implement Evaluation model**

Create `AgentRefinement/AgentRefinement/Models/Evaluation.swift`:

```swift
import Foundation

struct Evaluation: Codable, Identifiable, Sendable {
    let id: UUID
    let evaluatorRole: EvaluatorRole
    let score: Int
    let comment: String?
    let roundNumber: Int?
    let isFinal: Bool
    let createdAt: Date

    init(
        id: UUID = UUID(),
        evaluatorRole: EvaluatorRole,
        score: Int,
        comment: String? = nil,
        roundNumber: Int? = nil,
        isFinal: Bool = false,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.evaluatorRole = evaluatorRole
        self.score = min(max(score, 1), 10)
        self.comment = comment
        self.roundNumber = roundNumber
        self.isFinal = isFinal
        self.createdAt = createdAt
    }
}

enum EvaluatorRole: String, Codable, Sendable {
    case ceo
    case manager
    case pmo
}
```

- [ ] **Step 4: Implement Agent models**

Create `AgentRefinement/AgentRefinement/Models/Agent.swift`:

```swift
import Foundation

enum AgentMode: String, Codable, CaseIterable, Sendable {
    case writer
    case reviewer
    case editor
}

enum ProviderKind: String, Codable, CaseIterable, Sendable {
    case geminiCli = "gemini_cli"
    case claudeCli = "claude_cli"
    case codexCli = "codex_cli"
    case customCli = "custom_cli"
}

enum ModelDecision: String, Codable, Sendable {
    case fixed
    case ceoDecides = "ceo_decides"
}

struct MasterAgent: Codable, Identifiable, Sendable {
    let id: String
    var name: String
    var orgRoles: [OrgRole]
    var mode: AgentMode
    var provider: ProviderKind
    var model: String?
    var persona: String?
    var skills: [String]
    var dependsOn: [String]
    var commandTemplate: String?
    var mcpEnabled: Bool
    var mcpConfigPath: String?
    var mcpServers: [String]
    var mcpInstruction: String?
    var mcpContextCommand: String?
    var mcpTimeoutSec: Int
    var modelDecision: ModelDecision
    var createdAt: Date
    var updatedAt: Date

    var primaryRole: OrgRole? { orgRoles.first }

    init(
        id: String,
        name: String,
        orgRoles: [OrgRole],
        mode: AgentMode,
        provider: ProviderKind,
        model: String? = nil,
        persona: String? = nil,
        skills: [String] = [],
        dependsOn: [String] = [],
        commandTemplate: String? = nil,
        mcpEnabled: Bool = false,
        mcpConfigPath: String? = nil,
        mcpServers: [String] = [],
        mcpInstruction: String? = nil,
        mcpContextCommand: String? = nil,
        mcpTimeoutSec: Int = 60,
        modelDecision: ModelDecision = .fixed,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.orgRoles = orgRoles
        self.mode = mode
        self.provider = provider
        self.model = model
        self.persona = persona
        self.skills = skills
        self.dependsOn = dependsOn
        self.commandTemplate = commandTemplate
        self.mcpEnabled = mcpEnabled
        self.mcpConfigPath = mcpConfigPath
        self.mcpServers = mcpServers
        self.mcpInstruction = mcpInstruction
        self.mcpContextCommand = mcpContextCommand
        self.mcpTimeoutSec = mcpTimeoutSec
        self.modelDecision = modelDecision
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

struct AgentSnapshot: Codable, Identifiable, Sendable {
    let id: UUID
    let masterAgentId: String
    let config: MasterAgent
    let projectId: String
    var evaluations: [Evaluation]
    let createdAt: Date

    init(
        id: UUID = UUID(),
        masterAgentId: String,
        config: MasterAgent,
        projectId: String,
        evaluations: [Evaluation] = [],
        createdAt: Date = Date()
    ) {
        self.id = id
        self.masterAgentId = masterAgentId
        self.config = config
        self.projectId = projectId
        self.evaluations = evaluations
        self.createdAt = createdAt
    }

    var averageScore: Double? {
        guard !evaluations.isEmpty else { return nil }
        let total = evaluations.reduce(0) { $0 + $1.score }
        return Double(total) / Double(evaluations.count)
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter AgentTests
```

Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add MasterAgent, AgentSnapshot, and Evaluation models"
```

---

### Task 4: Swift Data Models — Project + Template + Workflow

**Files:**
- Create: `AgentRefinement/AgentRefinement/Models/Project.swift`
- Create: `AgentRefinement/AgentRefinement/Models/OrganizationTemplate.swift`
- Create: `AgentRefinement/AgentRefinement/Models/Workflow.swift`
- Create: `AgentRefinement/AgentRefinementTests/Models/ProjectTests.swift`
- Create: `AgentRefinement/AgentRefinementTests/Models/WorkflowTests.swift`

- [ ] **Step 1: Write failing tests**

Create `AgentRefinement/AgentRefinementTests/Models/ProjectTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinement

@Suite("Project Model Tests")
struct ProjectTests {

    @Test("Project default status is active")
    func defaultStatusActive() {
        let project = Project(name: "Test", workingDirectory: "/tmp/test")
        #expect(project.status == .active)
    }

    @Test("Slot tracks assigned agents")
    func slotAssignment() {
        var slot = Slot(orgRole: .worker, minCount: 1, maxCount: 3, required: true)
        #expect(slot.assignedAgentIds.isEmpty)
        slot.assignedAgentIds.append("worker-1")
        #expect(slot.assignedAgentIds.count == 1)
    }

    @Test("OrganizationTemplate has slots")
    func templateHasSlots() {
        let template = OrganizationTemplate(
            name: "Review Team",
            slots: [
                Slot(orgRole: .ceo, minCount: 1, maxCount: 1, required: true),
                Slot(orgRole: .worker, minCount: 2, maxCount: 3, required: true),
                Slot(orgRole: .qa, minCount: 1, maxCount: 3, required: true),
            ]
        )
        #expect(template.slots.count == 3)
        #expect(template.requiredSlots.count == 3)
    }
}
```

Create `AgentRefinement/AgentRefinementTests/Models/WorkflowTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinement

@Suite("Workflow Model Tests")
struct WorkflowTests {

    @Test("Workflow node types")
    func nodeTypes() {
        let slotNode = WorkflowNode(
            type: .slot,
            position: Position(x: 100, y: 200),
            label: "Worker: Do",
            config: .slot(SlotConfig(slotRole: .worker, agentCount: 3))
        )
        #expect(slotNode.type == .slot)

        let gateNode = WorkflowNode(
            type: .gate,
            position: Position(x: 100, y: 300),
            label: "品質ゲート",
            config: .gate(GateConfig(
                judge: .auto,
                conditions: [
                    GateCondition(label: "PASS", targetNodeId: "ceo-act"),
                    GateCondition(label: "REWORK", targetNodeId: "worker-do"),
                ],
                loopMax: 3,
                onLoopExceeded: .escalate
            ))
        )
        #expect(gateNode.type == .gate)
    }

    @Test("Workflow edge connects nodes")
    func edgeConnectsNodes() {
        let edge = WorkflowEdge(
            sourceNodeId: "qa-check",
            targetNodeId: "gate-1",
            conditionLabel: nil
        )
        #expect(edge.sourceNodeId == "qa-check")
    }

    @Test("Workflow round-trip JSON")
    func workflowRoundTrip() throws {
        let workflow = Workflow(
            name: "Simple Flow",
            nodes: [
                WorkflowNode(type: .start, position: Position(x: 0, y: 0), label: "開始"),
                WorkflowNode(type: .end, position: Position(x: 0, y: 100), label: "終了"),
            ],
            edges: [
                WorkflowEdge(sourceNodeId: "node-0", targetNodeId: "node-1"),
            ]
        )
        let data = try JSONEncoder().encode(workflow)
        let decoded = try JSONDecoder().decode(Workflow.self, from: data)
        #expect(decoded.name == "Simple Flow")
        #expect(decoded.nodes.count == 2)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter "ProjectTests|WorkflowTests"
```

Expected: FAIL — types not defined

- [ ] **Step 3: Implement Project model**

Create `AgentRefinement/AgentRefinement/Models/Project.swift`:

```swift
import Foundation

enum ProjectStatus: String, Codable, Sendable {
    case active
    case completed
    case archived
}

struct Project: Codable, Identifiable, Sendable {
    let id: UUID
    var name: String
    var status: ProjectStatus
    var workingDirectory: String
    var templateId: String?
    var workflowId: String?
    var requirements: String?
    var agentSnapshots: [AgentSnapshot]
    let createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        workingDirectory: String,
        status: ProjectStatus = .active,
        templateId: String? = nil,
        workflowId: String? = nil,
        requirements: String? = nil,
        agentSnapshots: [AgentSnapshot] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.workingDirectory = workingDirectory
        self.status = status
        self.templateId = templateId
        self.workflowId = workflowId
        self.requirements = requirements
        self.agentSnapshots = agentSnapshots
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
```

- [ ] **Step 4: Implement OrganizationTemplate model**

Create `AgentRefinement/AgentRefinement/Models/OrganizationTemplate.swift`:

```swift
import Foundation

struct Slot: Codable, Identifiable, Sendable {
    let id: UUID
    var orgRole: OrgRole
    var minCount: Int
    var maxCount: Int
    var required: Bool
    var assignedAgentIds: [String]

    init(
        id: UUID = UUID(),
        orgRole: OrgRole,
        minCount: Int = 1,
        maxCount: Int = 1,
        required: Bool = true,
        assignedAgentIds: [String] = []
    ) {
        self.id = id
        self.orgRole = orgRole
        self.minCount = minCount
        self.maxCount = maxCount
        self.required = required
        self.assignedAgentIds = assignedAgentIds
    }
}

struct OrganizationTemplate: Codable, Identifiable, Sendable {
    let id: UUID
    var name: String
    var isPreset: Bool
    var orchestrationMode: String
    var workflowMode: String
    var rounds: Int
    var slots: [Slot]
    let createdAt: Date
    var updatedAt: Date

    var requiredSlots: [Slot] {
        slots.filter(\.required)
    }

    init(
        id: UUID = UUID(),
        name: String,
        isPreset: Bool = false,
        orchestrationMode: String = "sequential",
        workflowMode: String = "coding",
        rounds: Int = 1,
        slots: [Slot] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.isPreset = isPreset
        self.orchestrationMode = orchestrationMode
        self.workflowMode = workflowMode
        self.rounds = rounds
        self.slots = slots
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
```

- [ ] **Step 5: Implement Workflow model**

Create `AgentRefinement/AgentRefinement/Models/Workflow.swift`:

```swift
import Foundation

struct Position: Codable, Sendable {
    var x: Double
    var y: Double
}

enum NodeType: String, Codable, Sendable {
    case start
    case end
    case slot
    case gate
    case loop
    case fork
    case join
}

enum JudgeType: String, Codable, Sendable {
    case auto
    case agent
    case ceo
}

enum OnLoopExceeded: String, Codable, Sendable {
    case escalate
    case forcePass = "force_pass"
    case abort
}

struct GateCondition: Codable, Sendable {
    let label: String
    let targetNodeId: String
}

struct SlotConfig: Codable, Sendable {
    var slotRole: OrgRole
    var agentCount: Int
    var consensusRule: String?
    var timeoutSec: Int?
}

struct GateConfig: Codable, Sendable {
    var judge: JudgeType
    var conditions: [GateCondition]
    var loopMax: Int
    var onLoopExceeded: OnLoopExceeded
}

struct LoopConfig: Codable, Sendable {
    var targetStartNodeId: String
    var targetEndNodeId: String
    var maxIterations: Int
}

struct ForkConfig: Codable, Sendable {
    var forkType: String
}

enum NodeConfig: Codable, Sendable {
    case slot(SlotConfig)
    case gate(GateConfig)
    case loop(LoopConfig)
    case fork(ForkConfig)
    case none

    enum CodingKeys: String, CodingKey {
        case type, data
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .slot(let config):
            try container.encode("slot", forKey: .type)
            try container.encode(config, forKey: .data)
        case .gate(let config):
            try container.encode("gate", forKey: .type)
            try container.encode(config, forKey: .data)
        case .loop(let config):
            try container.encode("loop", forKey: .type)
            try container.encode(config, forKey: .data)
        case .fork(let config):
            try container.encode("fork", forKey: .type)
            try container.encode(config, forKey: .data)
        case .none:
            try container.encode("none", forKey: .type)
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "slot": self = .slot(try container.decode(SlotConfig.self, forKey: .data))
        case "gate": self = .gate(try container.decode(GateConfig.self, forKey: .data))
        case "loop": self = .loop(try container.decode(LoopConfig.self, forKey: .data))
        case "fork": self = .fork(try container.decode(ForkConfig.self, forKey: .data))
        default: self = .none
        }
    }
}

struct WorkflowNode: Codable, Identifiable, Sendable {
    let id: UUID
    var type: NodeType
    var position: Position
    var label: String
    var config: NodeConfig

    init(
        id: UUID = UUID(),
        type: NodeType,
        position: Position,
        label: String,
        config: NodeConfig = .none
    ) {
        self.id = id
        self.type = type
        self.position = position
        self.label = label
        self.config = config
    }
}

struct WorkflowEdge: Codable, Identifiable, Sendable {
    let id: UUID
    var sourceNodeId: String
    var targetNodeId: String
    var conditionLabel: String?

    init(
        id: UUID = UUID(),
        sourceNodeId: String,
        targetNodeId: String,
        conditionLabel: String? = nil
    ) {
        self.id = id
        self.sourceNodeId = sourceNodeId
        self.targetNodeId = targetNodeId
        self.conditionLabel = conditionLabel
    }
}

struct Workflow: Codable, Identifiable, Sendable {
    let id: UUID
    var name: String
    var isPreset: Bool
    var nodes: [WorkflowNode]
    var edges: [WorkflowEdge]
    let createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        isPreset: Bool = false,
        nodes: [WorkflowNode] = [],
        edges: [WorkflowEdge] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.isPreset = isPreset
        self.nodes = nodes
        self.edges = edges
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter "ProjectTests|WorkflowTests"
```

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add Project, OrganizationTemplate, and Workflow models"
```

---

### Task 5: DataStore — JSON File Persistence

**Files:**
- Create: `AgentRefinement/AgentRefinement/Services/DataStore.swift`
- Create: `AgentRefinement/AgentRefinementTests/Services/DataStoreTests.swift`

- [ ] **Step 1: Write failing tests**

Create `AgentRefinement/AgentRefinementTests/Services/DataStoreTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinement

@Suite("DataStore Tests")
struct DataStoreTests {

    let testDir: URL = FileManager.default.temporaryDirectory
        .appendingPathComponent("agent-refinement-test-\(UUID().uuidString)")

    @Test("Save and load agents")
    func saveAndLoadAgents() throws {
        let store = DataStore(baseDirectory: testDir)
        let agent = MasterAgent(
            id: "test-agent",
            name: "Test",
            orgRoles: [.worker],
            mode: .writer,
            provider: .claudeCli
        )
        try store.saveAgent(agent)
        let loaded = try store.loadAgents()
        #expect(loaded.count == 1)
        #expect(loaded[0].id == "test-agent")
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Save and load projects")
    func saveAndLoadProjects() throws {
        let store = DataStore(baseDirectory: testDir)
        let project = Project(name: "Test Project", workingDirectory: "/tmp")
        try store.saveProject(project)
        let loaded = try store.loadProjects()
        #expect(loaded.count == 1)
        #expect(loaded[0].name == "Test Project")
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Delete agent removes file")
    func deleteAgent() throws {
        let store = DataStore(baseDirectory: testDir)
        let agent = MasterAgent(
            id: "to-delete",
            name: "Delete Me",
            orgRoles: [.qa],
            mode: .reviewer,
            provider: .claudeCli
        )
        try store.saveAgent(agent)
        #expect(try store.loadAgents().count == 1)
        try store.deleteAgent(id: "to-delete")
        #expect(try store.loadAgents().isEmpty)
        try FileManager.default.removeItem(at: testDir)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter DataStoreTests
```

Expected: FAIL — `DataStore` not defined

- [ ] **Step 3: Implement DataStore**

Create `AgentRefinement/AgentRefinement/Services/DataStore.swift`:

```swift
import Foundation

final class DataStore: Sendable {
    let baseDirectory: URL

    private var agentsDir: URL { baseDirectory.appendingPathComponent("agents") }
    private var projectsDir: URL { baseDirectory.appendingPathComponent("projects") }
    private var templatesDir: URL { baseDirectory.appendingPathComponent("templates") }
    private var workflowsDir: URL { baseDirectory.appendingPathComponent("workflows") }

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    init(baseDirectory: URL? = nil) {
        self.baseDirectory = baseDirectory ?? FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".agent-refinement")
    }

    // MARK: - Agents

    func saveAgent(_ agent: MasterAgent) throws {
        try ensureDirectory(agentsDir)
        let file = agentsDir.appendingPathComponent("\(agent.id).json")
        let data = try encoder.encode(agent)
        try data.write(to: file)
    }

    func loadAgents() throws -> [MasterAgent] {
        try loadAll(from: agentsDir)
    }

    func loadAgent(id: String) throws -> MasterAgent? {
        let file = agentsDir.appendingPathComponent("\(id).json")
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        let data = try Data(contentsOf: file)
        return try decoder.decode(MasterAgent.self, from: data)
    }

    func deleteAgent(id: String) throws {
        let file = agentsDir.appendingPathComponent("\(id).json")
        if FileManager.default.fileExists(atPath: file.path) {
            try FileManager.default.removeItem(at: file)
        }
    }

    // MARK: - Projects

    func saveProject(_ project: Project) throws {
        try ensureDirectory(projectsDir)
        let file = projectsDir.appendingPathComponent("\(project.id.uuidString).json")
        let data = try encoder.encode(project)
        try data.write(to: file)
    }

    func loadProjects() throws -> [Project] {
        try loadAll(from: projectsDir)
    }

    func deleteProject(id: UUID) throws {
        let file = projectsDir.appendingPathComponent("\(id.uuidString).json")
        if FileManager.default.fileExists(atPath: file.path) {
            try FileManager.default.removeItem(at: file)
        }
    }

    // MARK: - Templates

    func saveTemplate(_ template: OrganizationTemplate) throws {
        try ensureDirectory(templatesDir)
        let file = templatesDir.appendingPathComponent("\(template.id.uuidString).json")
        let data = try encoder.encode(template)
        try data.write(to: file)
    }

    func loadTemplates() throws -> [OrganizationTemplate] {
        try loadAll(from: templatesDir)
    }

    func deleteTemplate(id: UUID) throws {
        let file = templatesDir.appendingPathComponent("\(id.uuidString).json")
        if FileManager.default.fileExists(atPath: file.path) {
            try FileManager.default.removeItem(at: file)
        }
    }

    // MARK: - Workflows

    func saveWorkflow(_ workflow: Workflow) throws {
        try ensureDirectory(workflowsDir)
        let file = workflowsDir.appendingPathComponent("\(workflow.id.uuidString).json")
        let data = try encoder.encode(workflow)
        try data.write(to: file)
    }

    func loadWorkflows() throws -> [Workflow] {
        try loadAll(from: workflowsDir)
    }

    func deleteWorkflow(id: UUID) throws {
        let file = workflowsDir.appendingPathComponent("\(id.uuidString).json")
        if FileManager.default.fileExists(atPath: file.path) {
            try FileManager.default.removeItem(at: file)
        }
    }

    // MARK: - Helpers

    private func ensureDirectory(_ dir: URL) throws {
        if !FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
    }

    private func loadAll<T: Decodable>(from dir: URL) throws -> [T] {
        guard FileManager.default.fileExists(atPath: dir.path) else { return [] }
        let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
        return try files.compactMap { file in
            let data = try Data(contentsOf: file)
            return try decoder.decode(T.self, from: data)
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter DataStoreTests
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add DataStore with JSON file persistence for agents and projects"
```

---

### Task 6: SidecarManager — FastAPI Process Lifecycle

**Files:**
- Modify: `AgentRefinement/AgentRefinement/Services/SidecarManager.swift`
- Create: `AgentRefinement/AgentRefinementTests/Services/SidecarManagerTests.swift`

- [ ] **Step 1: Write failing tests**

Create `AgentRefinement/AgentRefinementTests/Services/SidecarManagerTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinement

@Suite("SidecarManager Tests")
struct SidecarManagerTests {

    @Test("Initial state is not running")
    func initialState() {
        let manager = SidecarManager()
        #expect(manager.isRunning == false)
        #expect(manager.port == 8000)
    }

    @Test("Constructs correct uvicorn command")
    func uvicornCommand() {
        let manager = SidecarManager()
        let args = manager.buildUvicornArgs(port: 8001)
        #expect(args.contains("uvicorn"))
        #expect(args.contains("app.main:app"))
        #expect(args.contains("--port"))
        #expect(args.contains("8001"))
    }

    @Test("Finds python in project venv")
    func findsPythonInVenv() {
        let manager = SidecarManager()
        let projectRoot = URL(fileURLWithPath: "/Users/sfidante-he/workspace/LangChain")
        let pythonPath = manager.resolvePythonPath(projectRoot: projectRoot)
        #expect(pythonPath.hasSuffix("python3") || pythonPath.hasSuffix("python"))
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter SidecarManagerTests
```

Expected: FAIL — `buildUvicornArgs` not defined

- [ ] **Step 3: Implement full SidecarManager**

Replace `AgentRefinement/AgentRefinement/Services/SidecarManager.swift`:

```swift
import Foundation
import SwiftUI

@MainActor
final class SidecarManager: ObservableObject {
    @Published var isRunning = false
    @Published var port: Int = 8000
    @Published var error: String?

    private var process: Process?
    private let projectRoot: URL

    init(projectRoot: URL? = nil) {
        self.projectRoot = projectRoot ?? URL(fileURLWithPath: "/Users/sfidante-he/workspace/LangChain")
    }

    func start() {
        guard !isRunning else { return }
        error = nil

        let pythonPath = resolvePythonPath(projectRoot: projectRoot)
        let args = buildUvicornArgs(port: port)

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: pythonPath)
        proc.arguments = ["-m"] + args
        proc.currentDirectoryURL = projectRoot
        proc.environment = ProcessInfo.processInfo.environment

        let errorPipe = Pipe()
        proc.standardError = errorPipe

        proc.terminationHandler = { [weak self] process in
            Task { @MainActor in
                self?.isRunning = false
                if process.terminationStatus != 0 {
                    let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                    self?.error = String(data: errorData, encoding: .utf8)
                }
            }
        }

        do {
            try proc.run()
            process = proc
            isRunning = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    func stop() {
        process?.terminate()
        process = nil
        isRunning = false
    }

    nonisolated func buildUvicornArgs(port: Int) -> [String] {
        ["uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "\(port)"]
    }

    nonisolated func resolvePythonPath(projectRoot: URL) -> String {
        let venvPython = projectRoot
            .appendingPathComponent(".venv/bin/python3")
            .path
        if FileManager.default.fileExists(atPath: venvPython) {
            return venvPython
        }
        return "/usr/bin/python3"
    }

    var baseURL: URL {
        URL(string: "http://127.0.0.1:\(port)")!
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter SidecarManagerTests
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add SidecarManager for FastAPI process lifecycle"
```

---

### Task 7: APIClient — HTTP Communication with FastAPI

**Files:**
- Create: `AgentRefinement/AgentRefinement/Services/APIClient.swift`
- Create: `AgentRefinement/AgentRefinement/Models/APIModels.swift`
- Create: `AgentRefinement/AgentRefinementTests/Services/APIClientTests.swift`

- [ ] **Step 1: Write failing test**

Create `AgentRefinement/AgentRefinementTests/Services/APIClientTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinement

@Suite("APIClient Tests")
struct APIClientTests {

    @Test("Builds correct refine URL")
    func refineURL() {
        let client = APIClient(baseURL: URL(string: "http://localhost:8000")!)
        let url = client.refineStreamURL
        #expect(url.absoluteString == "http://localhost:8000/api/refine/stream")
    }

    @Test("RefineRequestDTO encodes correctly")
    func encodeRequest() throws {
        let dto = RefineRequestDTO(
            workflowMode: "coding",
            orchestrationMode: "sequential",
            sourceText: "テスト",
            objective: "テスト目的",
            rounds: 2,
            agents: [
                AgentDTO(
                    id: "worker-1",
                    name: "Worker",
                    orgRole: "worker",
                    provider: "claude_cli"
                )
            ]
        )
        let data = try JSONEncoder().encode(dto)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        #expect(json?["workflow_mode"] as? String == "coding")
        #expect(json?["rounds"] as? Int == 2)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter APIClientTests
```

Expected: FAIL — `APIClient` not defined

- [ ] **Step 3: Implement APIModels**

Create `AgentRefinement/AgentRefinement/Models/APIModels.swift`:

```swift
import Foundation

struct AgentDTO: Codable, Sendable {
    let id: String
    let name: String
    let orgRole: String
    let provider: String
    var mode: String?
    var persona: String?
    var skills: [String]?
    var dependsOn: [String]?
    var model: String?
    var commandTemplate: String?
    var mcpEnabled: Bool?
    var mcpConfigPath: String?
    var mcpServers: [String]?
    var mcpInstruction: String?
    var mcpContextCommand: String?
    var mcpTimeoutSec: Int?
    var isCustom: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, provider, mode, persona, skills, model
        case orgRole = "org_role"
        case dependsOn = "depends_on"
        case commandTemplate = "command_template"
        case mcpEnabled = "mcp_enabled"
        case mcpConfigPath = "mcp_config_path"
        case mcpServers = "mcp_servers"
        case mcpInstruction = "mcp_instruction"
        case mcpContextCommand = "mcp_context_command"
        case mcpTimeoutSec = "mcp_timeout_sec"
        case isCustom = "is_custom"
    }
}

struct CodeContextDTO: Codable, Sendable {
    var repository: String?
    var workingDirectory: String?
    var targetPaths: [String]?
    var techStack: String?
    var acceptanceCriteria: String?
    var testCommand: String?

    enum CodingKeys: String, CodingKey {
        case repository
        case workingDirectory = "working_directory"
        case targetPaths = "target_paths"
        case techStack = "tech_stack"
        case acceptanceCriteria = "acceptance_criteria"
        case testCommand = "test_command"
    }
}

struct RefineRequestDTO: Codable, Sendable {
    let workflowMode: String
    let orchestrationMode: String
    let sourceText: String
    var objective: String?
    var globalInstruction: String?
    var codeContext: CodeContextDTO?
    let rounds: Int
    let agents: [AgentDTO]

    enum CodingKeys: String, CodingKey {
        case rounds, agents
        case workflowMode = "workflow_mode"
        case orchestrationMode = "orchestration_mode"
        case sourceText = "source_text"
        case objective
        case globalInstruction = "global_instruction"
        case codeContext = "code_context"
    }
}

struct StreamEvent: Sendable {
    let type: String
    let data: [String: Any]

    init(from json: [String: Any]) {
        self.type = json["type"] as? String ?? "unknown"
        self.data = json
    }
}
```

- [ ] **Step 4: Implement APIClient**

Create `AgentRefinement/AgentRefinement/Services/APIClient.swift`:

```swift
import Foundation

final class APIClient: Sendable {
    let baseURL: URL

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    var refineURL: URL {
        baseURL.appendingPathComponent("api/refine")
    }

    var refineStreamURL: URL {
        baseURL.appendingPathComponent("api/refine/stream")
    }

    func streamRefine(request: RefineRequestDTO) -> AsyncThrowingStream<StreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    var urlRequest = URLRequest(url: refineStreamURL)
                    urlRequest.httpMethod = "POST"
                    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    urlRequest.httpBody = try JSONEncoder().encode(request)

                    let (bytes, response) = try await URLSession.shared.bytes(for: urlRequest)

                    guard let httpResponse = response as? HTTPURLResponse,
                          httpResponse.statusCode == 200 else {
                        continuation.finish(throwing: APIError.httpError(
                            (response as? HTTPURLResponse)?.statusCode ?? 0
                        ))
                        return
                    }

                    for try await line in bytes.lines {
                        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmed.isEmpty else { continue }
                        guard let data = trimmed.data(using: .utf8),
                              let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                            continue
                        }
                        continuation.yield(StreamEvent(from: json))
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    func healthCheck() async -> Bool {
        guard let url = URL(string: "\(baseURL.absoluteString)/") else { return false }
        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }
}

enum APIError: Error, LocalizedError {
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .httpError(let code): "HTTP error: \(code)"
        }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter APIClientTests
```

Expected: All 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add APIClient and DTOs for FastAPI communication"
```

---

### Task 8: SwiftUI 5-Zone Layout Shell

**Files:**
- Modify: `AgentRefinement/AgentRefinement/ContentView.swift`
- Create: `AgentRefinement/AgentRefinement/Views/ActivityBar.swift`
- Create: `AgentRefinement/AgentRefinement/Views/SidebarView.swift`
- Create: `AgentRefinement/AgentRefinement/Views/MainTabView.swift`
- Create: `AgentRefinement/AgentRefinement/Views/BottomPanelView.swift`
- Create: `AgentRefinement/AgentRefinement/Views/DetailPanelView.swift`

- [ ] **Step 1: Implement ActivityBar**

Create `AgentRefinement/AgentRefinement/Views/ActivityBar.swift`:

```swift
import SwiftUI

struct ActivityBar: View {
    @Binding var selectedProjectId: UUID?
    let projects: [Project]
    let onAddProject: () -> Void

    var body: some View {
        VStack(spacing: 4) {
            ForEach(projects) { project in
                Button {
                    selectedProjectId = project.id
                } label: {
                    Text(String(project.name.prefix(1)))
                        .font(.system(size: 14, weight: .bold))
                        .frame(width: 34, height: 34)
                        .background(
                            selectedProjectId == project.id
                                ? Color.accentColor.opacity(0.2)
                                : Color.clear
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(
                            selectedProjectId == project.id
                                ? Rectangle()
                                    .fill(Color.accentColor)
                                    .frame(width: 2)
                                    .frame(maxHeight: .infinity)
                                    .position(x: 1, y: 17)
                                : nil
                        )
                }
                .buttonStyle(.plain)
                .help(project.name)
            }

            Spacer()

            Button(action: onAddProject) {
                Image(systemName: "plus")
                    .font(.system(size: 14))
                    .frame(width: 34, height: 34)
            }
            .buttonStyle(.plain)
            .help("新規案件")

            Divider()

            Button {} label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 14))
                    .frame(width: 34, height: 34)
                    .opacity(0.6)
            }
            .buttonStyle(.plain)
            .help("設定")
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
        .frame(width: 48)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
    }
}
```

- [ ] **Step 2: Implement SidebarView**

Create `AgentRefinement/AgentRefinement/Views/SidebarView.swift`:

```swift
import SwiftUI

struct SidebarView: View {
    let workingDirectory: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: "folder")
                    .foregroundStyle(.blue)
                Text("Explorer")
                    .font(.system(size: 11, weight: .bold))
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)

            Divider()

            if let dir = workingDirectory {
                Text(URL(fileURLWithPath: dir).lastPathComponent)
                    .font(.system(size: 11, weight: .semibold))
                    .padding(.horizontal, 10)
                    .padding(.top, 8)

                Text("フォルダーツリー（Phase 2で実装）")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 10)
                    .padding(.top: 4)
            } else {
                Text("案件を選択してください")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
                    .padding(10)
            }

            Spacer()
        }
        .frame(minWidth: 180, idealWidth: 200, maxWidth: 240)
    }
}
```

- [ ] **Step 3: Implement MainTabView**

Create `AgentRefinement/AgentRefinement/Views/MainTabView.swift`:

```swift
import SwiftUI

enum MainTab: String, CaseIterable, Identifiable {
    case requirements = "要件・実行"
    case templates = "組織テンプレート"
    case agents = "エージェント管理"
    case workflow = "ワークフローエディタ"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .requirements: "📋"
        case .templates: "🏢"
        case .agents: "🤖"
        case .workflow: "🔀"
        }
    }
}

struct MainTabView: View {
    @Binding var selectedTab: MainTab

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(MainTab.allCases) { tab in
                    Button {
                        selectedTab = tab
                    } label: {
                        HStack(spacing: 4) {
                            Text(tab.icon)
                                .font(.system(size: 10))
                            Text(tab.rawValue)
                                .font(.system(size: 10, weight: selectedTab == tab ? .bold : .regular))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .foregroundStyle(selectedTab == tab ? .primary : .secondary)
                        .background(selectedTab == tab ? Color.accentColor.opacity(0.1) : Color.clear)
                        .overlay(alignment: .bottom) {
                            if selectedTab == tab {
                                Rectangle()
                                    .fill(Color.accentColor)
                                    .frame(height: 2)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.3))

            Divider()

            Group {
                switch selectedTab {
                case .requirements:
                    PlaceholderView(title: "📋 要件・実行", detail: "Phase 2で実装")
                case .templates:
                    PlaceholderView(title: "🏢 組織テンプレート", detail: "Phase 2で実装")
                case .agents:
                    PlaceholderView(title: "🤖 エージェント管理", detail: "Phase 2で実装")
                case .workflow:
                    PlaceholderView(title: "🔀 ワークフローエディタ", detail: "Phase 3で実装")
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct PlaceholderView: View {
    let title: String
    let detail: String

    var body: some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.title2)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
```

- [ ] **Step 4: Implement BottomPanelView**

Create `AgentRefinement/AgentRefinement/Views/BottomPanelView.swift`:

```swift
import SwiftUI

enum BottomTab: String, CaseIterable, Identifiable {
    case agents = "エージェント"
    case terminal = "ターミナル"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .agents: "🤖"
        case .terminal: "⬛"
        }
    }
}

struct BottomPanelView: View {
    @Binding var selectedTab: BottomTab
    let agents: [MasterAgent]
    @Binding var selectedAgentId: String?
    let onAddAgent: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Divider()
                .frame(height: 2)

            HStack(spacing: 0) {
                ForEach(BottomTab.allCases) { tab in
                    Button {
                        selectedTab = tab
                    } label: {
                        HStack(spacing: 3) {
                            Text(tab.icon)
                                .font(.system(size: 9))
                            Text(tab.rawValue)
                                .font(.system(size: 10, weight: selectedTab == tab ? .bold : .regular))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .foregroundStyle(selectedTab == tab ? .primary : .secondary)
                        .overlay(alignment: .bottom) {
                            if selectedTab == tab {
                                Rectangle()
                                    .fill(Color.accentColor)
                                    .frame(height: 2)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.3))

            Divider()

            Group {
                switch selectedTab {
                case .agents:
                    agentCarousel
                case .terminal:
                    terminalPlaceholder
                }
            }
        }
        .frame(height: 80)
    }

    private var agentCarousel: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Button(action: onAddAgent) {
                    RoundedRectangle(cornerRadius: 6)
                        .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [5]))
                        .foregroundStyle(.tertiary)
                        .frame(width: 44, height: 50)
                        .overlay {
                            Text("+")
                                .font(.system(size: 20))
                                .foregroundStyle(.tertiary)
                        }
                }
                .buttonStyle(.plain)

                ForEach(agents) { agent in
                    Button {
                        selectedAgentId = agent.id
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 4) {
                                Text(agent.primaryRole?.icon ?? "🤖")
                                    .font(.system(size: 12))
                                Text(agent.name)
                                    .font(.system(size: 10, weight: .bold))
                                    .lineLimit(1)
                            }
                            Text(agent.orgRoles.map(\.shortName).joined(separator: " · "))
                                .font(.system(size: 8))
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .frame(minWidth: 110, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(nsColor: .controlBackgroundColor))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .strokeBorder(
                                            selectedAgentId == agent.id
                                                ? Color.accentColor
                                                : Color(nsColor: .separatorColor),
                                            lineWidth: selectedAgentId == agent.id ? 2 : 1
                                        )
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
        }
    }

    private var terminalPlaceholder: some View {
        Text("ターミナル（Phase 2で実装）")
            .font(.system(size: 10))
            .foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
```

- [ ] **Step 5: Implement DetailPanelView**

Create `AgentRefinement/AgentRefinement/Views/DetailPanelView.swift`:

```swift
import SwiftUI

struct DetailPanelView: View {
    let agent: MasterAgent?

    var body: some View {
        if let agent {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Text(agent.primaryRole?.icon ?? "🤖")
                            .font(.system(size: 20))
                            .frame(width: 32, height: 32)
                            .background(agent.primaryRole?.color.opacity(0.3) ?? Color.gray.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        VStack(alignment: .leading) {
                            Text(agent.name)
                                .font(.system(size: 13, weight: .bold))
                            Text("エージェント詳細")
                                .font(.system(size: 9))
                                .foregroundStyle(.tertiary)
                        }
                    }

                    HStack(spacing: 4) {
                        ForEach(agent.orgRoles, id: \.self) { role in
                            HStack(spacing: 2) {
                                Text(role.icon)
                                    .font(.system(size: 8))
                                Text(role.shortName)
                                    .font(.system(size: 8, weight: .semibold))
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(role.color.opacity(0.15))
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(role.color.opacity(0.5)))
                        }
                    }

                    Divider()

                    Text("編集フォーム（Phase 2で実装）")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                }
                .padding(14)
            }
            .frame(minWidth: 220, idealWidth: 260, maxWidth: 300)
        } else {
            VStack {
                Text("エージェントを選択してください")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
            .frame(minWidth: 220, idealWidth: 260, maxWidth: 300)
        }
    }
}
```

- [ ] **Step 6: Assemble ContentView with 5-zone layout**

Replace `AgentRefinement/AgentRefinement/ContentView.swift`:

```swift
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var sidecarManager: SidecarManager

    @State private var projects: [Project] = [
        Project(name: "payment-service", workingDirectory: "/Users/sfidante-he/workspace/payment-service"),
    ]
    @State private var selectedProjectId: UUID?
    @State private var selectedTab: MainTab = .requirements
    @State private var bottomTab: BottomTab = .agents
    @State private var selectedAgentId: String?

    @State private var agents: [MasterAgent] = [
        MasterAgent(id: "director", name: "Director", orgRoles: [.ceo, .manager], mode: .writer, provider: .claudeCli),
        MasterAgent(id: "architect", name: "Architect", orgRoles: [.systemDesigner, .worker], mode: .writer, provider: .claudeCli),
        MasterAgent(id: "backend-dev", name: "Backend Dev", orgRoles: [.worker], mode: .writer, provider: .geminiCli),
        MasterAgent(id: "security-qa", name: "Security QA", orgRoles: [.qa], mode: .reviewer, provider: .claudeCli),
    ]

    private var selectedProject: Project? {
        projects.first { $0.id == selectedProjectId }
    }

    private var selectedAgent: MasterAgent? {
        agents.first { $0.id == selectedAgentId }
    }

    var body: some View {
        HStack(spacing: 0) {
            ActivityBar(
                selectedProjectId: $selectedProjectId,
                projects: projects,
                onAddProject: addProject
            )

            Divider()

            SidebarView(workingDirectory: selectedProject?.workingDirectory)

            Divider()

            VStack(spacing: 0) {
                MainTabView(selectedTab: $selectedTab)

                BottomPanelView(
                    selectedTab: $bottomTab,
                    agents: agents,
                    selectedAgentId: $selectedAgentId,
                    onAddAgent: addAgent
                )
            }

            Divider()

            DetailPanelView(agent: selectedAgent)
        }
        .onAppear {
            selectedProjectId = projects.first?.id
        }
    }

    private func addProject() {
        let project = Project(name: "New Project", workingDirectory: "/tmp")
        projects.append(project)
        selectedProjectId = project.id
    }

    private func addAgent() {
        let agent = MasterAgent(
            id: "agent-\(agents.count + 1)",
            name: "New Agent",
            orgRoles: [.worker],
            mode: .writer,
            provider: .claudeCli
        )
        agents.append(agent)
        selectedAgentId = agent.id
    }
}
```

- [ ] **Step 7: Build and verify layout**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift build
```

Expected: BUILD SUCCEEDED

- [ ] **Step 8: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: implement 5-zone IDE layout with SwiftUI views"
```

---

### Task 9: Python Backend — Extended Models + Persistence

**Files:**
- Modify: `app/models.py` — Already has OrgRole; add Project, Evaluation, Workflow, Slot models
- Create: `app/store.py` — JSON file persistence

- [ ] **Step 1: Write failing test for store**

Create `tests/test_store.py`:

```python
import json
import tempfile
from pathlib import Path

import pytest

from app.store import FileStore


@pytest.fixture
def store(tmp_path):
    return FileStore(base_dir=tmp_path)


def test_save_and_load_agents(store):
    agent = {
        "id": "test-agent",
        "name": "Test",
        "org_roles": ["worker"],
        "mode": "writer",
        "provider": "claude_cli",
    }
    store.save_agent(agent)
    agents = store.load_agents()
    assert len(agents) == 1
    assert agents[0]["id"] == "test-agent"


def test_save_and_load_projects(store):
    project = {
        "id": "proj-1",
        "name": "Test Project",
        "working_directory": "/tmp",
        "status": "active",
    }
    store.save_project(project)
    projects = store.load_projects()
    assert len(projects) == 1
    assert projects[0]["name"] == "Test Project"


def test_delete_agent(store):
    agent = {"id": "del-me", "name": "Delete"}
    store.save_agent(agent)
    assert len(store.load_agents()) == 1
    store.delete_agent("del-me")
    assert len(store.load_agents()) == 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/sfidante-he/workspace/LangChain
python -m pytest tests/test_store.py -v
```

Expected: FAIL — `app.store` not found

- [ ] **Step 3: Implement FileStore**

Create `app/store.py`:

```python
"""JSON file persistence for agents, projects, templates, and workflows."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class FileStore:
    """Simple JSON-file-per-record persistence."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self._base = base_dir or Path.home() / ".agent-refinement"

    @property
    def _agents_dir(self) -> Path:
        return self._base / "agents"

    @property
    def _projects_dir(self) -> Path:
        return self._base / "projects"

    @property
    def _templates_dir(self) -> Path:
        return self._base / "templates"

    @property
    def _workflows_dir(self) -> Path:
        return self._base / "workflows"

    # -- agents --

    def save_agent(self, data: dict[str, Any]) -> None:
        self._save(self._agents_dir, data["id"], data)

    def load_agents(self) -> list[dict[str, Any]]:
        return self._load_all(self._agents_dir)

    def load_agent(self, agent_id: str) -> dict[str, Any] | None:
        return self._load_one(self._agents_dir, agent_id)

    def delete_agent(self, agent_id: str) -> None:
        self._delete(self._agents_dir, agent_id)

    # -- projects --

    def save_project(self, data: dict[str, Any]) -> None:
        self._save(self._projects_dir, data["id"], data)

    def load_projects(self) -> list[dict[str, Any]]:
        return self._load_all(self._projects_dir)

    def delete_project(self, project_id: str) -> None:
        self._delete(self._projects_dir, project_id)

    # -- templates --

    def save_template(self, data: dict[str, Any]) -> None:
        self._save(self._templates_dir, data["id"], data)

    def load_templates(self) -> list[dict[str, Any]]:
        return self._load_all(self._templates_dir)

    def delete_template(self, template_id: str) -> None:
        self._delete(self._templates_dir, template_id)

    # -- workflows --

    def save_workflow(self, data: dict[str, Any]) -> None:
        self._save(self._workflows_dir, data["id"], data)

    def load_workflows(self) -> list[dict[str, Any]]:
        return self._load_all(self._workflows_dir)

    def delete_workflow(self, workflow_id: str) -> None:
        self._delete(self._workflows_dir, workflow_id)

    # -- internal --

    def _save(self, directory: Path, record_id: str, data: dict[str, Any]) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{record_id}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_all(self, directory: Path) -> list[dict[str, Any]]:
        if not directory.exists():
            return []
        results: list[dict[str, Any]] = []
        for path in sorted(directory.glob("*.json")):
            raw = path.read_text(encoding="utf-8")
            results.append(json.loads(raw))
        return results

    def _load_one(self, directory: Path, record_id: str) -> dict[str, Any] | None:
        path = directory / f"{record_id}.json"
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def _delete(self, directory: Path, record_id: str) -> None:
        path = directory / f"{record_id}.json"
        if path.exists():
            path.unlink()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sfidante-he/workspace/LangChain
python -m pytest tests/test_store.py -v
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/store.py tests/test_store.py
git commit -m "feat: add FileStore for JSON file persistence"
```

---

### Task 10: Python Backend — CRUD API Endpoints

**Files:**
- Modify: `app/main.py` — Add REST endpoints for agents, projects, templates, workflows

- [ ] **Step 1: Write failing test for API endpoints**

Create `tests/test_api.py`:

```python
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_store
from app.store import FileStore


@pytest.fixture
def client(tmp_path):
    store = FileStore(base_dir=tmp_path)
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_list_agents_empty(client):
    resp = client.get("/api/agents")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_and_get_agent(client):
    agent = {
        "id": "worker-1",
        "name": "Worker",
        "org_roles": ["worker"],
        "mode": "writer",
        "provider": "claude_cli",
    }
    resp = client.post("/api/agents", json=agent)
    assert resp.status_code == 201

    resp = client.get("/api/agents")
    assert len(resp.json()) == 1
    assert resp.json()[0]["id"] == "worker-1"


def test_delete_agent(client):
    agent = {"id": "del-me", "name": "Delete"}
    client.post("/api/agents", json=agent)
    resp = client.delete("/api/agents/del-me")
    assert resp.status_code == 204
    assert client.get("/api/agents").json() == []


def test_list_projects_empty(client):
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_project(client):
    project = {
        "id": "proj-1",
        "name": "Test",
        "working_directory": "/tmp",
        "status": "active",
    }
    resp = client.post("/api/projects", json=project)
    assert resp.status_code == 201
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sfidante-he/workspace/LangChain
python -m pytest tests/test_api.py -v
```

Expected: FAIL — endpoints not found

- [ ] **Step 3: Update main.py with CRUD endpoints**

Add to `app/main.py` after existing endpoints:

```python
from app.store import FileStore


def get_store() -> FileStore:
    return FileStore()


# -- Agent CRUD --

@app.get("/api/agents")
def list_agents(store: FileStore = Depends(get_store)):
    return store.load_agents()


@app.post("/api/agents", status_code=201)
def create_agent(agent: dict, store: FileStore = Depends(get_store)):
    store.save_agent(agent)
    return agent


@app.get("/api/agents/{agent_id}")
def get_agent(agent_id: str, store: FileStore = Depends(get_store)):
    result = store.load_agent(agent_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return result


@app.put("/api/agents/{agent_id}")
def update_agent(agent_id: str, agent: dict, store: FileStore = Depends(get_store)):
    agent["id"] = agent_id
    store.save_agent(agent)
    return agent


@app.delete("/api/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: str, store: FileStore = Depends(get_store)):
    store.delete_agent(agent_id)


# -- Project CRUD --

@app.get("/api/projects")
def list_projects(store: FileStore = Depends(get_store)):
    return store.load_projects()


@app.post("/api/projects", status_code=201)
def create_project(project: dict, store: FileStore = Depends(get_store)):
    store.save_project(project)
    return project


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str, store: FileStore = Depends(get_store)):
    store.delete_project(project_id)


# -- Template CRUD --

@app.get("/api/templates")
def list_templates(store: FileStore = Depends(get_store)):
    return store.load_templates()


@app.post("/api/templates", status_code=201)
def create_template(template: dict, store: FileStore = Depends(get_store)):
    store.save_template(template)
    return template


@app.delete("/api/templates/{template_id}", status_code=204)
def delete_template(template_id: str, store: FileStore = Depends(get_store)):
    store.delete_template(template_id)


# -- Workflow CRUD --

@app.get("/api/workflows")
def list_workflows(store: FileStore = Depends(get_store)):
    return store.load_workflows()


@app.post("/api/workflows", status_code=201)
def create_workflow(workflow: dict, store: FileStore = Depends(get_store)):
    store.save_workflow(workflow)
    return workflow


@app.delete("/api/workflows/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: str, store: FileStore = Depends(get_store)):
    store.delete_workflow(workflow_id)
```

Also add `Depends` and `HTTPException` to the imports at the top of `app/main.py`:

```python
from fastapi import Depends, FastAPI, HTTPException, Request
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sfidante-he/workspace/LangChain
python -m pytest tests/test_api.py -v
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/main.py tests/test_api.py
git commit -m "feat: add CRUD API endpoints for agents, projects, templates, workflows"
```

---

## Phase 1 Completion Checklist

After all 10 tasks are complete, verify:

- [ ] `swift build` succeeds in `AgentRefinement/`
- [ ] `swift test` passes all Swift tests
- [ ] `python -m pytest tests/ -v` passes all Python tests
- [ ] macOS app launches and shows 5-zone layout with sample data
- [ ] FastAPI starts via `uvicorn app.main:app --port 8000`
- [ ] CRUD endpoints respond at `http://localhost:8000/api/{agents,projects,templates,workflows}`

**Next:** Phase 2 plan will cover implementing the 3 main screens (要件・実行, 組織テンプレート, エージェント管理) with full functionality.
