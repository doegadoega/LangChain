import Foundation

struct Position: Codable, Sendable {
    var x: Double
    var y: Double
}

enum NodeType: String, Codable, Sendable {
    case start
    case end
    case slot
    case gate
    case loop
    case fork
    case join
}

enum JudgeType: String, Codable, Sendable {
    case auto
    case agent
    case ceo
}

enum OnLoopExceeded: String, Codable, Sendable {
    case escalate
    case forcePass = "force_pass"
    case abort
}

struct GateCondition: Codable, Sendable {
    let label: String
    let targetNodeId: String
}

struct SlotConfig: Codable, Sendable {
    var slotRole: OrgRole
    var agentCount: Int
    var consensusRule: String?
    var timeoutSec: Int?
}

struct GateConfig: Codable, Sendable {
    var judge: JudgeType
    var conditions: [GateCondition]
    var loopMax: Int
    var onLoopExceeded: OnLoopExceeded
}

struct LoopConfig: Codable, Sendable {
    var targetStartNodeId: String
    var targetEndNodeId: String
    var maxIterations: Int
}

struct ForkConfig: Codable, Sendable {
    var forkType: String
}

enum NodeConfig: Codable, Sendable {
    case slot(SlotConfig)
    case gate(GateConfig)
    case loop(LoopConfig)
    case fork(ForkConfig)
    case none

    enum CodingKeys: String, CodingKey {
        case type, data
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .slot(let config):
            try container.encode("slot", forKey: .type)
            try container.encode(config, forKey: .data)
        case .gate(let config):
            try container.encode("gate", forKey: .type)
            try container.encode(config, forKey: .data)
        case .loop(let config):
            try container.encode("loop", forKey: .type)
            try container.encode(config, forKey: .data)
        case .fork(let config):
            try container.encode("fork", forKey: .type)
            try container.encode(config, forKey: .data)
        case .none:
            try container.encode("none", forKey: .type)
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "slot": self = .slot(try container.decode(SlotConfig.self, forKey: .data))
        case "gate": self = .gate(try container.decode(GateConfig.self, forKey: .data))
        case "loop": self = .loop(try container.decode(LoopConfig.self, forKey: .data))
        case "fork": self = .fork(try container.decode(ForkConfig.self, forKey: .data))
        default: self = .none
        }
    }
}

struct WorkflowNode: Codable, Identifiable, Sendable {
    let id: UUID
    var type: NodeType
    var position: Position
    var label: String
    var config: NodeConfig

    init(
        id: UUID = UUID(),
        type: NodeType,
        position: Position,
        label: String,
        config: NodeConfig = .none
    ) {
        self.id = id
        self.type = type
        self.position = position
        self.label = label
        self.config = config
    }
}

struct WorkflowEdge: Codable, Identifiable, Sendable {
    let id: UUID
    var sourceNodeId: String
    var targetNodeId: String
    var conditionLabel: String?

    init(
        id: UUID = UUID(),
        sourceNodeId: String,
        targetNodeId: String,
        conditionLabel: String? = nil
    ) {
        self.id = id
        self.sourceNodeId = sourceNodeId
        self.targetNodeId = targetNodeId
        self.conditionLabel = conditionLabel
    }
}

struct Workflow: Codable, Identifiable, Sendable {
    let id: UUID
    var name: String
    var isPreset: Bool
    var nodes: [WorkflowNode]
    var edges: [WorkflowEdge]
    let createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        isPreset: Bool = false,
        nodes: [WorkflowNode] = [],
        edges: [WorkflowEdge] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.isPreset = isPreset
        self.nodes = nodes
        self.edges = edges
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}
