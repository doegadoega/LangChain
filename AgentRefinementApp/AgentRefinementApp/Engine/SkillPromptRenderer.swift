import Foundation

enum SkillPromptRenderer {
    static func render(
        skills: [SkillDocument],
        references: [SkillReference],
        provider: ProviderKind,
        role: OrgRole
    ) -> String {
        let enabledReferences = references.filter(\.enabled)
        guard !enabledReferences.isEmpty else { return "" }

        let rendered = enabledReferences.compactMap { reference -> String? in
            guard let skill = resolveSkill(skills: skills, reference: reference) else { return nil }
            let sections = sectionsForPrompt(body: skill.body, provider: provider, role: role)
            guard !sections.isEmpty else { return nil }
            return """
                [\(skill.metadata.name)]
                \(sections.joined(separator: "\n\n"))
                """
        }
        return rendered.joined(separator: "\n\n")
    }

    private static func resolveSkill(skills: [SkillDocument], reference: SkillReference) -> SkillDocument? {
        let candidates = skills.filter { $0.metadata.id == reference.id && $0.source == reference.source }
        switch reference.versionRequirement {
        case .exact(let version):
            return candidates.first { $0.metadata.version == version }
        case .latestCompatible, .latest:
            return candidates.sorted { $0.metadata.version > $1.metadata.version }.first
        }
    }

    private static func sectionsForPrompt(body: String, provider: ProviderKind, role: OrgRole) -> [String] {
        let parsed = parseSections(body)
        var result: [String] = []
        let common = parsed.common.trimmingCharacters(in: .whitespacesAndNewlines)
        if !common.isEmpty { result.append(common) }

        let providerKey = "provider: \(provider.rawValue)"
        if let providerSection = parsed.sections[providerKey]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !providerSection.isEmpty {
            result.append("Provider \(provider.rawValue):\n\(providerSection)")
        }

        let roleKey = "role: \(role.rawValue)"
        if let roleSection = parsed.sections[roleKey]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !roleSection.isEmpty {
            result.append("Role \(role.rawValue):\n\(roleSection)")
        }
        return result
    }

    private static func parseSections(_ body: String) -> (common: String, sections: [String: String]) {
        var commonLines: [String] = []
        var sections: [String: [String]] = [:]
        var currentKey: String?

        for line in body.replacingOccurrences(of: "\r\n", with: "\n").split(separator: "\n", omittingEmptySubsequences: false).map(String.init) {
            if line.hasPrefix("## ") {
                let heading = String(line.dropFirst(3)).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if heading.hasPrefix("provider: ") || heading.hasPrefix("role: ") {
                    currentKey = heading
                    sections[currentKey!, default: []] = []
                    continue
                }
            }

            if let currentKey {
                sections[currentKey, default: []].append(line)
            } else {
                commonLines.append(line)
            }
        }

        return (
            commonLines.joined(separator: "\n"),
            sections.mapValues { $0.joined(separator: "\n") }
        )
    }
}
