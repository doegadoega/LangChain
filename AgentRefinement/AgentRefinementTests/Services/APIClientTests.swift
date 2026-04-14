import Testing
import Foundation
@testable import AgentRefinement

@Suite("APIClient Tests")
struct APIClientTests {

    @Test("Builds correct refine URL")
    func refineURL() {
        let client = APIClient(baseURL: URL(string: "http://localhost:8000")!)
        let url = client.refineStreamURL
        #expect(url.absoluteString == "http://localhost:8000/api/refine/stream")
    }

    @Test("RefineRequestDTO encodes correctly")
    func encodeRequest() throws {
        let dto = RefineRequestDTO(
            workflowMode: "coding",
            orchestrationMode: "sequential",
            sourceText: "テスト",
            objective: "テスト目的",
            rounds: 2,
            agents: [
                AgentDTO(
                    id: "worker-1",
                    name: "Worker",
                    orgRole: "worker",
                    provider: "claude_cli"
                )
            ]
        )
        let data = try JSONEncoder().encode(dto)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        #expect(json?["workflow_mode"] as? String == "coding")
        #expect(json?["rounds"] as? Int == 2)
    }
}
