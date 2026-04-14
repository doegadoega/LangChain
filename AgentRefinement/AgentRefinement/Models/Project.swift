import Foundation

enum ProjectStatus: String, Codable, Sendable {
    case active
    case completed
    case archived
}

struct Project: Codable, Identifiable, Sendable {
    let id: UUID
    var name: String
    var status: ProjectStatus
    var workingDirectory: String
    var templateId: String?
    var workflowId: String?
    var requirements: String?
    var agentSnapshots: [AgentSnapshot]
    let createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        workingDirectory: String,
        status: ProjectStatus = .active,
        templateId: String? = nil,
        workflowId: String? = nil,
        requirements: String? = nil,
        agentSnapshots: [AgentSnapshot] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.workingDirectory = workingDirectory
        self.status = status
        self.templateId = templateId
        self.workflowId = workflowId
        self.requirements = requirements
        self.agentSnapshots = agentSnapshots
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
