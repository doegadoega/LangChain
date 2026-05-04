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

    @Test("System directive explicitly tells the model to follow persona")
    func systemDirectiveEnforcesPersonaBehavior() {
        let agent = MasterAgent(
            id: "mako",
            name: "まこ",
            orgRoles: [.worker],
            mode: .writer,
            provider: .claudeCli,
            persona: "短く明確に答える。"
        )

        let directive = PromptBuilder.buildSystemDirective(agent: agent)

        #expect(directive.contains("人格・振る舞い指示"))
        #expect(directive.contains("以下のペルソナを会話全体で維持してください。"))
        #expect(directive.contains("短く明確に答える。"))
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

    @Test("System directive injects rendered skills block when references resolve")
    func systemDirectiveIncludesResolvedSkill() throws {
        let skill = try SkillDocument.parse(
            markdown: """
                ---
                id: swiftui-implementation
                name: SwiftUI Implementation
                version: 1.0.0
                ---

                Common SwiftUI guidance.

                ## Provider: codex_cli
                Codex specifics.
                """,
            source: .user,
            rootDirectory: nil
        )
        let agent = MasterAgent(
            id: "a", name: "A", orgRoles: [.worker], mode: .writer, provider: .codexCli,
            skillRefs: [
                SkillReference(id: "swiftui-implementation", source: .user, versionRequirement: .latest)
            ]
        )
        let directive = PromptBuilder.buildSystemDirective(agent: agent, installedSkills: [skill])
        #expect(directive.contains("インストール済みスキル"))
        #expect(directive.contains("[SwiftUI Implementation]"))
        #expect(directive.contains("Codex specifics."))
    }

    @Test("System directive omits skills section when no references match")
    func systemDirectiveOmitsSkillsBlock() {
        let agent = MasterAgent(id: "a", name: "A", orgRoles: [.worker], mode: .writer, provider: .codexCli)
        let directive = PromptBuilder.buildSystemDirective(agent: agent, installedSkills: [])
        #expect(!directive.contains("インストール済みスキル"))
    }

    @Test("Dependency context block lists dependencies")
    func dependencyContext() {
        let agent = MasterAgent(id: "editor", name: "Editor", orgRoles: [.worker], mode: .editor, provider: .claudeCli, dependsOn: ["writer"])
        let block = PromptBuilder.buildDependencyContextBlock(agent: agent, roundOutputs: ["writer": "draft text here"])
        #expect(block.contains("writer"))
        #expect(block.contains("draft text here"))
    }
}
