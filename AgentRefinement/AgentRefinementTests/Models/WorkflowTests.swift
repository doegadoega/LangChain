import Testing
import Foundation
@testable import AgentRefinement

@Suite("Workflow Model Tests")
struct WorkflowTests {
    @Test("Workflow node types")
    func nodeTypes() {
        let slotNode = WorkflowNode(
            type: .slot,
            position: Position(x: 100, y: 200),
            label: "Worker: Do",
            config: .slot(SlotConfig(slotRole: .worker, agentCount: 3))
        )
        #expect(slotNode.type == .slot)

        let gateNode = WorkflowNode(
            type: .gate,
            position: Position(x: 100, y: 300),
            label: "品質ゲート",
            config: .gate(GateConfig(
                judge: .auto,
                conditions: [
                    GateCondition(label: "PASS", targetNodeId: "ceo-act"),
                    GateCondition(label: "REWORK", targetNodeId: "worker-do"),
                ],
                loopMax: 3,
                onLoopExceeded: .escalate
            ))
        )
        #expect(gateNode.type == .gate)
    }

    @Test("Workflow edge connects nodes")
    func edgeConnectsNodes() {
        let edge = WorkflowEdge(
            sourceNodeId: "qa-check",
            targetNodeId: "gate-1"
        )
        #expect(edge.sourceNodeId == "qa-check")
    }

    @Test("Workflow round-trip JSON")
    func workflowRoundTrip() throws {
        let workflow = Workflow(
            name: "Simple Flow",
            nodes: [
                WorkflowNode(type: .start, position: Position(x: 0, y: 0), label: "開始"),
                WorkflowNode(type: .end, position: Position(x: 0, y: 100), label: "終了"),
            ],
            edges: [
                WorkflowEdge(sourceNodeId: "node-0", targetNodeId: "node-1"),
            ]
        )
        let data = try JSONEncoder().encode(workflow)
        let decoded = try JSONDecoder().decode(Workflow.self, from: data)
        #expect(decoded.name == "Simple Flow")
        #expect(decoded.nodes.count == 2)
    }
}
