import Foundation

struct Slot: Codable, Identifiable, Sendable {
    let id: UUID
    var orgRole: OrgRole
    var minCount: Int
    var maxCount: Int
    var required: Bool
    var assignedAgentIds: [String]

    init(
        id: UUID = UUID(),
        orgRole: OrgRole,
        minCount: Int = 1,
        maxCount: Int = 1,
        required: Bool = true,
        assignedAgentIds: [String] = []
    ) {
        self.id = id
        self.orgRole = orgRole
        self.minCount = minCount
        self.maxCount = maxCount
        self.required = required
        self.assignedAgentIds = assignedAgentIds
    }
}

struct OrganizationTemplate: Codable, Identifiable, Sendable {
    let id: UUID
    var name: String
    var isPreset: Bool
    var orchestrationMode: String
    var workflowMode: String
    var rounds: Int
    var slots: [Slot]
    let createdAt: Date
    var updatedAt: Date

    var requiredSlots: [Slot] {
        slots.filter(\.required)
    }

    init(
        id: UUID = UUID(),
        name: String,
        isPreset: Bool = false,
        orchestrationMode: String = "sequential",
        workflowMode: String = "coding",
        rounds: Int = 1,
        slots: [Slot] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.isPreset = isPreset
        self.orchestrationMode = orchestrationMode
        self.workflowMode = workflowMode
        self.rounds = rounds
        self.slots = slots
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
