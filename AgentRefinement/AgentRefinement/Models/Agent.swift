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
