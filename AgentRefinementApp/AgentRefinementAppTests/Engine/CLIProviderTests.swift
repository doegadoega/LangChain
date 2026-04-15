import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("CLIProvider Tests")
struct CLIProviderTests {

    @Test("Build args replaces prompt placeholder")
    func buildArgsReplacesPrompt() {
        let provider = CLIProvider(commandTemplate: "echo {prompt}", timeoutSec: 30)
        let args = provider.buildArgs(prompt: "hello world", model: nil, mcpConfigPath: nil, mcpServers: nil)
        #expect(args == ["echo", "hello world"])
    }

    @Test("Build args appends prompt when no placeholder")
    func buildArgsAppendsPrompt() {
        let provider = CLIProvider(commandTemplate: "echo", timeoutSec: 30)
        let args = provider.buildArgs(prompt: "hello", model: nil, mcpConfigPath: nil, mcpServers: nil)
        #expect(args == ["echo", "hello"])
    }

    @Test("Build args replaces model placeholder")
    func buildArgsReplacesModel() {
        let provider = CLIProvider(commandTemplate: "cli --model {model} {prompt}", timeoutSec: 30)
        let args = provider.buildArgs(prompt: "test", model: "gpt-4", mcpConfigPath: nil, mcpServers: nil)
        #expect(args.contains("gpt-4"))
        #expect(args.contains("test"))
    }

    @Test("Build args replaces MCP servers CSV")
    func buildArgsMcpServers() {
        let provider = CLIProvider(commandTemplate: "cli --servers {mcp_servers_csv} {prompt}", timeoutSec: 30)
        let args = provider.buildArgs(prompt: "x", model: nil, mcpConfigPath: nil, mcpServers: ["a", "b"])
        #expect(args.contains("a,b"))
    }

    @Test("Resolve provider returns correct template for gemini")
    func resolveGemini() throws {
        let provider = try CLIProvider.resolve(providerKind: .geminiCli, commandTemplate: nil, codingMode: false)
        #expect(provider.commandTemplate.contains("gemini"))
    }

    @Test("Resolve provider requires template for custom")
    func resolveCustomRequiresTemplate() {
        #expect(throws: CLIProviderError.self) {
            try CLIProvider.resolve(providerKind: .customCli, commandTemplate: nil, codingMode: false)
        }
    }

    @Test("Generate runs echo command")
    func generateRunsEcho() throws {
        let provider = CLIProvider(commandTemplate: "echo {prompt}", timeoutSec: 10)
        let result = try provider.generate(prompt: "hello", model: nil, cwd: nil, mcpConfigPath: nil, mcpServers: nil)
        #expect(result == "hello")
    }
}
