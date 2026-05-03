import Foundation
import Testing
@testable import AgentRefinementApp

@Suite("MasterAgent Codable backward compat")
struct MasterAgentCodableTests {

    @Test("Decodes legacy JSON without skillRefs and uses empty default")
    func decodesLegacyJsonWithoutSkillRefs() throws {
        let legacy = """
            {
              "id": "agent-1",
              "name": "Legacy",
              "orgRoles": ["worker"],
              "mode": "writer",
              "provider": "claude_cli",
              "skills": ["a", "b"],
              "dependsOn": [],
              "mcpEnabled": false,
              "mcpServers": [],
              "mcpTimeoutSec": 60,
              "modelDecision": "fixed",
              "createdAt": "2026-01-01T00:00:00Z",
              "updatedAt": "2026-01-01T00:00:00Z"
            }
            """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let agent = try decoder.decode(MasterAgent.self, from: legacy)

        #expect(agent.id == "agent-1")
        #expect(agent.skills == ["a", "b"])
        #expect(agent.skillRefs.isEmpty)
    }

    @Test("Round-trips skillRefs through encode/decode")
    func roundTripsSkillRefs() throws {
        let agent = MasterAgent(
            id: "x",
            name: "X",
            orgRoles: [.worker],
            mode: .writer,
            provider: .codexCli,
            skillRefs: [
                SkillReference(id: "swiftui-implementation", source: .user, versionRequirement: .exact("1.2.0"))
            ]
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(agent)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(MasterAgent.self, from: data)
        #expect(decoded.skillRefs == agent.skillRefs)
    }
}
