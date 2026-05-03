import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("AppState Tests")
struct AppStateTests {

    @Test("Initial state loads from DataStore")
    @MainActor
    func initialLoad() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let agent = MasterAgent(id: "test-1", name: "Test", orgRoles: [.worker], mode: .writer, provider: .claudeCli)
        try store.saveAgent(agent)

        let state = AppState(dataStore: store)
        state.loadAll()

        #expect(state.agents.count == 1)
        #expect(state.agents[0].id == "test-1")
        try? FileManager.default.removeItem(at: testDir)
    }

    @Test("Add agent persists to store")
    @MainActor
    func addAgentPersists() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)

        state.addAgent(name: "New Agent", orgRoles: [.qa], mode: .reviewer, provider: .claudeCli)

        #expect(state.agents.count == 1)
        let persisted = try store.loadAgents()
        #expect(persisted.count == 1)
        #expect(persisted[0].name == "New Agent")
        try? FileManager.default.removeItem(at: testDir)
    }

    @Test("Add agent includes Swift and SwiftUI skills by default")
    @MainActor
    func addAgentIncludesSwiftSkills() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)

        state.addAgent(name: "iOS Worker", orgRoles: [.worker], mode: .writer, provider: .claudeCli)

        #expect(state.agents.count == 1)
        #expect(state.agents[0].skills.contains("Swift"))
        #expect(state.agents[0].skills.contains("SwiftUI"))

        let persisted = try store.loadAgents()
        #expect(persisted.count == 1)
        #expect(persisted[0].skills.contains("Swift"))
        #expect(persisted[0].skills.contains("SwiftUI"))
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Load all backfills Swift and SwiftUI skills for existing agents")
    @MainActor
    func loadAllBackfillsSwiftSkills() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let legacyAgent = MasterAgent(
            id: "legacy-1",
            name: "Legacy",
            orgRoles: [.worker],
            mode: .writer,
            provider: .claudeCli,
            skills: ["設計"]
        )
        try store.saveAgent(legacyAgent)

        let state = AppState(dataStore: store)
        state.loadAll()

        #expect(state.agents.count == 1)
        #expect(state.agents[0].skills.contains("設計"))
        #expect(state.agents[0].skills.contains("Swift"))
        #expect(state.agents[0].skills.contains("SwiftUI"))

        let persisted = try store.loadAgents()
        #expect(persisted.count == 1)
        #expect(persisted[0].skills.contains("Swift"))
        #expect(persisted[0].skills.contains("SwiftUI"))
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Load all bootstraps default agents and template on empty store")
    @MainActor
    func loadAllBootstrapsDefaultTeam() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)

        state.loadAll()

        #expect(state.agents.contains { $0.orgRoles.contains(.ceo) })
        #expect(state.agents.contains { $0.orgRoles.contains(.manager) })
        #expect(state.agents.contains { $0.orgRoles.contains(.worker) })
        #expect(state.agents.contains { $0.orgRoles.contains(.qa) })
        let template = state.templates.first { $0.isPreset && $0.name == "標準チーム" }
        #expect(template != nil)
        #expect(template?.slots.contains { $0.orgRole == .worker && !$0.assignedAgentIds.isEmpty } == true)
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Load all does not duplicate bootstrapped defaults")
    @MainActor
    func loadAllBootstrapsOnlyOnce() throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)

        state.loadAll()
        let firstAgentCount = state.agents.count
        let firstTemplateCount = state.templates.count
        state.loadAll()

        #expect(state.agents.count == firstAgentCount)
        #expect(state.templates.count == firstTemplateCount)
        #expect(state.templates.filter { $0.isPreset && $0.name == "標準チーム" }.count == 1)
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Requirements draft submit trims text and clears state")
    @MainActor
    func requirementsDraftSubmit() {
        let state = AppState(
            dataStore: DataStore(
                baseDirectory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            )
        )
        state.requirementsDraft = "  hello\nworld  "

        let submitted = state.consumeRequirementsDraft()

        #expect(submitted == "hello\nworld")
        #expect(state.requirementsDraft.isEmpty)
    }

    @Test("Requirements draft submit returns nil for blank text")
    @MainActor
    func requirementsDraftRejectsBlank() {
        let state = AppState(
            dataStore: DataStore(
                baseDirectory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            )
        )
        state.requirementsDraft = "   \n  "

        let submitted = state.consumeRequirementsDraft()

        #expect(submitted == nil)
        #expect(state.requirementsDraft == "   \n  ")
    }

    @Test("Chat draft submit trims text and clears state")
    @MainActor
    func chatDraftSubmit() {
        let state = AppState(
            dataStore: DataStore(
                baseDirectory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            )
        )
        state.chatDraft = "  ping  "

        let submitted = state.consumeChatDraft()

        #expect(submitted == "ping")
        #expect(state.chatDraft.isEmpty)
    }

    @Test("Terminal draft submit trims text and clears state")
    @MainActor
    func terminalDraftSubmit() {
        let state = AppState(
            dataStore: DataStore(
                baseDirectory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            )
        )
        state.terminalDraft = "  ls -la  "

        let submitted = state.consumeTerminalDraft()

        #expect(submitted == "ls -la")
        #expect(state.terminalDraft.isEmpty)
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

    @Test("Project flow runs from creation to result presentation")
    @MainActor
    func projectCreationToResultFlow() async throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let workDir = testDir.appendingPathComponent("うんこ")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)
        state.loadAll()

        // Use deterministic local shell outputs so this E2E test does not require external AI CLIs.
        state.addAgent(name: "議長", orgRoles: [.ceo], mode: .writer, provider: .customCli)
        state.addAgent(name: "料理人", orgRoles: [.worker], mode: .writer, provider: .customCli)
        state.addAgent(name: "批評家", orgRoles: [.qa], mode: .reviewer, provider: .customCli)

        func configuredAgent(named name: String, output: String) -> MasterAgent {
            var agent = state.agents.first(where: { $0.name == name })!
            agent.commandTemplate = "sh -lc \"echo '\(output)'\""
            return agent
        }

        let ceo = configuredAgent(
            named: "議長",
            output: "最高の晩餐について: 体験全体のテーマを最優先に決定する。"
        )
        let worker = configuredAgent(
            named: "料理人",
            output: "最高の晩餐について: 季節食材の前菜と火入れ重視のメインを提案する。"
        )
        let qa = configuredAgent(
            named: "批評家",
            output: "最高の晩餐について: 香り・温度・食感の整合を検証して最終案とする。"
        )
        state.updateAgent(ceo)
        state.updateAgent(worker)
        state.updateAgent(qa)

        let slots = [
            Slot(orgRole: .ceo, assignedAgentIds: [ceo.id]),
            Slot(orgRole: .worker, assignedAgentIds: [worker.id]),
            Slot(orgRole: .qa, assignedAgentIds: [qa.id]),
        ]
        state.addTemplate(name: "テスト組織", slots: slots)
        guard var template = state.templates.first(where: { $0.name == "テスト組織" }) else {
            Issue.record("template was not created")
            try FileManager.default.removeItem(at: testDir)
            return
        }
        template.orchestrationMode = "role_based"
        template.workflowMode = "writing"
        template.rounds = 1
        state.updateTemplate(template)

        state.addProject(
            name: "うんこ",
            workingDirectory: workDir.path,
            templateId: template.id,
            requirements: "最高の晩餐について"
        )

        #expect(state.selectedProject?.name == "うんこ")
        #expect(state.selectedProject?.workingDirectory == workDir.path)
        #expect(state.selectedProject?.requirements == "最高の晩餐について")

        await state.executeRefinement(requirements: "最高の晩餐について")

        let turnCompletedNames: [String] = state.executionEvents.compactMap { event in
            guard (event["type"] as? String) == "turn_completed" else { return nil }
            return event["agent_name"] as? String
        }
        #expect(Set(turnCompletedNames) == Set(["議長", "料理人", "批評家"]))

        let runCompleted = state.executionEvents.first { ($0["type"] as? String) == "run_completed" }
        #expect(runCompleted != nil)
        let finalText = runCompleted?["final_text"] as? String ?? ""
        #expect(finalText.contains("最高の晩餐について"))

        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Execute refinement resets events per run")
    @MainActor
    func executeRefinementResetsEvents() async throws {
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("appstate-test-\(UUID().uuidString)")
        let store = DataStore(baseDirectory: testDir)
        let state = AppState(dataStore: store)
        state.addAgent(name: "Solo", orgRoles: [.worker], mode: .writer, provider: .customCli)

        var agent = state.agents[0]
        agent.commandTemplate = "sh -lc \"echo 'first run output'\""
        state.updateAgent(agent)
        await state.executeRefinement(requirements: "first")

        agent.commandTemplate = "sh -lc \"echo 'second run output'\""
        state.updateAgent(agent)
        await state.executeRefinement(requirements: "second")

        let runStartedCount = state.executionEvents.filter { ($0["type"] as? String) == "run_started" }.count
        let turnCompleted = state.executionEvents.filter { ($0["type"] as? String) == "turn_completed" }
        #expect(runStartedCount == 1)
        #expect(turnCompleted.count == 1)
        #expect((turnCompleted.first?["full_output"] as? String) == "second run output")

        try FileManager.default.removeItem(at: testDir)
    }
}
