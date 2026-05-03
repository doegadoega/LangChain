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
    private enum CodingKeys: String, CodingKey {
        case id, name, orgRoles, mode, provider, model, persona
        case skills, skillRefs, dependsOn, commandTemplate
        case mcpEnabled, mcpConfigPath, mcpServers, mcpInstruction
        case mcpContextCommand, mcpTimeoutSec
        case modelDecision, createdAt, updatedAt
    }

    let id: String
    var name: String
    var orgRoles: [OrgRole]
    var mode: AgentMode
    var provider: ProviderKind
    var model: String?
    var persona: String?
    var skills: [String]
    var skillRefs: [SkillReference]
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
        skillRefs: [SkillReference] = [],
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
        self.skillRefs = skillRefs
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

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.name = try c.decode(String.self, forKey: .name)
        self.orgRoles = try c.decode([OrgRole].self, forKey: .orgRoles)
        self.mode = try c.decode(AgentMode.self, forKey: .mode)
        self.provider = try c.decode(ProviderKind.self, forKey: .provider)
        self.model = try c.decodeIfPresent(String.self, forKey: .model)
        self.persona = try c.decodeIfPresent(String.self, forKey: .persona)
        self.skills = try c.decodeIfPresent([String].self, forKey: .skills) ?? []
        self.skillRefs = try c.decodeIfPresent([SkillReference].self, forKey: .skillRefs) ?? []
        self.dependsOn = try c.decodeIfPresent([String].self, forKey: .dependsOn) ?? []
        self.commandTemplate = try c.decodeIfPresent(String.self, forKey: .commandTemplate)
        self.mcpEnabled = try c.decodeIfPresent(Bool.self, forKey: .mcpEnabled) ?? false
        self.mcpConfigPath = try c.decodeIfPresent(String.self, forKey: .mcpConfigPath)
        self.mcpServers = try c.decodeIfPresent([String].self, forKey: .mcpServers) ?? []
        self.mcpInstruction = try c.decodeIfPresent(String.self, forKey: .mcpInstruction)
        self.mcpContextCommand = try c.decodeIfPresent(String.self, forKey: .mcpContextCommand)
        self.mcpTimeoutSec = try c.decodeIfPresent(Int.self, forKey: .mcpTimeoutSec) ?? 60
        self.modelDecision = try c.decodeIfPresent(ModelDecision.self, forKey: .modelDecision) ?? .fixed
        self.createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
        self.updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt) ?? Date()
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
