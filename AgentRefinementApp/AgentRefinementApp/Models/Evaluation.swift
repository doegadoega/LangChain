import Foundation

struct Evaluation: Codable, Identifiable, Sendable {
    let id: UUID
    let evaluatorRole: EvaluatorRole
    let score: Int
    let comment: String?
    let roundNumber: Int?
    let isFinal: Bool
    let createdAt: Date

    init(
        id: UUID = UUID(),
        evaluatorRole: EvaluatorRole,
        score: Int,
        comment: String? = nil,
        roundNumber: Int? = nil,
        isFinal: Bool = false,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.evaluatorRole = evaluatorRole
        self.score = min(max(score, 1), 10)
        self.comment = comment
        self.roundNumber = roundNumber
        self.isFinal = isFinal
        self.createdAt = createdAt
    }
}

enum EvaluatorRole: String, Codable, Sendable {
    case ceo
    case manager
    case pmo
}
