import Foundation

final class SkillStore: Sendable {
    let baseDirectory: URL

    private var skillsDir: URL { baseDirectory.appendingPathComponent("skills") }
    private var libraryDir: URL { skillsDir.appendingPathComponent("library") }
    private var candidatesDir: URL { skillsDir.appendingPathComponent("candidates") }

    init(baseDirectory: URL? = nil) {
        if let baseDirectory {
            self.baseDirectory = baseDirectory
        } else {
            self.baseDirectory = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent(".agent-refinement")
        }
    }

    func loadInstalledSkills() throws -> [SkillDocument] {
        var skills: [SkillDocument] = []
        skills.append(contentsOf: try loadSkills(from: libraryDir, source: .user))
        return skills.sorted { $0.metadata.name.localizedCaseInsensitiveCompare($1.metadata.name) == .orderedAscending }
    }

    @discardableResult
    func installSkillMarkdown(_ markdown: String, source: SkillSource) throws -> SkillDocument {
        let parsed = try SkillDocument.parse(markdown: markdown, source: source, rootDirectory: nil)
        let versionDir = libraryDir
            .appendingPathComponent(parsed.metadata.id)
            .appendingPathComponent("versions")
            .appendingPathComponent(parsed.metadata.version)
        try ensureDirectory(versionDir)
        try markdown.write(to: versionDir.appendingPathComponent("SKILL.md"), atomically: true, encoding: .utf8)
        try writeIndex(for: parsed, source: source)
        return try SkillDocument.parse(markdown: markdown, source: source, rootDirectory: versionDir)
    }

    func loadCandidates() throws -> [CandidateBatch] {
        guard FileManager.default.fileExists(atPath: candidatesDir.path) else { return [] }
        let batchDirs = try FileManager.default.contentsOfDirectory(
            at: candidatesDir,
            includingPropertiesForKeys: [.isDirectoryKey]
        )
        var batches: [CandidateBatch] = []
        for batchDir in batchDirs {
            let skillDirs = (try? FileManager.default.contentsOfDirectory(
                at: batchDir,
                includingPropertiesForKeys: [.isDirectoryKey]
            )) ?? []
            var docs: [SkillDocument] = []
            for skillDir in skillDirs {
                let file = skillDir.appendingPathComponent("SKILL.md")
                guard FileManager.default.fileExists(atPath: file.path) else { continue }
                let markdown = try String(contentsOf: file, encoding: .utf8)
                docs.append(try SkillDocument.parse(markdown: markdown, source: .discovered, rootDirectory: skillDir))
            }
            if !docs.isEmpty {
                batches.append(CandidateBatch(
                    id: batchDir.lastPathComponent,
                    directory: batchDir,
                    skills: docs.sorted { $0.metadata.name.localizedCaseInsensitiveCompare($1.metadata.name) == .orderedAscending }
                ))
            }
        }
        return batches.sorted { $0.id < $1.id }
    }

    @discardableResult
    func approveCandidate(skillId: String, batchId: String, source: SkillSource = .user) throws -> SkillDocument {
        let candidatePath = candidatesDir
            .appendingPathComponent(batchId)
            .appendingPathComponent(skillId)
            .appendingPathComponent("SKILL.md")
        guard FileManager.default.fileExists(atPath: candidatePath.path) else {
            throw SkillStoreError.candidateNotFound(skillId: skillId, batchId: batchId)
        }
        let markdown = try String(contentsOf: candidatePath, encoding: .utf8)
        let installed = try installSkillMarkdown(markdown, source: source)
        try? FileManager.default.removeItem(at: candidatePath.deletingLastPathComponent())
        return installed
    }

    func removeSkill(id: String) throws {
        let dir = libraryDir.appendingPathComponent(id)
        if FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.removeItem(at: dir)
        }
    }

    func removeSkillVersion(id: String, version: String) throws {
        let versionDir = libraryDir
            .appendingPathComponent(id)
            .appendingPathComponent("versions")
            .appendingPathComponent(version)
        if FileManager.default.fileExists(atPath: versionDir.path) {
            try FileManager.default.removeItem(at: versionDir)
        }
        // Update index after deletion
        let remaining = (try? FileManager.default.contentsOfDirectory(
            at: libraryDir.appendingPathComponent(id).appendingPathComponent("versions"),
            includingPropertiesForKeys: nil
        )) ?? []
        let versionNames = remaining.map { $0.lastPathComponent }
        if versionNames.isEmpty {
            try removeSkill(id: id)
        } else if let latest = versionNames.sorted(by: >).first {
            try updateIndex(id: id, name: nil, source: nil, versions: versionNames, latest: latest)
        }
    }

    @discardableResult
    func importLocalDirectoryAsCandidates(_ sourceDirectory: URL) throws -> [SkillDocument] {
        let skillFiles = try findSkillFiles(in: sourceDirectory)
        let batchDir = candidatesDir.appendingPathComponent("local-\(Self.timestamp())")
        try ensureDirectory(batchDir)

        var candidates: [SkillDocument] = []
        for file in skillFiles {
            let markdown = try String(contentsOf: file, encoding: .utf8)
            let parsed = try SkillDocument.parse(
                markdown: markdown,
                source: .discovered,
                rootDirectory: file.deletingLastPathComponent()
            )
            let candidateDir = batchDir.appendingPathComponent(parsed.metadata.id)
            try ensureDirectory(candidateDir)
            try markdown.write(to: candidateDir.appendingPathComponent("SKILL.md"), atomically: true, encoding: .utf8)
            candidates.append(try SkillDocument.parse(markdown: markdown, source: .discovered, rootDirectory: candidateDir))
        }
        return candidates.sorted { $0.metadata.name.localizedCaseInsensitiveCompare($1.metadata.name) == .orderedAscending }
    }

    private func loadSkills(from directory: URL, source: SkillSource) throws -> [SkillDocument] {
        guard FileManager.default.fileExists(atPath: directory.path) else { return [] }
        let skillDirs = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.isDirectoryKey]
        )

        var result: [SkillDocument] = []
        for skillDir in skillDirs {
            let versionsDir = skillDir.appendingPathComponent("versions")
            guard FileManager.default.fileExists(atPath: versionsDir.path) else { continue }
            let versions = try FileManager.default.contentsOfDirectory(
                at: versionsDir,
                includingPropertiesForKeys: [.isDirectoryKey]
            )
            for versionDir in versions {
                let skillFile = versionDir.appendingPathComponent("SKILL.md")
                guard FileManager.default.fileExists(atPath: skillFile.path) else { continue }
                let markdown = try String(contentsOf: skillFile, encoding: .utf8)
                result.append(try SkillDocument.parse(markdown: markdown, source: source, rootDirectory: versionDir))
            }
        }
        return result
    }

    private func findSkillFiles(in directory: URL) throws -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }
        return enumerator.compactMap { item in
            guard let url = item as? URL, url.lastPathComponent == "SKILL.md" else { return nil }
            return url
        }
    }

    private func writeIndex(for skill: SkillDocument, source: SkillSource) throws {
        let indexURL = libraryDir.appendingPathComponent(skill.metadata.id).appendingPathComponent("index.json")
        try ensureDirectory(indexURL.deletingLastPathComponent())

        var versions: Set<String> = [skill.metadata.version]
        var existingName: String? = nil
        var existingSource: SkillSource? = nil
        if let data = try? Data(contentsOf: indexURL),
           let existing = try? JSONDecoder().decode(SkillLibraryIndex.self, from: data) {
            versions.formUnion(existing.installedVersions)
            existingName = existing.name
            existingSource = existing.source
        }
        let sortedVersions = versions.sorted(by: >)
        let index = SkillLibraryIndex(
            id: skill.metadata.id,
            name: existingName ?? skill.metadata.name,
            source: existingSource ?? source,
            installedVersions: sortedVersions,
            latestInstalledVersion: sortedVersions.first ?? skill.metadata.version
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(index).write(to: indexURL)
    }

    private func updateIndex(id: String, name: String?, source: SkillSource?, versions: [String], latest: String) throws {
        let indexURL = libraryDir.appendingPathComponent(id).appendingPathComponent("index.json")
        try ensureDirectory(indexURL.deletingLastPathComponent())
        var existingName = name ?? id
        var existingSource: SkillSource = source ?? .user
        if let data = try? Data(contentsOf: indexURL),
           let existing = try? JSONDecoder().decode(SkillLibraryIndex.self, from: data) {
            existingName = name ?? existing.name
            existingSource = source ?? existing.source
        }
        let index = SkillLibraryIndex(
            id: id,
            name: existingName,
            source: existingSource,
            installedVersions: versions.sorted(by: >),
            latestInstalledVersion: latest
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(index).write(to: indexURL)
    }

    private func ensureDirectory(_ directory: URL) throws {
        if !FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
    }

    private static func timestamp() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMddHHmmss"
        return formatter.string(from: Date())
    }
}

private struct SkillLibraryIndex: Codable {
    var id: String
    var name: String
    var source: SkillSource
    var installedVersions: [String]
    var latestInstalledVersion: String
}

struct CandidateBatch: Sendable, Equatable {
    let id: String
    let directory: URL
    let skills: [SkillDocument]
}

enum SkillStoreError: Error, LocalizedError {
    case candidateNotFound(skillId: String, batchId: String)

    var errorDescription: String? {
        switch self {
        case .candidateNotFound(let skillId, let batchId):
            "Candidate '\(skillId)' not found in batch '\(batchId)'"
        }
    }
}
