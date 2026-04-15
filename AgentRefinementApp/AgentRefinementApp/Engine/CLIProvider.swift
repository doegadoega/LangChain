import Foundation

enum CLIProviderError: Error, LocalizedError {
    case commandNotFound(String)
    case timeout(Int)
    case nonZeroExit(Int, String)
    case emptyOutput
    case unsupportedProvider(String)
    case customRequiresTemplate

    var errorDescription: String? {
        switch self {
        case .commandNotFound(let cmd): "command not found: \(cmd)"
        case .timeout(let sec): "command timed out after \(sec)s"
        case .nonZeroExit(let code, let detail): "CLI exited with code \(code): \(detail)"
        case .emptyOutput: "CLI returned empty output"
        case .unsupportedProvider(let p): "unsupported provider: \(p)"
        case .customRequiresTemplate: "custom_cli requires command_template"
        }
    }
}

struct CLIProvider: Sendable {
    let commandTemplate: String
    let timeoutSec: Int

    init(commandTemplate: String, timeoutSec: Int = 300) {
        self.commandTemplate = commandTemplate
        self.timeoutSec = timeoutSec
    }

    func buildArgs(
        prompt: String,
        model: String?,
        mcpConfigPath: String?,
        mcpServers: [String]?
    ) -> [String] {
        let servers = mcpServers ?? []
        let replacements: [(String, String)] = [
            ("{prompt}", prompt),
            ("{query}", prompt),
            ("{model}", model ?? ""),
            ("{mcp_config_path}", mcpConfigPath ?? ""),
            ("{mcp_servers_csv}", servers.joined(separator: ",")),
            ("{mcp_servers_json}", String(data: (try? JSONSerialization.data(withJSONObject: servers)) ?? Data("[]".utf8), encoding: .utf8) ?? "[]"),
        ]

        let tokens = shellSplit(commandTemplate)
        var built: [String] = []

        for token in tokens {
            var replaced = token
            for (key, value) in replacements {
                replaced = replaced.replacingOccurrences(of: key, with: value)
            }
            built.append(replaced)
        }

        let hasPromptPlaceholder = tokens.contains { $0.contains("{prompt}") || $0.contains("{query}") }
        if !hasPromptPlaceholder {
            built.append(prompt)
        }

        return built.filter { !$0.isEmpty }
    }

    func generate(
        prompt: String,
        model: String?,
        cwd: String?,
        mcpConfigPath: String?,
        mcpServers: [String]?
    ) throws -> String {
        let args = buildArgs(prompt: prompt, model: model, mcpConfigPath: mcpConfigPath, mcpServers: mcpServers)
        guard !args.isEmpty else { throw CLIProviderError.emptyOutput }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = args
        if let cwd { process.currentDirectoryURL = URL(fileURLWithPath: cwd) }
        process.environment = ProcessInfo.processInfo.environment

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        do {
            try process.run()
        } catch {
            throw CLIProviderError.commandNotFound(args.first ?? "")
        }

        let timer = DispatchSource.makeTimerSource()
        timer.schedule(deadline: .now() + .seconds(timeoutSec))
        timer.setEventHandler { process.terminate() }
        timer.resume()

        process.waitUntilExit()
        timer.cancel()

        let stdout = String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if process.terminationStatus != 0 {
            let detail = stderr.isEmpty ? (stdout.isEmpty ? "unknown CLI error" : stdout) : stderr
            throw CLIProviderError.nonZeroExit(Int(process.terminationStatus), detail)
        }

        if !stdout.isEmpty { return stdout }
        if !stderr.isEmpty { return stderr }
        throw CLIProviderError.emptyOutput
    }

    static let defaultCommands: [ProviderKind: String] = [
        .geminiCli: "gemini -p {prompt}",
        .claudeCli: "claude --print --output-format text {prompt}",
        .codexCli: "codex exec -c model_reasoning_effort=high --skip-git-repo-check --sandbox read-only {prompt}",
    ]

    static let codingCommands: [ProviderKind: String] = [
        .codexCli: "codex exec -c model_reasoning_effort=high --full-auto {prompt}",
        .claudeCli: "claude --print --output-format text {prompt}",
        .geminiCli: "gemini -p {prompt}",
    ]

    static func resolve(
        providerKind: ProviderKind,
        commandTemplate: String?,
        codingMode: Bool = false
    ) throws -> CLIProvider {
        if providerKind == .customCli {
            guard let template = commandTemplate, !template.isEmpty else {
                throw CLIProviderError.customRequiresTemplate
            }
            return CLIProvider(commandTemplate: template)
        }

        let template: String
        if codingMode {
            template = commandTemplate ?? codingCommands[providerKind] ?? defaultCommands[providerKind] ?? ""
        } else {
            template = commandTemplate ?? defaultCommands[providerKind] ?? ""
        }

        guard !template.isEmpty else {
            throw CLIProviderError.unsupportedProvider(providerKind.rawValue)
        }

        return CLIProvider(commandTemplate: template)
    }

    private func shellSplit(_ command: String) -> [String] {
        var tokens: [String] = []
        var current = ""
        var inSingleQuote = false
        var inDoubleQuote = false

        for char in command {
            if char == "'" && !inDoubleQuote {
                inSingleQuote.toggle()
            } else if char == "\"" && !inSingleQuote {
                inDoubleQuote.toggle()
            } else if char == " " && !inSingleQuote && !inDoubleQuote {
                if !current.isEmpty {
                    tokens.append(current)
                    current = ""
                }
            } else {
                current.append(char)
            }
        }
        if !current.isEmpty { tokens.append(current) }
        return tokens
    }
}
