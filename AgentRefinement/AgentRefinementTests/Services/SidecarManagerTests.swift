import Testing
import Foundation
@testable import AgentRefinement

@Suite("SidecarManager Tests")
struct SidecarManagerTests {

    @Test("Constructs correct uvicorn command")
    @MainActor
    func uvicornCommand() {
        let manager = SidecarManager()
        let args = manager.buildUvicornArgs(port: 8001)
        #expect(args.contains("uvicorn"))
        #expect(args.contains("app.main:app"))
        #expect(args.contains("--port"))
        #expect(args.contains("8001"))
    }

    @Test("Finds python in project venv")
    @MainActor
    func findsPythonInVenv() {
        let manager = SidecarManager()
        let projectRoot = URL(fileURLWithPath: "/Users/sfidante-he/workspace/LangChain")
        let pythonPath = manager.resolvePythonPath(projectRoot: projectRoot)
        #expect(pythonPath.hasSuffix("python3") || pythonPath.hasSuffix("python"))
    }
}
