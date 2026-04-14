import Foundation
import SwiftUI

@MainActor
final class SidecarManager: ObservableObject {
    @Published var isRunning = false
    @Published var port: Int = 8000
    @Published var error: String?

    private var process: Process?
    private let projectRoot: URL

    init(projectRoot: URL? = nil) {
        self.projectRoot = projectRoot ?? URL(fileURLWithPath: "/Users/sfidante-he/workspace/LangChain")
    }

    func start() {
        guard !isRunning else { return }
        error = nil

        let pythonPath = resolvePythonPath(projectRoot: projectRoot)
        let args = buildUvicornArgs(port: port)

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: pythonPath)
        proc.arguments = ["-m"] + args
        proc.currentDirectoryURL = projectRoot
        proc.environment = ProcessInfo.processInfo.environment

        let errorPipe = Pipe()
        proc.standardError = errorPipe

        proc.terminationHandler = { [weak self] process in
            Task { @MainActor in
                self?.isRunning = false
                if process.terminationStatus != 0 {
                    let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                    self?.error = String(data: errorData, encoding: .utf8)
                }
            }
        }

        do {
            try proc.run()
            process = proc
            isRunning = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    func stop() {
        process?.terminate()
        process = nil
        isRunning = false
    }

    nonisolated func buildUvicornArgs(port: Int) -> [String] {
        ["uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "\(port)"]
    }

    nonisolated func resolvePythonPath(projectRoot: URL) -> String {
        let venvPython = projectRoot.appendingPathComponent(".venv/bin/python3").path
        if FileManager.default.fileExists(atPath: venvPython) {
            return venvPython
        }
        return "/usr/bin/python3"
    }

    var baseURL: URL {
        URL(string: "http://127.0.0.1:\(port)")!
    }
}
