import Testing
import Foundation
@testable import AgentRefinementApp

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

    @Test("Load agent by id")
    func loadAgentById() throws {
        let store = DataStore(baseDirectory: testDir)
        let agent = MasterAgent(
            id: "specific-agent",
            name: "Specific",
            orgRoles: [.worker],
            mode: .editor,
            provider: .geminiCli
        )
        try store.saveAgent(agent)
        let loaded = try store.loadAgent(id: "specific-agent")
        #expect(loaded?.id == "specific-agent")
        #expect(loaded?.name == "Specific")
        let missing = try store.loadAgent(id: "does-not-exist")
        #expect(missing == nil)
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Save and load templates")
    func saveAndLoadTemplates() throws {
        let store = DataStore(baseDirectory: testDir)
        let template = OrganizationTemplate(name: "Test Template")
        try store.saveTemplate(template)
        let loaded = try store.loadTemplates()
        #expect(loaded.count == 1)
        #expect(loaded[0].name == "Test Template")
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Delete template removes file")
    func deleteTemplate() throws {
        let store = DataStore(baseDirectory: testDir)
        let template = OrganizationTemplate(name: "To Delete")
        try store.saveTemplate(template)
        #expect(try store.loadTemplates().count == 1)
        try store.deleteTemplate(id: template.id)
        #expect(try store.loadTemplates().isEmpty)
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Save and load workflows")
    func saveAndLoadWorkflows() throws {
        let store = DataStore(baseDirectory: testDir)
        let workflow = Workflow(name: "Test Workflow")
        try store.saveWorkflow(workflow)
        let loaded = try store.loadWorkflows()
        #expect(loaded.count == 1)
        #expect(loaded[0].name == "Test Workflow")
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Delete workflow removes file")
    func deleteWorkflow() throws {
        let store = DataStore(baseDirectory: testDir)
        let workflow = Workflow(name: "To Delete")
        try store.saveWorkflow(workflow)
        #expect(try store.loadWorkflows().count == 1)
        try store.deleteWorkflow(id: workflow.id)
        #expect(try store.loadWorkflows().isEmpty)
        try FileManager.default.removeItem(at: testDir)
    }

    @Test("Load from nonexistent directory returns empty")
    func loadFromNonexistentDirectory() throws {
        let store = DataStore(baseDirectory: testDir)
        let agents = try store.loadAgents()
        #expect(agents.isEmpty)
        let projects = try store.loadProjects()
        #expect(projects.isEmpty)
    }

    @Test("Delete nonexistent agent is no-op")
    func deleteNonexistentAgent() throws {
        let store = DataStore(baseDirectory: testDir)
        // Should not throw
        try store.deleteAgent(id: "ghost")
        try? FileManager.default.removeItem(at: testDir)
    }
}
