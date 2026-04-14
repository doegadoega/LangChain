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

struct StreamEvent: @unchecked Sendable {
    let type: String
    let data: [String: Any]

    init(from json: [String: Any]) {
        self.type = json["type"] as? String ?? "unknown"
        self.data = json
    }
}
