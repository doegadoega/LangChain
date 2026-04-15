import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("Agent Model Tests")
struct AgentTests {

    @Test("MasterAgent has multiple org roles")
    func masterAgentMultipleRoles() {
        let agent = MasterAgent(
            id: "director",
            name: "Director",
            orgRoles: [.ceo, .manager],
            mode: .writer,
            provider: .claudeCli
        )
        #expect(agent.orgRoles.count == 2)
        #expect(agent.orgRoles.contains(.ceo))
        #expect(agent.orgRoles.contains(.manager))
    }

    @Test("MasterAgent primary role is first role")
    func primaryRole() {
        let agent = MasterAgent(
            id: "arch",
            name: "Architect",
            orgRoles: [.systemDesigner, .worker],
            mode: .writer,
            provider: .geminiCli
        )
        #expect(agent.primaryRole == .systemDesigner)
    }

    @Test("MasterAgent encodes and decodes to JSON")
    func roundTripJSON() throws {
        let agent = MasterAgent(
            id: "test",
            name: "Test Agent",
            orgRoles: [.worker],
            mode: .writer,
            provider: .claudeCli,
            model: "claude-sonnet-4-6",
            persona: "テストエージェント",
            skills: ["コーディング", "テスト"]
        )
        let data = try JSONEncoder().encode(agent)
        let decoded = try JSONDecoder().decode(MasterAgent.self, from: data)
        #expect(decoded.id == agent.id)
        #expect(decoded.orgRoles == agent.orgRoles)
        #expect(decoded.skills == agent.skills)
    }

    @Test("AgentSnapshot preserves config at creation time")
    func snapshotPreservesConfig() {
        let agent = MasterAgent(
            id: "dev",
            name: "Developer",
            orgRoles: [.worker],
            mode: .writer,
            provider: .geminiCli,
            persona: "Original persona"
        )
        let snapshot = AgentSnapshot(masterAgentId: agent.id, config: agent, projectId: "proj-1")
        #expect(snapshot.config.persona == "Original persona")
        #expect(snapshot.masterAgentId == "dev")
        #expect(snapshot.projectId == "proj-1")
    }

    @Test("Evaluation has score 1-10 range")
    func evaluationScoreRange() {
        let eval = Evaluation(
            evaluatorRole: .ceo,
            score: 8,
            comment: "Good work",
            roundNumber: 1,
            isFinal: false
        )
        #expect(eval.score == 8)
        #expect(eval.evaluatorRole == .ceo)
    }
}
