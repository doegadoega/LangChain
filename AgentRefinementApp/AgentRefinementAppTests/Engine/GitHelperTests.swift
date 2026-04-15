import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("GitHelper Tests")
struct GitHelperTests {

    @Test("isGitRepo returns false for non-repo")
    func isGitRepoFalse() {
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).path
        try? FileManager.default.createDirectory(atPath: tmp, withIntermediateDirectories: true)
        #expect(GitHelper.isGitRepo(path: tmp) == false)
        try? FileManager.default.removeItem(atPath: tmp)
    }

    @Test("ensureWorkingDir creates directory and git repo")
    func ensureWorkingDir() throws {
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).path
        try GitHelper.ensureWorkingDir(tmp)
        #expect(GitHelper.isGitRepo(path: tmp))
        try FileManager.default.removeItem(atPath: tmp)
    }
}
