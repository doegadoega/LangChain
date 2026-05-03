import Foundation
import SwiftUI

@MainActor
final class AppState: ObservableObject {
    private static let requiredAgentSkills = ["Swift", "SwiftUI"]
    private static let defaultTemplateName = "標準チーム"
    private static let defaultAgentIds: Set<String> = Set(defaultAgentSeeds.map(\.id))
    private static let defaultAgentSeeds: [DefaultAgentSeed] = [
        .init(
            id: "default-ceo",
            name: "Default CEO",
            role: .ceo,
            mode: .writer,
            provider: .claudeCli,
            dependsOn: [],
            persona: "全体方針と優先順位を決める責任者。"
        ),
        .init(
            id: "default-manager",
            name: "Default Manager",
            role: .manager,
            mode: .writer,
            provider: .claudeCli,
            dependsOn: ["default-ceo"],
            persona: "CEOの方針を分解し、実行計画に落とす。"
        ),
        .init(
            id: "default-worker",
            name: "Default Worker",
            role: .worker,
            mode: .writer,
            provider: .codexCli,
            dependsOn: ["default-manager"],
            persona: "実装を担当し、差分を作る。"
        ),
        .init(
            id: "default-qa",
            name: "Default QA",
            role: .qa,
            mode: .reviewer,
            provider: .claudeCli,
            dependsOn: ["default-worker"],
            persona: "変更を検証し、リスクを報告する。"
        ),
    ]

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

    @Published var requirementsDraft: String = ""
    @Published var chatDraft: String = ""
    @Published var terminalDraft: String = ""

    @Published var isExecuting: Bool = false
    @Published var executionEvents: [[String: Any]] = []
    @Published var pendingRequirementsAutoRunToken: UUID?

    let dataStore: DataStore
    let skillStore: SkillStore

    init(dataStore: DataStore = DataStore(), skillStore: SkillStore = SkillStore()) {
        self.dataStore = dataStore
        self.skillStore = skillStore
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
            let loadedAgents = try dataStore.loadAgents()
            var updatedAgents: [MasterAgent] = []
            agents = loadedAgents.map { agent in
                let normalizedSkills = mergedRequiredSkills(into: agent.skills)
                guard normalizedSkills != agent.skills else { return agent }
                var updated = agent
                updated.skills = normalizedSkills
                updated.updatedAt = Date()
                updatedAgents.append(updated)
                return updated
            }

            for agent in updatedAgents {
                try? dataStore.saveAgent(agent)
            }
            projects = try dataStore.loadProjects()
            templates = try dataStore.loadTemplates()
            workflows = try dataStore.loadWorkflows()
            bootstrapDefaultsIfNeeded()
        } catch {
            // empty state on first launch is fine
        }
    }

    func addAgent(name: String, orgRoles: [OrgRole], mode: AgentMode, provider: ProviderKind) {
        let id = "\(name.lowercased().replacingOccurrences(of: " ", with: "-"))-\(UUID().uuidString.prefix(8))"
        let agent = MasterAgent(
            id: id,
            name: name,
            orgRoles: orgRoles,
            mode: mode,
            provider: provider,
            skills: mergedRequiredSkills(into: [])
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
        guard !isDefaultAgent(id: id) else { return }
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

    func addProject(
        name: String,
        workingDirectory: String,
        templateId: UUID? = nil,
        requirements: String? = nil
    ) {
        let trimmedRequirements = requirements?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let project = Project(
            name: name,
            workingDirectory: workingDirectory,
            templateId: templateId?.uuidString,
            requirements: (trimmedRequirements?.isEmpty == false) ? trimmedRequirements : nil
        )
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

    func updateSelectedProjectRequirements(_ requirements: String) {
        guard let selectedProject else { return }
        var updated = selectedProject
        updated.requirements = requirements
        updated.updatedAt = Date()
        updateProject(updated)
    }

    func updateSelectedProjectTemplate(_ templateId: UUID?) {
        guard let selectedProject else { return }
        var updated = selectedProject
        updated.templateId = templateId?.uuidString
        updated.updatedAt = Date()
        updateProject(updated)
    }

    func isDefaultAgent(id: String) -> Bool {
        Self.defaultAgentIds.contains(id)
    }

    func queueRequirementsRun(_ requirements: String) {
        let trimmed = requirements.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        // RequirementsScreen consumes this draft and starts execution when token changes.
        requirementsDraft = trimmed
        selectedTab = .requirements
        pendingRequirementsAutoRunToken = UUID()
    }

    func templateCopyApplyingDefaultAgents(
        templateId: UUID?,
        defaultAgentsBySlotId: [UUID: String]
    ) -> OrganizationTemplate? {
        guard
            let templateId,
            var template = templates.first(where: { $0.id == templateId })
        else {
            return nil
        }

        template.slots = template.slots.map { slot in
            var updated = slot
            if let assignedAgentId = defaultAgentsBySlotId[slot.id] {
                updated.assignedAgentIds = [assignedAgentId]
            } else {
                updated.assignedAgentIds = []
            }
            return updated
        }
        template.updatedAt = Date()
        return template
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

    @discardableResult
    func installDefaultTeamPreset() -> UUID {
        var assignedIdsByRole: [OrgRole: String] = [:]
        let useAutomatedTestPreset = ProcessInfo.processInfo.environment["AGENT_REFINEMENT_AUTOMATED_TEST"] == "1"

        for seed in Self.defaultAgentSeeds {
            if let existing = agents.first(where: { $0.id == seed.id }) {
                assignedIdsByRole[seed.role] = existing.id
                continue
            }

            let provider: ProviderKind = useAutomatedTestPreset ? .customCli : seed.provider
            let commandTemplate = useAutomatedTestPreset ? automatedTestCommandTemplate(for: seed.role) : nil

            let agent = MasterAgent(
                id: seed.id,
                name: seed.name,
                orgRoles: [seed.role],
                mode: seed.mode,
                provider: provider,
                persona: seed.persona,
                skills: mergedRequiredSkills(into: []),
                dependsOn: seed.dependsOn,
                commandTemplate: commandTemplate
            )
            agents.append(agent)
            try? dataStore.saveAgent(agent)
            assignedIdsByRole[seed.role] = agent.id
        }

        if let existingTemplate = templates.first(where: { $0.isPreset && $0.name == Self.defaultTemplateName }) {
            return existingTemplate.id
        }

        // Default template is pre-wired so selecting it immediately yields a working team.
        let slots = Self.defaultAgentSeeds.map { seed in
            Slot(
                orgRole: seed.role,
                minCount: 1,
                maxCount: 1,
                required: true,
                assignedAgentIds: assignedIdsByRole[seed.role].map { [$0] } ?? []
            )
        }
        let template = OrganizationTemplate(
            name: Self.defaultTemplateName,
            isPreset: true,
            orchestrationMode: "role_based",
            workflowMode: useAutomatedTestPreset ? "writing" : "coding",
            rounds: 1,
            slots: slots
        )
        templates.insert(template, at: 0)
        try? dataStore.saveTemplate(template)
        return template.id
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
        // Reset per-run event stream so UI can render the current execution only.
        executionEvents = []

        let template = templateForSelectedProject()
        let executionAgents = agentsForExecution(using: template)

        let config = Orchestrator.RunConfig(
            agents: executionAgents,
            sourceText: requirements,
            objective: "",
            globalInstruction: "",
            workflowMode: template?.workflowMode ?? "coding",
            orchestrationMode: template?.orchestrationMode ?? "sequential",
            rounds: max(1, template?.rounds ?? 1),
            workingDirectory: selectedProject?.workingDirectory,
            installedSkills: (try? skillStore.loadInstalledSkills()) ?? []
        )

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            DispatchQueue.global().async {
                var capturedEvents: [[String: Any]] = []
                Orchestrator.run(config: config) { event in
                    var entry: [String: Any] = ["type": event.type]
                    for (key, value) in event.data {
                        entry[key] = value
                    }
                    capturedEvents.append(entry)
                }
                Task { @MainActor in
                    // Publish the whole run atomically to avoid missing trailing events.
                    self.executionEvents = capturedEvents
                    self.isExecuting = false
                    continuation.resume()
                }
            }
        }
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

    func consumeRequirementsDraft() -> String? {
        consumeDraft(&requirementsDraft)
    }

    func consumeChatDraft() -> String? {
        consumeDraft(&chatDraft)
    }

    func consumeTerminalDraft() -> String? {
        consumeDraft(&terminalDraft)
    }

    private func mergedRequiredSkills(into skills: [String]) -> [String] {
        var merged = skills
        for required in Self.requiredAgentSkills where !merged.contains(required) {
            merged.append(required)
        }
        return merged
    }

    private func automatedTestCommandTemplate(for role: OrgRole) -> String {
        let output: String
        switch role {
        case .ceo:
            output = "最高の晩餐について: 体験全体のテーマを決める。"
        case .manager:
            output = "最高の晩餐について: 進行と提供順を設計する。"
        case .worker:
            output = "最高の晩餐について: 料理の主軸と食材を提案する。"
        case .qa:
            output = "最高の晩餐について: 最終提案の品質を検証する。"
        default:
            output = "最高の晩餐について: 担当観点から提案を補強する。"
        }
        return "sh -lc \"echo '\(output)'\""
    }

    private func bootstrapDefaultsIfNeeded() {
        // Auto-bootstrap only on first run to avoid surprising existing users.
        guard agents.isEmpty, templates.isEmpty else { return }
        _ = installDefaultTeamPreset()
    }

    private func templateForSelectedProject() -> OrganizationTemplate? {
        guard
            let templateString = selectedProject?.templateId,
            let templateUUID = UUID(uuidString: templateString)
        else {
            return nil
        }
        return templates.first { $0.id == templateUUID }
    }

    func executionAgentsForSelectedProject() -> [MasterAgent] {
        agentsForExecution(using: templateForSelectedProject())
    }

    private func agentsForExecution(using template: OrganizationTemplate?) -> [MasterAgent] {
        guard let template else { return agents }

        let orderedIds = template.slots.flatMap(\.assignedAgentIds)
        guard !orderedIds.isEmpty else { return agents }

        var selected: [MasterAgent] = []
        var seen: Set<String> = []
        for id in orderedIds where seen.insert(id).inserted {
            if let agent = agents.first(where: { $0.id == id }) {
                selected.append(agent)
            }
        }
        return selected.isEmpty ? agents : selected
    }

    private func consumeDraft(_ draft: inout String) -> String? {
        // Shared submit rule for all composers: trim, reject blank, then clear.
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        draft = ""
        return trimmed
    }
}

private struct DefaultAgentSeed {
    let id: String
    let name: String
    let role: OrgRole
    let mode: AgentMode
    let provider: ProviderKind
    let dependsOn: [String]
    let persona: String
}
