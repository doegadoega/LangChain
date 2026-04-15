import Testing
import Foundation
@testable import AgentRefinementApp

@Suite("PromptBuilder Tests")
struct PromptBuilderTests {

    @Test("System directive includes agent name and role")
    func systemDirective() {
        let agent = MasterAgent(id: "test", name: "TestAgent", orgRoles: [.worker], mode: .writer, provider: .claudeCli, persona: "テストペルソナ", skills: ["Swift", "テスト"])
        let directive = PromptBuilder.buildSystemDirective(agent: agent)
        #expect(directive.contains("TestAgent"))
        #expect(directive.contains("worker"))
        #expect(directive.contains("テストペルソナ"))
        #expect(directive.contains("Swift"))
    }

    @Test("Coding instruction includes role hint for CEO")
    func codingInstructionCeo() {
        let instruction = PromptBuilder.buildCodingInstruction(orgRole: .ceo, hasWorkingDir: true)
        #expect(instruction.contains("最終判断者"))
    }

    @Test("Writing instruction includes role hint for QA")
    func writingInstructionQa() {
        let instruction = PromptBuilder.buildWritingInstruction(orgRole: .qa)
        #expect(instruction.contains("検証観点"))
    }

    @Test("Truncate output clips long text")
    func truncateOutput() {
        let long = String(repeating: "a", count: 5000)
        let truncated = PromptBuilder.truncateOutput(long, maxChars: 100)
        #expect(truncated.count < 200)
        #expect(truncated.contains("truncated"))
    }

    @Test("Dependency context block lists dependencies")
    func dependencyContext() {
        let agent = MasterAgent(id: "editor", name: "Editor", orgRoles: [.worker], mode: .editor, provider: .claudeCli, dependsOn: ["writer"])
        let block = PromptBuilder.buildDependencyContextBlock(agent: agent, roundOutputs: ["writer": "draft text here"])
        #expect(block.contains("writer"))
        #expect(block.contains("draft text here"))
    }
}
