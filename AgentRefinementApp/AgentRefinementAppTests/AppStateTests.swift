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
        try FileManager.default.removeItem(at: testDir)
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
