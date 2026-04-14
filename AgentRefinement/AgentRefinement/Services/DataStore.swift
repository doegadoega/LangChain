import Foundation

final class DataStore: Sendable {
    let baseDirectory: URL

    private var agentsDir: URL { baseDirectory.appendingPathComponent("agents") }
    private var projectsDir: URL { baseDirectory.appendingPathComponent("projects") }
    private var templatesDir: URL { baseDirectory.appendingPathComponent("templates") }
    private var workflowsDir: URL { baseDirectory.appendingPathComponent("workflows") }

    init(baseDirectory: URL? = nil) {
        self.baseDirectory = baseDirectory ?? FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".agent-refinement")
    }

    // MARK: - Agents

    func saveAgent(_ agent: MasterAgent) throws {
        try ensureDirectory(agentsDir)
        let file = agentsDir.appendingPathComponent("\(agent.id).json")
        let data = try makeEncoder().encode(agent)
        try data.write(to: file)
    }

    func loadAgents() throws -> [MasterAgent] {
        try loadAll(from: agentsDir)
    }

    func loadAgent(id: String) throws -> MasterAgent? {
        let file = agentsDir.appendingPathComponent("\(id).json")
        guard FileManager.default.fileExists(atPath: file.path) else { return nil }
        let data = try Data(contentsOf: file)
        return try makeDecoder().decode(MasterAgent.self, from: data)
    }

    func deleteAgent(id: String) throws {
        let file = agentsDir.appendingPathComponent("\(id).json")
        if FileManager.default.fileExists(atPath: file.path) {
            try FileManager.default.removeItem(at: file)
        }
    }

    // MARK: - Projects

    func saveProject(_ project: Project) throws {
        try ensureDirectory(projectsDir)
        let file = projectsDir.appendingPathComponent("\(project.id.uuidString).json")
        let data = try makeEncoder().encode(project)
        try data.write(to: file)
    }

    func loadProjects() throws -> [Project] {
        try loadAll(from: projectsDir)
    }

    func deleteProject(id: UUID) throws {
        let file = projectsDir.appendingPathComponent("\(id.uuidString).json")
        if FileManager.default.fileExists(atPath: file.path) {
            try FileManager.default.removeItem(at: file)
        }
    }

    // MARK: - Templates

    func saveTemplate(_ template: OrganizationTemplate) throws {
        try ensureDirectory(templatesDir)
        let file = templatesDir.appendingPathComponent("\(template.id.uuidString).json")
        let data = try makeEncoder().encode(template)
        try data.write(to: file)
    }

    func loadTemplates() throws -> [OrganizationTemplate] {
        try loadAll(from: templatesDir)
    }

    func deleteTemplate(id: UUID) throws {
        let file = templatesDir.appendingPathComponent("\(id.uuidString).json")
        if FileManager.default.fileExists(atPath: file.path) {
            try FileManager.default.removeItem(at: file)
        }
    }

    // MARK: - Workflows

    func saveWorkflow(_ workflow: Workflow) throws {
        try ensureDirectory(workflowsDir)
        let file = workflowsDir.appendingPathComponent("\(workflow.id.uuidString).json")
        let data = try makeEncoder().encode(workflow)
        try data.write(to: file)
    }

    func loadWorkflows() throws -> [Workflow] {
        try loadAll(from: workflowsDir)
    }

    func deleteWorkflow(id: UUID) throws {
        let file = workflowsDir.appendingPathComponent("\(id.uuidString).json")
        if FileManager.default.fileExists(atPath: file.path) {
            try FileManager.default.removeItem(at: file)
        }
    }

    // MARK: - Helpers

    private func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    private func ensureDirectory(_ dir: URL) throws {
        if !FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
    }

    private func loadAll<T: Decodable>(from dir: URL) throws -> [T] {
        guard FileManager.default.fileExists(atPath: dir.path) else { return [] }
        let files = try FileManager.default.contentsOfDirectory(
            at: dir,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "json" }
        return try files.compactMap { file in
            let data = try Data(contentsOf: file)
            return try makeDecoder().decode(T.self, from: data)
        }
    }
}
