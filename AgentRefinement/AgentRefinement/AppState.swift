import Foundation
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    @Published var agents: [MasterAgent] = []
    @Published var projects: [Project] = []
    @Published var templates: [OrganizationTemplate] = []
    @Published var workflows: [Workflow] = []

    @Published var selectedProjectId: UUID?
    @Published var selectedAgentId: String?
    @Published var selectedTab: MainTab = .requirements
    @Published var bottomTab: BottomTab = .agents

    @Published var roleFilter: OrgRole?
    @Published var agentSearchText: String = ""

    @Published var isExecuting: Bool = false

    let dataStore: DataStore
    let apiClient: APIClient

    init(
        dataStore: DataStore = DataStore(),
        apiClient: APIClient = APIClient(baseURL: URL(string: "http://127.0.0.1:8000")!)
    ) {
        self.dataStore = dataStore
        self.apiClient = apiClient
    }

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

    func loadAll() {
        do {
            agents = try dataStore.loadAgents()
            projects = try dataStore.loadProjects()
            templates = try dataStore.loadTemplates()
            workflows = try dataStore.loadWorkflows()
        } catch {
            // empty state on first launch is fine
        }
    }

    func addAgent(name: String, orgRoles: [OrgRole], mode: AgentMode, provider: ProviderKind) {
        let id = "\(name.lowercased().replacingOccurrences(of: " ", with: "-"))-\(UUID().uuidString.prefix(8))"
        let agent = MasterAgent(id: id, name: name, orgRoles: orgRoles, mode: mode, provider: provider)
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
