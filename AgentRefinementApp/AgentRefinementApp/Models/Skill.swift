import Foundation

enum SkillSource: String, Codable, CaseIterable, Sendable {
    case bundled
    case user
    case imported
    case discovered
}

enum SkillVersionRequirement: Codable, Sendable, Equatable {
    case exact(String)
    case latestCompatible
    case latest

    private enum CodingKeys: String, CodingKey {
        case kind
        case version
    }

    private enum Kind: String, Codable {
        case exact
        case latestCompatible
        case latest
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decode(Kind.self, forKey: .kind)
        switch kind {
        case .exact:
            self = .exact(try container.decode(String.self, forKey: .version))
        case .latestCompatible:
            self = .latestCompatible
        case .latest:
            self = .latest
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .exact(let version):
            try container.encode(Kind.exact, forKey: .kind)
            try container.encode(version, forKey: .version)
        case .latestCompatible:
            try container.encode(Kind.latestCompatible, forKey: .kind)
        case .latest:
            try container.encode(Kind.latest, forKey: .kind)
        }
    }
}

struct SkillReference: Codable, Identifiable, Sendable, Equatable {
    var id: String
    var source: SkillSource
    var versionRequirement: SkillVersionRequirement
    var enabled: Bool

    init(
        id: String,
        source: SkillSource,
        versionRequirement: SkillVersionRequirement = .latest,
        enabled: Bool = true
    ) {
        self.id = id
        self.source = source
        self.versionRequirement = versionRequirement
        self.enabled = enabled
    }
}

struct SkillMetadata: Codable, Identifiable, Sendable, Equatable {
    var id: String
    var name: String
    var version: String
    var description: String
    var providers: [ProviderKind]
    var roles: [OrgRole]
    var tags: [String]
}

struct SkillDocument: Identifiable, Sendable, Equatable {
    var id: String { metadata.id }
    var metadata: SkillMetadata
    var source: SkillSource
    var markdown: String
    var body: String
    var rootDirectory: URL?

    static func parse(
        markdown: String,
        source: SkillSource,
        rootDirectory: URL?
    ) throws -> SkillDocument {
        let parsed = try SkillMarkdownParser.parse(markdown)
        let id = parsed.frontMatter["id"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !id.isEmpty else { throw SkillParseError.missingRequiredField("id") }
        let name = parsed.frontMatter["name"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? id
        let version = parsed.frontMatter["version"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "0.0.0"
        let description = parsed.frontMatter["description"]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        return SkillDocument(
            metadata: SkillMetadata(
                id: id,
                name: name,
                version: version,
                description: description,
                providers: parsed.providerValues,
                roles: parsed.roleValues,
                tags: parsed.arrayValue(for: "tags")
            ),
            source: source,
            markdown: markdown,
            body: parsed.body,
            rootDirectory: rootDirectory
        )
    }
}

enum SkillParseError: Error, LocalizedError {
    case missingRequiredField(String)

    var errorDescription: String? {
        switch self {
        case .missingRequiredField(let field): "Skill.md is missing required field: \(field)"
        }
    }
}

private struct ParsedSkillMarkdown {
    var frontMatter: [String: String]
    var body: String

    func arrayValue(for key: String) -> [String] {
        guard let raw = frontMatter[key] else { return [] }
        return SkillMarkdownParser.parseArray(raw)
    }

    var providerValues: [ProviderKind] {
        arrayValue(for: "providers").compactMap(ProviderKind.init(rawValue:))
    }

    var roleValues: [OrgRole] {
        arrayValue(for: "roles").compactMap(OrgRole.init(rawValue:))
    }
}

private enum SkillMarkdownParser {
    static func parse(_ markdown: String) throws -> ParsedSkillMarkdown {
        let normalized = markdown.replacingOccurrences(of: "\r\n", with: "\n")
        guard normalized.hasPrefix("---\n") else {
            return ParsedSkillMarkdown(frontMatter: [:], body: normalized)
        }

        let rest = String(normalized.dropFirst(4))
        guard let endRange = rest.range(of: "\n---\n") else {
            return ParsedSkillMarkdown(frontMatter: [:], body: normalized)
        }

        let frontMatterText = String(rest[..<endRange.lowerBound])
        let body = String(rest[endRange.upperBound...])
        return ParsedSkillMarkdown(
            frontMatter: parseFrontMatter(frontMatterText),
            body: body
        )
    }

    static func parseArray(_ raw: String) -> [String] {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let withoutBrackets: String
        if trimmed.hasPrefix("[") && trimmed.hasSuffix("]") {
            withoutBrackets = String(trimmed.dropFirst().dropLast())
        } else {
            withoutBrackets = trimmed
        }
        return withoutBrackets
            .split(separator: ",")
            .map { value in
                value
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
            }
            .filter { !$0.isEmpty }
    }

    private static func parseFrontMatter(_ text: String) -> [String: String] {
        var result: [String: String] = [:]
        for line in text.split(separator: "\n", omittingEmptySubsequences: false) {
            guard let separator = line.firstIndex(of: ":") else { continue }
            let key = line[..<separator].trimmingCharacters(in: .whitespacesAndNewlines)
            let valueStart = line.index(after: separator)
            let value = line[valueStart...].trimmingCharacters(in: .whitespacesAndNewlines)
            if !key.isEmpty { result[key] = value }
        }
        return result
    }
}
