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
    @Published var selectedWorkflowId: UUID?
    @Published var selectedTab: MainTab = .requirements
    @Published var bottomTab: BottomTab = .agents

    @Published var roleFilter: OrgRole?
    @Published var agentSearchText: String = ""

    @Published var isExecuting: Bool = false
    @Published var executionEvents: [[String: Any]] = []

    let dataStore: DataStore

    init(dataStore: DataStore = DataStore()) {
        self.dataStore = dataStore
    }

    var selectedProject: Project? {
        projects.first { $0.id == selectedProjectId }
    }

    var selectedAgent: MasterAgent? {
        agents.first { $0.id == selectedAgentId }
    }

    var selectedWorkflow: Workflow? {
        workflows.first { $0.id == selectedWorkflowId }
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

    func updateProject(_ project: Project) {
        projects = projects.map { $0.id == project.id ? project : $0 }
        try? dataStore.saveProject(project)
    }

    func addWorkflow(name: String) {
        let startNode = WorkflowNode(type: .start, position: Position(x: 100, y: 30), label: "▶ 開始")
        let endNode = WorkflowNode(type: .end, position: Position(x: 100, y: 400), label: "⏹ 終了")
        let workflow = Workflow(name: name, nodes: [startNode, endNode])
        workflows.append(workflow)
        try? dataStore.saveWorkflow(workflow)
        selectedWorkflowId = workflow.id
    }

    func updateWorkflow(_ workflow: Workflow) {
        workflows = workflows.map { $0.id == workflow.id ? workflow : $0 }
        try? dataStore.saveWorkflow(workflow)
    }

    func deleteWorkflow(id: UUID) {
        workflows = workflows.filter { $0.id != id }
        if selectedWorkflowId == id { selectedWorkflowId = nil }
        try? dataStore.deleteWorkflow(id: id)
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

    // MARK: - Execution

    func executeRefinement(requirements: String) async {
        guard !isExecuting else { return }
        isExecuting = true
        // Will be connected to Orchestrator in a later task
        isExecuting = false
    }

    // MARK: - Evaluation

    func addEvaluation(
        agentSnapshotId: UUID,
        projectId: UUID,
        evaluatorRole: EvaluatorRole,
        score: Int,
        comment: String?,
        roundNumber: Int?,
        isFinal: Bool
    ) {
        let evaluation = Evaluation(
            evaluatorRole: evaluatorRole,
            score: score,
            comment: comment,
            roundNumber: roundNumber,
            isFinal: isFinal
        )

        projects = projects.map { project in
            guard project.id == projectId else { return project }
            var updated = project
            updated.agentSnapshots = updated.agentSnapshots.map { snapshot in
                guard snapshot.id == agentSnapshotId else { return snapshot }
                var s = snapshot
                s.evaluations.append(evaluation)
                return s
            }
            updated.updatedAt = Date()
            return updated
        }

        if let project = projects.first(where: { $0.id == projectId }) {
            try? dataStore.saveProject(project)
        }
    }
}
