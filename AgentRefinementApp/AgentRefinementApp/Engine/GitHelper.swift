import Foundation

enum GitHelper {

    static func canRunGit() -> Bool {
        runGit(["--version"], cwd: FileManager.default.homeDirectoryForCurrentUser.path, timeout: 5) != nil
    }

    static func isGitRepo(path: String) -> Bool {
        runGit(["rev-parse", "--git-dir"], cwd: path, timeout: 10) != nil
    }

    static func hasCommits(path: String) -> Bool {
        runGit(["rev-parse", "HEAD"], cwd: path, timeout: 10) != nil
    }

    static func captureGitDiff(workingDirectory: String) -> String {
        _ = runGit(["add", "-A"], cwd: workingDirectory, timeout: 30)
        return runGit(["diff", "--staged", "HEAD"], cwd: workingDirectory, timeout: 30) ?? ""
    }

    static func ensureWorkingDir(_ path: String) throws {
        try FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
        if !isGitRepo(path: path) {
            _ = runGit(["init"], cwd: path, timeout: 15)
        }
        if !hasCommits(path: path) {
            _ = runGit(["commit", "--allow-empty", "-m", "initial empty commit"], cwd: path, timeout: 15)
        }
    }

    private static func runGit(_ args: [String], cwd: String, timeout: Int) -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
        process.arguments = args
        process.currentDirectoryURL = URL(fileURLWithPath: cwd)

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()

        do { try process.run() } catch { return nil }

        let timer = DispatchSource.makeTimerSource()
        timer.schedule(deadline: .now() + .seconds(timeout))
        timer.setEventHandler { process.terminate() }
        timer.resume()

        process.waitUntilExit()
        timer.cancel()

        guard process.terminationStatus == 0 else { return nil }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
