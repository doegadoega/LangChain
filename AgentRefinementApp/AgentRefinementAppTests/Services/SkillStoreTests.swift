import Foundation
import Testing
@testable import AgentRefinementApp

@Suite("SkillStore Tests")
struct SkillStoreTests {
    @Test("Loads user skill from versioned library")
    func loadsUserSkillFromVersionedLibrary() throws {
        let baseDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("skillstore-test-\(UUID().uuidString)")
        let store = SkillStore(baseDirectory: baseDir)

        try store.installSkillMarkdown(
            """
            ---
            id: swiftui-implementation
            name: SwiftUI Implementation
            version: 1.2.0
            description: SwiftUI app patterns
            providers: [codex_cli, claude_cli]
            roles: [worker, qa]
            tags: [swift, swiftui]
            ---

            # SwiftUI Implementation

            Common guidance.

            ## Provider: codex_cli
            Codex guidance.

            ## Role: worker
            Worker guidance.
            """,
            source: .user
        )

        let skills = try store.loadInstalledSkills()

        #expect(skills.count == 1)
        #expect(skills[0].metadata.id == "swiftui-implementation")
        #expect(skills[0].metadata.version == "1.2.0")
        #expect(skills[0].metadata.providers.contains(.codexCli))
        #expect(skills[0].metadata.roles.contains(.worker))
        #expect(skills[0].source == .user)
        try FileManager.default.removeItem(at: baseDir)
    }

    @Test("Imports local directory into candidates without installing")
    func importsLocalDirectoryIntoCandidates() throws {
        let baseDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("skillstore-test-\(UUID().uuidString)")
        let externalDir = baseDir.appendingPathComponent("external")
        let externalSkillDir = externalDir.appendingPathComponent("api-design")
        try FileManager.default.createDirectory(at: externalSkillDir, withIntermediateDirectories: true)
        try """
            ---
            id: api-design
            name: API Design
            version: 1.0.0
            ---

            # API Design
            """.write(
                to: externalSkillDir.appendingPathComponent("SKILL.md"),
                atomically: true,
                encoding: .utf8
            )

        let store = SkillStore(baseDirectory: baseDir)
        let candidates = try store.importLocalDirectoryAsCandidates(externalDir)
        let installed = try store.loadInstalledSkills()

        #expect(candidates.map(\.metadata.id) == ["api-design"])
        #expect(installed.isEmpty)
        try FileManager.default.removeItem(at: baseDir)
    }

    @Test("Installs multiple versions and merges index")
    func installsMultipleVersions() throws {
        let baseDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("skillstore-test-\(UUID().uuidString)")
        let store = SkillStore(baseDirectory: baseDir)

        for version in ["1.0.0", "1.1.0"] {
            try store.installSkillMarkdown("""
                ---
                id: api-design
                name: API Design
                version: \(version)
                ---

                Body \(version)
                """, source: .user)
        }

        let skills = try store.loadInstalledSkills()
        let versions = Set(skills.map(\.metadata.version))
        #expect(versions == ["1.0.0", "1.1.0"])
        try FileManager.default.removeItem(at: baseDir)
    }

    @Test("Approves a candidate into library and removes candidate file")
    func approvesCandidate() throws {
        let baseDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("skillstore-test-\(UUID().uuidString)")
        let externalDir = baseDir.appendingPathComponent("external")
        let externalSkillDir = externalDir.appendingPathComponent("api-design")
        try FileManager.default.createDirectory(at: externalSkillDir, withIntermediateDirectories: true)
        try """
            ---
            id: api-design
            name: API Design
            version: 1.0.0
            ---

            # API Design
            """.write(to: externalSkillDir.appendingPathComponent("SKILL.md"), atomically: true, encoding: .utf8)

        let store = SkillStore(baseDirectory: baseDir)
        _ = try store.importLocalDirectoryAsCandidates(externalDir)
        let batches = try store.loadCandidates()
        #expect(batches.count == 1)
        let batchId = batches[0].id

        let approved = try store.approveCandidate(skillId: "api-design", batchId: batchId)
        #expect(approved.metadata.id == "api-design")

        let installed = try store.loadInstalledSkills()
        #expect(installed.map(\.metadata.id) == ["api-design"])

        let remainingBatches = try store.loadCandidates()
        #expect(remainingBatches.allSatisfy { batch in batch.skills.allSatisfy { $0.metadata.id != "api-design" } })

        try FileManager.default.removeItem(at: baseDir)
    }

    @Test("Removes a single version and updates index")
    func removesSingleVersion() throws {
        let baseDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("skillstore-test-\(UUID().uuidString)")
        let store = SkillStore(baseDirectory: baseDir)

        for version in ["1.0.0", "1.1.0"] {
            try store.installSkillMarkdown("""
                ---
                id: api-design
                name: API Design
                version: \(version)
                ---

                Body
                """, source: .user)
        }

        try store.removeSkillVersion(id: "api-design", version: "1.0.0")
        let installed = try store.loadInstalledSkills()
        #expect(installed.map(\.metadata.version) == ["1.1.0"])
        try FileManager.default.removeItem(at: baseDir)
    }

    @Test("Renders common provider and role sections")
    func rendersProviderAndRoleSections() throws {
        let skill = try SkillDocument.parse(
            markdown:
                """
                ---
                id: swiftui-implementation
                name: SwiftUI Implementation
                version: 1.0.0
                ---

                Common guidance.

                ## Provider: codex_cli
                Codex guidance.

                ## Provider: claude_cli
                Claude guidance.

                ## Role: worker
                Worker guidance.
                """,
            source: .user,
            rootDirectory: nil
        )
        let rendered = SkillPromptRenderer.render(
            skills: [skill],
            references: [
                SkillReference(id: "swiftui-implementation", source: .user, versionRequirement: .exact("1.0.0"))
            ],
            provider: .codexCli,
            role: .worker
        )

        #expect(rendered.contains("[SwiftUI Implementation]"))
        #expect(rendered.contains("Common guidance."))
        #expect(rendered.contains("Codex guidance."))
        #expect(!rendered.contains("Claude guidance."))
        #expect(rendered.contains("Worker guidance."))
    }
}
