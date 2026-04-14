# Phase 2: Main Screens — 要件・実行 / 組織テンプレート / エージェント管理

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 3 main content screens that replace the Phase 1 placeholders, plus the agent edit form, folder tree sidebar, and app-level state management.

**Architecture:** `AppState` ObservableObject as single source of truth, backed by DataStore for persistence and APIClient for execution. Each screen is a self-contained SwiftUI view receiving state via `@EnvironmentObject`. All mutations go through AppState methods (immutable pattern — create new objects, never mutate in place).

**Tech Stack:** Swift 5.9+, SwiftUI, Combine, existing DataStore/APIClient from Phase 1

---

## File Structure

### New Files

```
AgentRefinement/AgentRefinement/
├── AppState.swift                              — Central state management
├── Views/
│   ├── Screens/
│   │   ├── RequirementsScreen.swift            — 要件・実行 (Screen 1)
│   │   ├── TemplatesScreen.swift               — 組織テンプレート (Screen 2)
│   │   └── AgentsScreen.swift                  — エージェント管理 (Screen 3)
│   ├── Components/
│   │   ├── ExecutionLogTable.swift             — テーブル式エージェントログ
│   │   ├── CEOChatView.swift                   — CEOレポートチャット
│   │   ├── AgentCard.swift                     — エージェントカードUI
│   │   ├── RoleBadge.swift                     — ロールバッジUI
│   │   ├── RoleFilterBar.swift                 — ロールフィルターバー
│   │   ├── SlotEditor.swift                    — スロット編集UI
│   │   └── FileTreeView.swift                  — フォルダーツリー
│   ├── DetailPanelView.swift                   — MODIFY: full edit form
│   ├── SidebarView.swift                       — MODIFY: add file tree
│   └── MainTabView.swift                       — MODIFY: wire screens
```

### Modified Files

```
AgentRefinement/AgentRefinement/
├── ContentView.swift                           — Wire AppState
├── AgentRefinementApp.swift                    — Create AppState
├── Views/MainTabView.swift                     — Replace placeholders with screens
├── Views/SidebarView.swift                     — Add FileTreeView
├── Views/DetailPanelView.swift                 — Full agent edit form
├── Views/BottomPanelView.swift                 — Wire to AppState
```

---

### Task 1: AppState — Central State Management

**Files:**
- Create: `AgentRefinement/AgentRefinement/AppState.swift`
- Modify: `AgentRefinement/AgentRefinement/AgentRefinementApp.swift`
- Modify: `AgentRefinement/AgentRefinement/ContentView.swift`
- Test: `AgentRefinement/AgentRefinementTests/AppStateTests.swift`

- [ ] **Step 1: Write failing test for AppState**

Create `AgentRefinement/AgentRefinementTests/AppStateTests.swift`:

```swift
import Testing
import Foundation
@testable import AgentRefinement

@Suite("AppState Tests")
struct AppStateTests {

    @Test("Initial state loads from DataStore")
    @MainActor
    func initialLoad() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)

        let agent = MasterAgent(
            id: "test-1", name: "Test", orgRoles: [.worker],
            mode: .writer, provider: .claudeCli
        )
        try store.saveAgent(agent)

        let state = AppState(dataStore: store)
        state.loadAll()

        #expect(state.agents.count == 1)
        #expect(state.agents[0].id == "test-1")
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Add agent persists to store")
    @MainActor
    func addAgentPersists() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)

        state.addAgent(
            name: "New Agent",
            orgRoles: [.qa],
            mode: .reviewer,
            provider: .claudeCli
        )

        #expect(state.agents.count == 1)
        let persisted = try store.loadAgents()
        #expect(persisted.count == 1)
        #expect(persisted[0].name == "New Agent")
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Delete agent removes from state and store")
    @MainActor
    func deleteAgent() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)

        state.addAgent(name: "ToDelete", orgRoles: [.worker], mode: .writer, provider: .geminiCli)
        let agentId = state.agents[0].id
        state.deleteAgent(id: agentId)

        #expect(state.agents.isEmpty)
        #expect(try store.loadAgents().isEmpty)
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Duplicate agent creates copy with new id")
    @MainActor
    func duplicateAgent() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)

        state.addAgent(name: "Original", orgRoles: [.ceo, .manager], mode: .writer, provider: .claudeCli)
        let originalId = state.agents[0].id
        state.duplicateAgent(id: originalId)

        #expect(state.agents.count == 2)
        #expect(state.agents[1].name == "Original (コピー)")
        #expect(state.agents[1].id != originalId)
        #expect(state.agents[1].orgRoles == [.ceo, .manager])
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Update agent replaces in state")
    @MainActor
    func updateAgent() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)

        state.addAgent(name: "Before", orgRoles: [.worker], mode: .writer, provider: .claudeCli)
        var agent = state.agents[0]
        agent.name = "After"
        agent.orgRoles = [.worker, .qa]
        state.updateAgent(agent)

        #expect(state.agents[0].name == "After")
        #expect(state.agents[0].orgRoles == [.worker, .qa])
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Filter agents by role")
    @MainActor
    func filterByRole() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)

        state.addAgent(name: "CEO", orgRoles: [.ceo], mode: .writer, provider: .claudeCli)
        state.addAgent(name: "Worker1", orgRoles: [.worker], mode: .writer, provider: .geminiCli)
        state.addAgent(name: "Worker2", orgRoles: [.worker, .qa], mode: .reviewer, provider: .claudeCli)

        state.roleFilter = .worker
        #expect(state.filteredAgents.count == 2)

        state.roleFilter = .ceo
        #expect(state.filteredAgents.count == 1)

        state.roleFilter = nil
        #expect(state.filteredAgents.count == 3)
        try FileManager.default.removeItem(at: testDir)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter AppStateTests
```

Expected: FAIL — `AppState` not defined

- [ ] **Step 3: Implement AppState**

Create `AgentRefinement/AgentRefinement/AppState.swift`:

```swift
import Foundation
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    // MARK: - Data
    @Published var agents: [MasterAgent] = []
    @Published var projects: [Project] = []
    @Published var templates: [OrganizationTemplate] = []
    @Published var workflows: [Workflow] = []

    // MARK: - Selection
    @Published var selectedProjectId: UUID?
    @Published var selectedAgentId: String?
    @Published var selectedTab: MainTab = .requirements
    @Published var bottomTab: BottomTab = .agents

    // MARK: - Filters
    @Published var roleFilter: OrgRole?
    @Published var agentSearchText: String = ""

    // MARK: - Execution
    @Published var isExecuting: Bool = false
    @Published var executionEvents: [StreamEvent] = []

    let dataStore: DataStore
    let apiClient: APIClient

    init(
        dataStore: DataStore = DataStore(),
        apiClient: APIClient = APIClient(baseURL: URL(string: "http://127.0.0.1:8000")!)
    ) {
        self.dataStore = dataStore
        self.apiClient = apiClient
    }

    // MARK: - Computed

    var selectedProject: Project? {
        projects.first { $0.id == selectedProjectId }
    }

    var selectedAgent: MasterAgent? {
        agents.first { $0.id == selectedAgentId }
    }

    var filteredAgents: [MasterAgent] {
        var result = agents
        if let filter = roleFilter {
            result = result.filter { $0.orgRoles.contains(filter) }
        }
        if !agentSearchText.isEmpty {
            let query = agentSearchText.lowercased()
            result = result.filter {
                $0.name.lowercased().contains(query) ||
                $0.id.lowercased().contains(query)
            }
        }
        return result
    }

    // MARK: - Load

    func loadAll() {
        do {
            agents = try dataStore.loadAgents()
            projects = try dataStore.loadProjects()
            templates = try dataStore.loadTemplates()
            workflows = try dataStore.loadWorkflows()
        } catch {
            // silently handle — empty state is fine for first launch
        }
    }

    // MARK: - Agent CRUD

    func addAgent(
        name: String,
        orgRoles: [OrgRole],
        mode: AgentMode,
        provider: ProviderKind
    ) {
        let id = "\(name.lowercased().replacingOccurrences(of: " ", with: "-"))-\(UUID().uuidString.prefix(8))"
        let agent = MasterAgent(
            id: id, name: name, orgRoles: orgRoles,
            mode: mode, provider: provider
        )
        agents.append(agent)
        try? dataStore.saveAgent(agent)
        selectedAgentId = agent.id
    }

    func updateAgent(_ agent: MasterAgent) {
        let updated = MasterAgent(
            id: agent.id, name: agent.name, orgRoles: agent.orgRoles,
            mode: agent.mode, provider: agent.provider,
            model: agent.model, persona: agent.persona,
            skills: agent.skills, dependsOn: agent.dependsOn,
            commandTemplate: agent.commandTemplate,
            mcpEnabled: agent.mcpEnabled, mcpConfigPath: agent.mcpConfigPath,
            mcpServers: agent.mcpServers, mcpInstruction: agent.mcpInstruction,
            mcpContextCommand: agent.mcpContextCommand, mcpTimeoutSec: agent.mcpTimeoutSec,
            modelDecision: agent.modelDecision,
            createdAt: agent.createdAt, updatedAt: Date()
        )
        agents = agents.map { $0.id == updated.id ? updated : $0 }
        try? dataStore.saveAgent(updated)
    }

    func deleteAgent(id: String) {
        agents = agents.filter { $0.id != id }
        if selectedAgentId == id { selectedAgentId = nil }
        try? dataStore.deleteAgent(id: id)
    }

    func duplicateAgent(id: String) {
        guard let source = agents.first(where: { $0.id == id }) else { return }
        let newId = "\(source.id)-copy-\(UUID().uuidString.prefix(8))"
        let copy = MasterAgent(
            id: newId, name: "\(source.name) (コピー)", orgRoles: source.orgRoles,
            mode: source.mode, provider: source.provider,
            model: source.model, persona: source.persona,
            skills: source.skills, dependsOn: source.dependsOn,
            commandTemplate: source.commandTemplate,
            mcpEnabled: source.mcpEnabled, mcpConfigPath: source.mcpConfigPath,
            mcpServers: source.mcpServers, mcpInstruction: source.mcpInstruction,
            mcpContextCommand: source.mcpContextCommand, mcpTimeoutSec: source.mcpTimeoutSec,
            modelDecision: source.modelDecision
        )
        agents.append(copy)
        try? dataStore.saveAgent(copy)
        selectedAgentId = copy.id
    }

    // MARK: - Project CRUD

    func addProject(name: String, workingDirectory: String) {
        let project = Project(name: name, workingDirectory: workingDirectory)
        projects.append(project)
        try? dataStore.saveProject(project)
        selectedProjectId = project.id
    }

    func deleteProject(id: UUID) {
        projects = projects.filter { $0.id != id }
        if selectedProjectId == id { selectedProjectId = nil }
        try? dataStore.deleteProject(id: id)
    }

    // MARK: - Template CRUD

    func addTemplate(name: String, slots: [Slot] = []) {
        let template = OrganizationTemplate(name: name, slots: slots)
        templates.append(template)
        try? dataStore.saveTemplate(template)
    }

    func updateTemplate(_ template: OrganizationTemplate) {
        templates = templates.map { $0.id == template.id ? template : $0 }
        try? dataStore.saveTemplate(template)
    }

    func deleteTemplate(id: UUID) {
        templates = templates.filter { $0.id != id }
        try? dataStore.deleteTemplate(id: id)
    }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/sfidante-he/workspace/LangChain/AgentRefinement
swift test --filter AppStateTests
```

Expected: All 6 tests PASS

- [ ] **Step 5: Wire AppState into app**

Modify `AgentRefinementApp.swift` — add `@StateObject private var appState = AppState()`, inject as `.environmentObject(appState)`.

Modify `ContentView.swift` — replace all `@State` arrays with `@EnvironmentObject var appState: AppState`, bind all views to appState properties.

- [ ] **Step 6: Verify build**

```bash
swift build
```

- [ ] **Step 7: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add AppState central state management with DataStore persistence"
```

---

### Task 2: Shared Components — RoleBadge, AgentCard, RoleFilterBar

**Files:**
- Create: `AgentRefinement/AgentRefinement/Views/Components/RoleBadge.swift`
- Create: `AgentRefinement/AgentRefinement/Views/Components/AgentCard.swift`
- Create: `AgentRefinement/AgentRefinement/Views/Components/RoleFilterBar.swift`

- [ ] **Step 1: Create RoleBadge**

Create `AgentRefinement/AgentRefinement/Views/Components/RoleBadge.swift`:

```swift
import SwiftUI

struct RoleBadge: View {
    let role: OrgRole

    var body: some View {
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
        .overlay(Capsule().strokeBorder(role.color.opacity(0.5), lineWidth: 1))
    }
}
```

- [ ] **Step 2: Create AgentCard**

Create `AgentRefinement/AgentRefinement/Views/Components/AgentCard.swift`:

```swift
import SwiftUI

struct AgentCard: View {
    let agent: MasterAgent
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(agent.primaryRole?.icon ?? "🤖")
                        .font(.system(size: 18))
                        .frame(width: 36, height: 36)
                        .background(agent.primaryRole?.color.opacity(0.3) ?? Color.gray.opacity(0.3))
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(agent.name)
                            .font(.system(size: 12, weight: .bold))
                            .lineLimit(1)
                        Text("\(agent.provider.rawValue) · \(agent.model ?? "default")")
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer()
                }

                HStack(spacing: 4) {
                    ForEach(agent.orgRoles, id: \.self) { role in
                        RoleBadge(role: role)
                    }
                }

                if let persona = agent.persona, !persona.isEmpty {
                    Text(persona)
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(nsColor: .controlBackgroundColor))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(
                                isSelected ? Color.accentColor : Color(nsColor: .separatorColor),
                                lineWidth: isSelected ? 2 : 1
                            )
                    )
            )
        }
        .buttonStyle(.plain)
    }
}
```

- [ ] **Step 3: Create RoleFilterBar**

Create `AgentRefinement/AgentRefinement/Views/Components/RoleFilterBar.swift`:

```swift
import SwiftUI

struct RoleFilterBar: View {
    @Binding var selectedRole: OrgRole?

    var body: some View {
        HStack(spacing: 3) {
            filterButton(label: "全て", role: nil, isActive: selectedRole == nil)

            ForEach(OrgRole.allCases) { role in
                filterButton(
                    label: role.shortName,
                    icon: role.icon,
                    role: role,
                    isActive: selectedRole == role,
                    color: role.color
                )
            }
        }
    }

    private func filterButton(
        label: String,
        icon: String? = nil,
        role: OrgRole?,
        isActive: Bool,
        color: Color = .accentColor
    ) -> some View {
        Button {
            selectedRole = role
        } label: {
            HStack(spacing: 2) {
                if let icon {
                    Text(icon).font(.system(size: 9))
                }
                Text(label)
                    .font(.system(size: 9, weight: isActive ? .bold : .regular))
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(isActive ? color.opacity(0.2) : Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .strokeBorder(isActive ? color : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
```

- [ ] **Step 4: Verify build**

```bash
swift build
```

- [ ] **Step 5: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add RoleBadge, AgentCard, and RoleFilterBar components"
```

---

### Task 3: Screen 3 — エージェント管理 (Agent Management)

**Files:**
- Create: `AgentRefinement/AgentRefinement/Views/Screens/AgentsScreen.swift`
- Modify: `AgentRefinement/AgentRefinement/Views/MainTabView.swift`

- [ ] **Step 1: Create AgentsScreen**

Create `AgentRefinement/AgentRefinement/Views/Screens/AgentsScreen.swift`:

```swift
import SwiftUI

struct AgentsScreen: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            cardGrid
        }
    }

    private var toolbar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                    .font(.system(size: 10))
                TextField("検索...", text: $appState.agentSearchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .frame(maxWidth: 180)

            RoleFilterBar(selectedRole: $appState.roleFilter)

            Spacer()

            Button {
                appState.addAgent(
                    name: "New Agent",
                    orgRoles: [.worker],
                    mode: .writer,
                    provider: .claudeCli
                )
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "plus")
                    Text("新規エージェント")
                }
                .font(.system(size: 11, weight: .semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private var cardGrid: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 220, maximum: 300))],
                spacing: 10
            ) {
                ForEach(appState.filteredAgents) { agent in
                    AgentCard(
                        agent: agent,
                        isSelected: appState.selectedAgentId == agent.id
                    ) {
                        appState.selectedAgentId = agent.id
                    }
                }
            }
            .padding(14)
        }
    }
}
```

- [ ] **Step 2: Wire into MainTabView**

Modify `MainTabView.swift` — replace the `.agents` case placeholder:

```swift
case .agents:
    AgentsScreen()
```

- [ ] **Step 3: Build and verify**

```bash
swift build
```

- [ ] **Step 4: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add AgentsScreen with card grid and role filter"
```

---

### Task 4: DetailPanelView — Full Agent Edit Form

**Files:**
- Modify: `AgentRefinement/AgentRefinement/Views/DetailPanelView.swift`

- [ ] **Step 1: Replace DetailPanelView with full edit form**

Replace `AgentRefinement/AgentRefinement/Views/DetailPanelView.swift`:

```swift
import SwiftUI

struct DetailPanelView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        if let agent = appState.selectedAgent {
            AgentEditForm(agent: agent)
                .id(agent.id)
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

struct AgentEditForm: View {
    @EnvironmentObject var appState: AppState
    let agent: MasterAgent

    @State private var name: String = ""
    @State private var orgRoles: [OrgRole] = []
    @State private var mode: AgentMode = .writer
    @State private var provider: ProviderKind = .claudeCli
    @State private var model: String = ""
    @State private var persona: String = ""
    @State private var skills: String = ""
    @State private var dependsOn: String = ""
    @State private var mcpEnabled: Bool = false
    @State private var mcpConfigPath: String = ""
    @State private var modelDecision: ModelDecision = .fixed

    @State private var showRolePicker = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                header
                actionButtons
                Divider()
                formFields
                mcpSection
                saveButton
            }
            .padding(14)
        }
        .frame(minWidth: 220, idealWidth: 260, maxWidth: 300)
        .onAppear { loadFromAgent() }
        .onChange(of: agent.id) { loadFromAgent() }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text(agent.primaryRole?.icon ?? "🤖")
                .font(.system(size: 20))
                .frame(width: 32, height: 32)
                .background(agent.primaryRole?.color.opacity(0.3) ?? Color.gray.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            VStack(alignment: .leading) {
                Text(agent.name).font(.system(size: 13, weight: .bold))
                Text("エージェント編集").font(.system(size: 9)).foregroundStyle(.tertiary)
            }
        }
    }

    private var actionButtons: some View {
        HStack(spacing: 6) {
            Button {
                appState.duplicateAgent(id: agent.id)
            } label: {
                Text("📋 複製して作成")
                    .font(.system(size: 10, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .background(Color.accentColor.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color.accentColor, lineWidth: 1))
            }
            .buttonStyle(.plain)

            Button {
                appState.deleteAgent(id: agent.id)
            } label: {
                Text("🗑 削除")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .background(Color.red.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color.red.opacity(0.5), lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private var formFields: some View {
        VStack(alignment: .leading, spacing: 8) {
            fieldLabel("名前")
            TextField("", text: $name).textFieldStyle(.roundedBorder).font(.system(size: 11))

            fieldLabel("組織ロール（複数選択可）")
            roleSelector

            fieldLabel("実行モード")
            Picker("", selection: $mode) {
                ForEach(AgentMode.allCases, id: \.self) { m in
                    Text(m.rawValue).tag(m)
                }
            }.pickerStyle(.segmented).font(.system(size: 10))

            fieldLabel("プロバイダー")
            Picker("", selection: $provider) {
                ForEach(ProviderKind.allCases, id: \.self) { p in
                    Text(p.rawValue).tag(p)
                }
            }.font(.system(size: 11))

            fieldLabel("モデル")
            TextField("例: claude-sonnet-4-6", text: $model).textFieldStyle(.roundedBorder).font(.system(size: 11))

            fieldLabel("ペルソナ")
            TextEditor(text: $persona)
                .font(.system(size: 11))
                .frame(height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color(nsColor: .separatorColor)))

            fieldLabel("スキル（カンマ区切り）")
            TextField("例: 文章構成, 論理展開", text: $skills).textFieldStyle(.roundedBorder).font(.system(size: 11))

            fieldLabel("モデル決定")
            Picker("", selection: $modelDecision) {
                Text("fixed").tag(ModelDecision.fixed)
                Text("ceo_decides").tag(ModelDecision.ceoDecides)
            }.pickerStyle(.segmented).font(.system(size: 10))
        }
    }

    private var roleSelector: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                ForEach(orgRoles, id: \.self) { role in
                    HStack(spacing: 2) {
                        Text(role.icon).font(.system(size: 8))
                        Text(role.shortName).font(.system(size: 8, weight: .semibold))
                        Button {
                            orgRoles = orgRoles.filter { $0 != role }
                        } label: {
                            Text("×").font(.system(size: 8)).foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(role.color.opacity(0.15))
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(role.color.opacity(0.5)))
                }

                Button { showRolePicker.toggle() } label: {
                    Text("+ 追加").font(.system(size: 8))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [3])))
                }
                .buttonStyle(.plain)
            }

            if showRolePicker {
                VStack(spacing: 2) {
                    ForEach(OrgRole.allCases.filter { !orgRoles.contains($0) }) { role in
                        Button {
                            orgRoles.append(role)
                            showRolePicker = false
                        } label: {
                            HStack(spacing: 4) {
                                Text(role.icon).font(.system(size: 10))
                                Text(role.displayName).font(.system(size: 10))
                                Spacer()
                            }
                            .padding(.horizontal, 8).padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
            }
        }
    }

    private var mcpSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider()
            fieldLabel("MCP設定")
            Toggle("MCP有効", isOn: $mcpEnabled)
                .font(.system(size: 11))

            if mcpEnabled {
                fieldLabel("Config Path")
                TextField("/path/to/mcp-config.json", text: $mcpConfigPath)
                    .textFieldStyle(.roundedBorder).font(.system(size: 11))
            }
        }
    }

    private var saveButton: some View {
        Button {
            save()
        } label: {
            Text("保存")
                .font(.system(size: 12, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
        .padding(.top, 6)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(.secondary)
    }

    private func loadFromAgent() {
        name = agent.name
        orgRoles = agent.orgRoles
        mode = agent.mode
        provider = agent.provider
        model = agent.model ?? ""
        persona = agent.persona ?? ""
        skills = agent.skills.joined(separator: ", ")
        dependsOn = agent.dependsOn.joined(separator: ", ")
        mcpEnabled = agent.mcpEnabled
        mcpConfigPath = agent.mcpConfigPath ?? ""
        modelDecision = agent.modelDecision
    }

    private func save() {
        let updated = MasterAgent(
            id: agent.id,
            name: name,
            orgRoles: orgRoles,
            mode: mode,
            provider: provider,
            model: model.isEmpty ? nil : model,
            persona: persona.isEmpty ? nil : persona,
            skills: skills.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) },
            dependsOn: dependsOn.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) },
            commandTemplate: agent.commandTemplate,
            mcpEnabled: mcpEnabled,
            mcpConfigPath: mcpConfigPath.isEmpty ? nil : mcpConfigPath,
            mcpServers: agent.mcpServers,
            mcpInstruction: agent.mcpInstruction,
            mcpContextCommand: agent.mcpContextCommand,
            mcpTimeoutSec: agent.mcpTimeoutSec,
            modelDecision: modelDecision,
            createdAt: agent.createdAt,
            updatedAt: Date()
        )
        appState.updateAgent(updated)
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
swift build
```

- [ ] **Step 3: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add full agent edit form with role selector and MCP config"
```

---

### Task 5: Screen 2 — 組織テンプレート (Templates)

**Files:**
- Create: `AgentRefinement/AgentRefinement/Views/Components/SlotEditor.swift`
- Create: `AgentRefinement/AgentRefinement/Views/Screens/TemplatesScreen.swift`
- Modify: `AgentRefinement/AgentRefinement/Views/MainTabView.swift`

- [ ] **Step 1: Create SlotEditor component**

Create `AgentRefinement/AgentRefinement/Views/Components/SlotEditor.swift`:

```swift
import SwiftUI

struct SlotEditor: View {
    let slot: Slot
    let agents: [MasterAgent]
    let onUpdate: (Slot) -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Text("⠿").foregroundStyle(.tertiary).font(.system(size: 14))

            Text(slot.orgRole.icon).font(.system(size: 16))

            VStack(alignment: .leading, spacing: 2) {
                Text(slot.orgRole.displayName)
                    .font(.system(size: 11, weight: .semibold))
                Text("\(slot.minCount)-\(slot.maxCount)名 · \(slot.required ? "必須" : "任意")")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text("\(slot.assignedAgentIds.count)名")
                .font(.system(size: 9))
                .foregroundStyle(.secondary)

            Button(action: onRemove) {
                Text("×")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.red)
                    .padding(4)
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color(nsColor: .separatorColor)))
    }
}
```

- [ ] **Step 2: Create TemplatesScreen**

Create `AgentRefinement/AgentRefinement/Views/Screens/TemplatesScreen.swift`:

```swift
import SwiftUI

struct TemplatesScreen: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTemplateId: UUID?
    @State private var newTemplateName: String = ""

    private var selectedTemplate: OrganizationTemplate? {
        appState.templates.first { $0.id == selectedTemplateId }
    }

    var body: some View {
        HSplitView {
            templateList
                .frame(minWidth: 200, idealWidth: 220, maxWidth: 260)
            templateDetail
        }
    }

    private var templateList: some View {
        VStack(spacing: 0) {
            HStack {
                Text("テンプレート")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    appState.addTemplate(name: "新規テンプレート")
                    selectedTemplateId = appState.templates.last?.id
                } label: {
                    HStack(spacing: 2) {
                        Image(systemName: "plus")
                        Text("新規")
                    }
                    .font(.system(size: 10, weight: .semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
            .padding(10)

            Divider()

            List(appState.templates, selection: $selectedTemplateId) { template in
                VStack(alignment: .leading, spacing: 2) {
                    Text(template.name)
                        .font(.system(size: 11, weight: .semibold))
                    Text("\(template.slots.count)スロット · \(template.orchestrationMode)")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
                .tag(template.id)
            }
            .listStyle(.sidebar)
        }
    }

    private var templateDetail: some View {
        Group {
            if let template = selectedTemplate {
                TemplateDetailView(template: template)
            } else {
                VStack {
                    Text("テンプレートを選択してください")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

struct TemplateDetailView: View {
    @EnvironmentObject var appState: AppState
    let template: OrganizationTemplate

    @State private var name: String = ""
    @State private var orchestrationMode: String = "sequential"
    @State private var workflowMode: String = "coding"
    @State private var rounds: Int = 1
    @State private var addSlotRole: OrgRole = .worker

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                headerSection
                Divider()
                settingsSection
                Divider()
                slotsSection
                Divider()
                footerButtons
            }
            .padding(16)
        }
        .onAppear { loadTemplate() }
        .onChange(of: template.id) { loadTemplate() }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField("テンプレート名", text: $name)
                .font(.system(size: 14, weight: .bold))
                .textFieldStyle(.plain)
            Text("作成: \(template.createdAt.formatted(.dateTime.month().day()))")
                .font(.system(size: 9))
                .foregroundStyle(.tertiary)

            HStack(spacing: 6) {
                Button {
                    appState.deleteTemplate(id: template.id)
                } label: {
                    Text("🗑 削除").font(.system(size: 10)).foregroundStyle(.red)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color.red.opacity(0.5)))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var settingsSection: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("オーケストレーション").font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
                Picker("", selection: $orchestrationMode) {
                    Text("sequential").tag("sequential")
                    Text("dependency_graph").tag("dependency_graph")
                    Text("role_based").tag("role_based")
                }.font(.system(size: 10))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("ラウンド").font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
                Picker("", selection: $rounds) {
                    ForEach(1...5, id: \.self) { n in Text("\(n)").tag(n) }
                }.font(.system(size: 10))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("モード").font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
                Picker("", selection: $workflowMode) {
                    Text("writing").tag("writing")
                    Text("coding").tag("coding")
                }.font(.system(size: 10))
            }
        }
    }

    private var slotsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("スロット定義")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.secondary)

            ForEach(template.slots) { slot in
                SlotEditor(
                    slot: slot,
                    agents: appState.agents,
                    onUpdate: { updated in
                        var t = template
                        t.slots = t.slots.map { $0.id == updated.id ? updated : $0 }
                        appState.updateTemplate(t)
                    },
                    onRemove: {
                        var t = template
                        t.slots = t.slots.filter { $0.id != slot.id }
                        appState.updateTemplate(t)
                    }
                )
            }

            HStack(spacing: 6) {
                Picker("", selection: $addSlotRole) {
                    ForEach(OrgRole.allCases) { role in
                        Text("\(role.icon) \(role.displayName)").tag(role)
                    }
                }
                .font(.system(size: 10))

                Button {
                    var t = template
                    t.slots.append(Slot(orgRole: addSlotRole))
                    appState.updateTemplate(t)
                } label: {
                    Text("+ 追加")
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
            .padding(8)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [5]))
                    .foregroundStyle(.tertiary)
            )
        }
    }

    private var footerButtons: some View {
        HStack {
            Spacer()
            Button { save() } label: {
                Text("保存")
                    .font(.system(size: 11, weight: .bold))
                    .padding(.horizontal, 16).padding(.vertical, 6)
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
        }
    }

    private func loadTemplate() {
        name = template.name
        orchestrationMode = template.orchestrationMode
        workflowMode = template.workflowMode
        rounds = template.rounds
    }

    private func save() {
        var updated = template
        updated.name = name
        updated.orchestrationMode = orchestrationMode
        updated.workflowMode = workflowMode
        updated.rounds = rounds
        updated.updatedAt = Date()
        appState.updateTemplate(updated)
    }
}
```

- [ ] **Step 3: Wire into MainTabView**

Replace `.templates` case:
```swift
case .templates:
    TemplatesScreen()
```

- [ ] **Step 4: Build and verify**

```bash
swift build
```

- [ ] **Step 5: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add TemplatesScreen with slot-based template management"
```

---

### Task 6: Screen 1 — 要件・実行 (Requirements & Execution)

**Files:**
- Create: `AgentRefinement/AgentRefinement/Views/Components/ExecutionLogTable.swift`
- Create: `AgentRefinement/AgentRefinement/Views/Components/CEOChatView.swift`
- Create: `AgentRefinement/AgentRefinement/Views/Screens/RequirementsScreen.swift`
- Modify: `AgentRefinement/AgentRefinement/Views/MainTabView.swift`

- [ ] **Step 1: Create ExecutionLogTable**

Create `AgentRefinement/AgentRefinement/Views/Components/ExecutionLogTable.swift`:

```swift
import SwiftUI

struct ExecutionLogEntry: Identifiable {
    let id = UUID()
    let agentName: String
    let agentIcon: String
    let roles: [OrgRole]
    let status: ExecutionStatus
    let logs: [String]
}

enum ExecutionStatus: String {
    case done = "完了"
    case running = "実行中"
    case waiting = "待機"

    var color: Color {
        switch self {
        case .done: .green
        case .running: .blue
        case .waiting: .gray
        }
    }
}

struct ExecutionLogTable: View {
    let entries: [ExecutionLogEntry]

    var body: some View {
        VStack(spacing: 0) {
            headerRow
            Divider()
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(entries) { entry in
                        entryRow(entry)
                        Divider()
                    }
                }
            }
        }
    }

    private var headerRow: some View {
        HStack(spacing: 0) {
            Text("エージェント").frame(width: 120, alignment: .leading)
            Text("状態").frame(width: 60, alignment: .leading)
            Text("ログ出力").frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.system(size: 9, weight: .semibold))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
    }

    private func entryRow(_ entry: ExecutionLogEntry) -> some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(entry.agentIcon).font(.system(size: 12))
                    Text(entry.agentName).font(.system(size: 10, weight: .semibold))
                }
                HStack(spacing: 3) {
                    ForEach(entry.roles, id: \.self) { role in
                        RoleBadge(role: role)
                    }
                }
            }
            .frame(width: 120, alignment: .leading)

            Text(entry.status.rawValue)
                .font(.system(size: 9, weight: .semibold))
                .padding(.horizontal, 6).padding(.vertical, 1)
                .background(entry.status.color.opacity(0.15))
                .clipShape(Capsule())
                .frame(width: 60, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                ForEach(entry.logs, id: \.self) { log in
                    Text(log)
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}
```

- [ ] **Step 2: Create CEOChatView**

Create `AgentRefinement/AgentRefinement/Views/Components/CEOChatView.swift`:

```swift
import SwiftUI

struct ChatMessage: Identifiable {
    let id = UUID()
    let sender: String
    let icon: String
    let content: String
    let isUser: Bool
}

struct CEOChatView: View {
    @State private var inputText: String = ""
    let messages: [ChatMessage]
    let onSend: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("💬 CEO レポート")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.orange)
                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(messages) { msg in
                        HStack(alignment: .top, spacing: 4) {
                            Text("\(msg.icon) \(msg.sender):")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(msg.isUser ? .blue : .orange)
                            Text(msg.content)
                                .font(.system(size: 10))
                        }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
            }

            HStack(spacing: 4) {
                TextField("メッセージを入力...", text: $inputText)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 10))
                    .onSubmit { send() }

                Button(action: send) {
                    Text("送信")
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
        }
    }

    private func send() {
        guard !inputText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        onSend(inputText)
        inputText = ""
    }
}
```

- [ ] **Step 3: Create RequirementsScreen**

Create `AgentRefinement/AgentRefinement/Views/Screens/RequirementsScreen.swift`:

```swift
import SwiftUI

struct RequirementsScreen: View {
    @EnvironmentObject var appState: AppState
    @State private var requirementsText: String = ""
    @State private var logEntries: [ExecutionLogEntry] = []
    @State private var chatMessages: [ChatMessage] = []

    var body: some View {
        VStack(spacing: 0) {
            requirementsBar
            Divider()
            executionArea
            ceoChatArea
        }
    }

    private var requirementsBar: some View {
        HStack(spacing: 8) {
            Text("要件").font(.system(size: 10, weight: .bold)).foregroundStyle(.secondary)

            TextField("要件を入力...", text: $requirementsText)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 11))

            Button {
                startExecution()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "play.fill").font(.system(size: 9))
                    Text("実行")
                }
                .font(.system(size: 11, weight: .bold))
                .padding(.horizontal, 14).padding(.vertical, 5)
                .background(appState.isExecuting ? Color.gray : Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
            .disabled(appState.isExecuting || requirementsText.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private var executionArea: some View {
        Group {
            if logEntries.isEmpty {
                VStack(spacing: 8) {
                    Text("📋 要件を入力して実行してください")
                        .font(.system(size: 12))
                        .foregroundStyle(.tertiary)
                    Text("エージェントの実行ログがここに表示されます")
                        .font(.system(size: 10))
                        .foregroundStyle(.quaternary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ExecutionLogTable(entries: logEntries)
            }
        }
    }

    private var ceoChatArea: some View {
        CEOChatView(messages: chatMessages) { message in
            chatMessages.append(
                ChatMessage(sender: "あなた", icon: "👤", content: message, isUser: true)
            )
        }
        .frame(height: 100)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.3))
    }

    private func startExecution() {
        logEntries = appState.agents.enumerated().map { index, agent in
            ExecutionLogEntry(
                agentName: agent.name,
                agentIcon: agent.primaryRole?.icon ?? "🤖",
                roles: agent.orgRoles,
                status: index == 0 ? .running : .waiting,
                logs: index == 0 ? ["→ 実行開始..."] : ["— 前ステップの完了待ち"]
            )
        }

        chatMessages.append(
            ChatMessage(
                sender: "Director",
                icon: "👑",
                content: "要件を受領しました。タスク分解を開始します。",
                isUser: false
            )
        )
    }
}
```

- [ ] **Step 4: Wire into MainTabView**

Replace `.requirements` case:
```swift
case .requirements:
    RequirementsScreen()
```

- [ ] **Step 5: Build and verify**

```bash
swift build
```

- [ ] **Step 6: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add RequirementsScreen with execution log table and CEO chat"
```

---

### Task 7: SidebarView — File Tree

**Files:**
- Create: `AgentRefinement/AgentRefinement/Views/Components/FileTreeView.swift`
- Modify: `AgentRefinement/AgentRefinement/Views/SidebarView.swift`

- [ ] **Step 1: Create FileTreeView**

Create `AgentRefinement/AgentRefinement/Views/Components/FileTreeView.swift`:

```swift
import SwiftUI

struct FileNode: Identifiable {
    let id = UUID()
    let name: String
    let path: String
    let isDirectory: Bool
    var children: [FileNode]
}

struct FileTreeView: View {
    let rootPath: String
    @State private var rootNodes: [FileNode] = []

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(rootNodes) { node in
                    FileTreeRow(node: node, depth: 0)
                }
            }
            .padding(.vertical, 4)
        }
        .onAppear { loadTree() }
    }

    private func loadTree() {
        let url = URL(fileURLWithPath: rootPath)
        rootNodes = loadChildren(at: url, maxDepth: 3, currentDepth: 0)
    }

    private func loadChildren(at url: URL, maxDepth: Int, currentDepth: Int) -> [FileNode] {
        guard currentDepth < maxDepth else { return [] }
        let fm = FileManager.default
        guard let items = try? fm.contentsOfDirectory(
            at: url, includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }

        return items.sorted { a, b in
            let aIsDir = (try? a.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
            let bIsDir = (try? b.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
            if aIsDir != bIsDir { return aIsDir }
            return a.lastPathComponent.localizedCaseInsensitiveCompare(b.lastPathComponent) == .orderedAscending
        }.map { item in
            let isDir = (try? item.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
            let children = isDir ? loadChildren(at: item, maxDepth: maxDepth, currentDepth: currentDepth + 1) : []
            return FileNode(name: item.lastPathComponent, path: item.path, isDirectory: isDir, children: children)
        }
    }
}

struct FileTreeRow: View {
    let node: FileNode
    let depth: Int
    @State private var isExpanded: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                if node.isDirectory { isExpanded.toggle() }
            } label: {
                HStack(spacing: 4) {
                    if node.isDirectory {
                        Text(isExpanded ? "▼" : "▶")
                            .font(.system(size: 8))
                            .foregroundStyle(.tertiary)
                            .frame(width: 10)
                    } else {
                        Spacer().frame(width: 10)
                    }

                    Text(node.isDirectory ? "📂" : "📄")
                        .font(.system(size: 10))

                    Text(node.name)
                        .font(.system(size: 11))
                        .foregroundStyle(node.isDirectory ? .primary : .blue)
                        .lineLimit(1)
                }
                .padding(.leading, CGFloat(depth * 14) + 6)
                .padding(.vertical, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded && node.isDirectory {
                ForEach(node.children) { child in
                    FileTreeRow(node: child, depth: depth + 1)
                }
            }
        }
    }
}
```

- [ ] **Step 2: Update SidebarView**

Replace `SidebarView.swift`:

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
                    .padding(.top, 6)

                FileTreeView(rootPath: dir)
            } else {
                VStack {
                    Text("案件を選択してください")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(minWidth: 180, idealWidth: 200, maxWidth: 240)
    }
}
```

- [ ] **Step 3: Build and verify**

```bash
swift build
```

- [ ] **Step 4: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: add FileTreeView and real folder tree in sidebar"
```

---

### Task 8: Wire Everything — ContentView + BottomPanel + App

**Files:**
- Modify: `AgentRefinement/AgentRefinement/ContentView.swift`
- Modify: `AgentRefinement/AgentRefinement/Views/BottomPanelView.swift`
- Modify: `AgentRefinement/AgentRefinement/AgentRefinementApp.swift`

- [ ] **Step 1: Update ContentView to use AppState**

Replace `ContentView.swift` to use `@EnvironmentObject var appState: AppState` instead of local `@State` arrays. Remove all local state and sample data. Use `appState.projects`, `appState.agents`, `appState.selectedProjectId`, etc.

- [ ] **Step 2: Update BottomPanelView to use AppState**

Replace bindings to use `@EnvironmentObject var appState: AppState`.

- [ ] **Step 3: Update AgentRefinementApp**

Add `@StateObject private var appState = AppState()`, inject `.environmentObject(appState)`, call `appState.loadAll()` on appear. Keep SidecarManager as separate `@StateObject`.

- [ ] **Step 4: Build and run**

```bash
swift build
```

- [ ] **Step 5: Commit**

```bash
git add AgentRefinement/
git commit -m "feat: wire AppState through entire view hierarchy"
```

---

## Phase 2 Completion Checklist

After all 8 tasks:

- [ ] `swift build` succeeds
- [ ] `swift test` passes all tests (existing + new AppState tests)
- [ ] App launches and shows 5-zone layout
- [ ] エージェント管理: カードグリッド表示、ロールフィルター動作、右パネルで編集
- [ ] 組織テンプレート: テンプレート一覧、スロット追加/削除、設定変更
- [ ] 要件・実行: 要件入力、ログテーブル表示、CEOチャット
- [ ] サイドバー: フォルダーツリー表示
- [ ] データ永続化: エージェント/テンプレートの保存/読込が動作

**Next:** Phase 3 — ワークフローエディタ (WKWebView) + 評価システム統合
