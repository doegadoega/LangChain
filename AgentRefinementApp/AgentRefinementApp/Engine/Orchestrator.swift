import Foundation

struct RefinementEvent {
    let type: String
    let data: [String: Any]

    init(type: String, data: [String: Any] = [:]) {
        self.type = type
        self.data = data
    }
}

enum Orchestrator {

    struct RunConfig {
        let agents: [MasterAgent]
        let sourceText: String
        let objective: String
        let globalInstruction: String
        let workflowMode: String
        let orchestrationMode: String
        let rounds: Int
        let workingDirectory: String?
    }

    // MARK: - Execution Batches

    static func executionBatches(agents: [MasterAgent], mode: String) -> [[MasterAgent]] {
        switch mode {
        case "sequential":
            return agents.map { [$0] }

        case "role_based":
            let roleOrder: [OrgRole] = [.ceo, .manager, .worker, .pmo, .qa, .uiDesigner, .systemDesigner, .opsDesigner]
            var batches: [[MasterAgent]] = []
            for role in roleOrder {
                let group = agents.filter { $0.orgRoles.contains(role) }
                if !group.isEmpty { batches.append(group) }
            }
            return batches

        case "dependency_graph":
            return topologicalSort(agents: agents)

        default:
            return agents.map { [$0] }
        }
    }

    private static func topologicalSort(agents: [MasterAgent]) -> [[MasterAgent]] {
        let byId = Dictionary(uniqueKeysWithValues: agents.map { ($0.id, $0) })
        let indexMap = Dictionary(uniqueKeysWithValues: agents.enumerated().map { ($1.id, $0) })
        var indegree = Dictionary(uniqueKeysWithValues: agents.map { ($0.id, $0.dependsOn.count) })
        var reverse: [String: [String]] = [:]
        for agent in agents {
            for dep in agent.dependsOn {
                reverse[dep, default: []].append(agent.id)
            }
        }

        var ready = agents.filter { indegree[$0.id] == 0 }.map(\.id)
            .sorted { (indexMap[$0] ?? 0) < (indexMap[$1] ?? 0) }
        var batches: [[MasterAgent]] = []
        var visited = 0

        while !ready.isEmpty {
            let batch = ready.compactMap { byId[$0] }
            batches.append(batch)
            visited += ready.count

            var next: [String] = []
            for current in ready {
                for nxt in reverse[current] ?? [] {
                    indegree[nxt] = (indegree[nxt] ?? 1) - 1
                    if indegree[nxt] == 0 { next.append(nxt) }
                }
            }
            ready = next.sorted { (indexMap[$0] ?? 0) < (indexMap[$1] ?? 0) }
        }

        if visited != agents.count { return [] }
        return batches
    }

    // MARK: - Run

    static func run(config: RunConfig, onEvent: @escaping (RefinementEvent) -> Void) {
        var draft = config.sourceText
        let original = draft
        let batches = executionBatches(agents: config.agents, mode: config.orchestrationMode)
        let isCoding = config.workflowMode == "coding"
        let workingDir = config.workingDirectory

        if let dir = workingDir, isCoding {
            try? GitHelper.ensureWorkingDir(dir)
        }

        onEvent(RefinementEvent(type: "run_started", data: [
            "rounds": config.rounds,
            "agent_count": config.agents.count,
        ]))

        for roundIndex in 1...max(1, config.rounds) {
            var roundOutputs: [String: String] = [:]
            onEvent(RefinementEvent(type: "round_started", data: ["round_index": roundIndex]))

            for batch in batches {
                for agent in batch {
                    if let dir = workingDir, isCoding {
                        let diff = GitHelper.captureGitDiff(workingDirectory: dir)
                        draft = diff.isEmpty
                            ? "元の要件:\n\(original)\n\nまだファイル変更はありません。"
                            : "元の要件:\n\(original)\n\n現在のリポジトリ変更:\n```diff\n\(diff)\n```"
                    }

                    onEvent(RefinementEvent(type: "turn_started", data: [
                        "agent_id": agent.id,
                        "agent_name": agent.name,
                    ]))

                    let prompt = buildFullPrompt(
                        agent: agent,
                        draft: draft,
                        config: config,
                        roundIndex: roundIndex,
                        roundOutputs: roundOutputs
                    )

                    do {
                        let provider = try CLIProvider.resolve(
                            providerKind: agent.provider,
                            commandTemplate: agent.commandTemplate,
                            codingMode: isCoding && workingDir != nil
                        )
                        let output = try provider.generate(
                            prompt: prompt,
                            model: agent.model,
                            cwd: workingDir,
                            mcpConfigPath: agent.mcpConfigPath,
                            mcpServers: agent.mcpServers
                        )
                        roundOutputs[agent.id] = output
                        if workingDir == nil || !isCoding { draft = output }

                        onEvent(RefinementEvent(type: "turn_completed", data: [
                            "agent_id": agent.id,
                            "agent_name": agent.name,
                            "full_output": output,
                            "output": PromptBuilder.truncateOutput(output, maxChars: 500),
                            "success": true,
                        ]))
                    } catch {
                        roundOutputs[agent.id] = ""
                        onEvent(RefinementEvent(type: "turn_completed", data: [
                            "agent_id": agent.id,
                            "agent_name": agent.name,
                            "error": error.localizedDescription,
                            "success": false,
                        ]))
                    }
                }
            }
            onEvent(RefinementEvent(type: "round_completed", data: ["round_index": roundIndex]))
        }

        let finalDiff = (workingDir != nil && isCoding)
            ? GitHelper.captureGitDiff(workingDirectory: workingDir!)
            : PromptBuilder.computeDiff(before: original, after: draft)

        onEvent(RefinementEvent(type: "run_completed", data: [
            "final_text": draft,
            "diff": finalDiff,
        ]))
    }

    private static func buildFullPrompt(
        agent: MasterAgent,
        draft: String,
        config: RunConfig,
        roundIndex: Int,
        roundOutputs: [String: String]
    ) -> String {
        let orgRole = agent.orgRoles.first ?? .worker
        let depBlock = PromptBuilder.buildDependencyContextBlock(agent: agent, roundOutputs: roundOutputs)

        let roleInstruction: String
        if config.workflowMode == "coding" {
            roleInstruction = PromptBuilder.buildCodingInstruction(
                orgRole: orgRole,
                hasWorkingDir: config.workingDirectory != nil
            )
        } else {
            roleInstruction = PromptBuilder.buildWritingInstruction(orgRole: orgRole)
        }

        return """
            \(PromptBuilder.buildSystemDirective(agent: agent))

            ワークフローモード: \(config.workflowMode)
            オーケストレーション: \(config.orchestrationMode)
            ラウンド: \(roundIndex)
            目的:
            \(config.objective.isEmpty ? "特になし" : config.objective)

            グローバル指示:
            \(config.globalInstruction.isEmpty ? "特になし" : config.globalInstruction)

            \(depBlock)

            現在の状態:
            <<DRAFT>>
            \(draft)
            <</DRAFT>>

            タスク:
            \(roleInstruction)
            """
    }
}
