import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("Orchestrator Tests")
struct OrchestratorTests {

    @Test("Sequential batches returns one agent per batch")
    func sequentialBatches() {
        let agents = [
            MasterAgent(id: "a1", name: "A1", orgRoles: [.worker], mode: .writer, provider: .claudeCli),
            MasterAgent(id: "a2", name: "A2", orgRoles: [.qa], mode: .reviewer, provider: .claudeCli),
        ]
        let batches = Orchestrator.executionBatches(agents: agents, mode: "sequential")
        #expect(batches.count == 2)
        #expect(batches[0].count == 1)
        #expect(batches[1].count == 1)
    }

    @Test("Role-based batches groups by org role")
    func roleBased() {
        let agents = [
            MasterAgent(id: "w1", name: "W1", orgRoles: [.worker], mode: .writer, provider: .claudeCli),
            MasterAgent(id: "w2", name: "W2", orgRoles: [.worker], mode: .writer, provider: .geminiCli),
            MasterAgent(id: "q1", name: "Q1", orgRoles: [.qa], mode: .reviewer, provider: .claudeCli),
        ]
        let batches = Orchestrator.executionBatches(agents: agents, mode: "role_based")
        #expect(batches.count == 2)
    }

    @Test("Dependency graph topological sort")
    func dependencyGraph() {
        let agents = [
            MasterAgent(id: "a", name: "A", orgRoles: [.worker], mode: .writer, provider: .claudeCli),
            MasterAgent(id: "b", name: "B", orgRoles: [.qa], mode: .reviewer, provider: .claudeCli, dependsOn: ["a"]),
            MasterAgent(id: "c", name: "C", orgRoles: [.worker], mode: .editor, provider: .claudeCli, dependsOn: ["a", "b"]),
        ]
        let batches = Orchestrator.executionBatches(agents: agents, mode: "dependency_graph")
        #expect(batches.count == 3)
        #expect(batches[0][0].id == "a")
        #expect(batches[1][0].id == "b")
        #expect(batches[2][0].id == "c")
    }

    @Test("Cycle detection returns empty")
    func cycleDetection() {
        let agents = [
            MasterAgent(id: "x", name: "X", orgRoles: [.worker], mode: .writer, provider: .claudeCli, dependsOn: ["y"]),
            MasterAgent(id: "y", name: "Y", orgRoles: [.worker], mode: .writer, provider: .claudeCli, dependsOn: ["x"]),
        ]
        let batches = Orchestrator.executionBatches(agents: agents, mode: "dependency_graph")
        #expect(batches.isEmpty)
    }
}
