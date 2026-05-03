import Foundation

enum PromptBuilder {

    static func buildSystemDirective(agent: MasterAgent, renderedSkillsBlock: String = "") -> String {
        let persona = agent.persona?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "なし"
        let skills = agent.skills.isEmpty ? "- なし" : agent.skills.map { "- \($0)" }.joined(separator: "\n")
        let orgRole = agent.orgRoles.first?.rawValue ?? "worker"

        let mcpBlock: String
        if agent.mcpEnabled {
            let servers = agent.mcpServers.isEmpty ? "未指定" : agent.mcpServers.joined(separator: ", ")
            let instruction = agent.mcpInstruction?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "特になし"
            mcpBlock = "MCP設定:\n- 有効化: 有効\n- サーバー: \(servers)\n- 設定ファイル: \(agent.mcpConfigPath ?? "未指定")\n- 参照コマンド: \(agent.mcpContextCommand ?? "未指定")\n- MCP指示:\n\(instruction)"
        } else {
            mcpBlock = "MCP設定:\n- 有効化: 無効"
        }

        let trimmedSkillsBlock = renderedSkillsBlock.trimmingCharacters(in: .whitespacesAndNewlines)
        let skillSection = trimmedSkillsBlock.isEmpty
            ? ""
            : "\n\nインストール済みスキル:\n\(trimmedSkillsBlock)"

        return "あなたは \(agent.name) です。\n組織ロール: \(orgRole)\nペルソナ:\n\(persona)\n\n活用するスキル:\n\(skills)\(skillSection)\n\(mcpBlock)"
    }

    static func buildSystemDirective(
        agent: MasterAgent,
        installedSkills: [SkillDocument]
    ) -> String {
        let orgRole = agent.orgRoles.first ?? .worker
        let rendered = SkillPromptRenderer.render(
            skills: installedSkills,
            references: agent.skillRefs,
            provider: agent.provider,
            role: orgRole
        )
        return buildSystemDirective(agent: agent, renderedSkillsBlock: rendered)
    }

    static func buildCodingInstruction(orgRole: OrgRole, hasWorkingDir: Bool) -> String {
        let roleHint: String = switch orgRole {
        case .ceo: "最終判断者として、優先順位と受け入れ基準を明確化してください。"
        case .manager: "計画整合と分解可能性を重視し、実行指示を具体化してください。"
        case .pmo: "計画の抜け漏れ・依存リスク・進捗リスクを明示してください。"
        case .qa: "テスト観点と品質ゲート観点を最優先で確認してください。"
        default: "担当ロールとして成果物を前進させる具体的な変更を出してください。"
        }

        if hasWorkingDir {
            return "リポジトリで直接作業してください。\n必要なファイルを作成・修正し、変更内容を要約してください。\nテストコマンドがある場合は実行して結果を含めてください。\n\(roleHint)"
        }
        return "現在のドラフトを実装計画として改善してください。\n出力は以下の見出しを含めてください: `変更概要` `変更ファイル` `実装手順` `テスト計画` `リスク`。\n\(roleHint)"
    }

    static func buildWritingInstruction(orgRole: OrgRole) -> String {
        let roleHint: String = switch orgRole {
        case .ceo: "意思決定しやすい簡潔さを重視してください。"
        case .manager: "段取りと依存関係が伝わる構成にしてください。"
        case .pmo: "抜け漏れと曖昧表現を排除してください。"
        case .qa: "検証観点が明確になるようにしてください。"
        default: "読み手に伝わる明瞭さを重視してください。"
        }
        return "現在の下書きを改善してください。\n必要なら修正案と本文をまとめて返してください。\n\(roleHint)"
    }

    static func buildDependencyContextBlock(agent: MasterAgent, roundOutputs: [String: String]) -> String {
        guard !agent.dependsOn.isEmpty else { return "依存エージェント出力: なし\n" }
        var lines = ["依存エージェント出力:"]
        for dep in agent.dependsOn {
            let output = roundOutputs[dep] ?? ""
            if output.isEmpty {
                lines.append("- \(dep): (未実行または出力なし)")
            } else {
                lines.append("- \(dep):\n```text\n\(truncateOutput(output))\n```")
            }
        }
        return lines.joined(separator: "\n") + "\n"
    }

    static func buildMcpContextBlock(context: String, error: String?) -> String {
        if !context.isEmpty { return "MCP参照コンテキスト:\n```text\n\(truncateOutput(context, maxChars: 6000))\n```" }
        if let error { return "MCP参照コンテキスト: 取得失敗 (\(error))" }
        return "MCP参照コンテキスト: なし"
    }

    static func truncateOutput(_ text: String, maxChars: Int = 2800) -> String {
        if text.count <= maxChars { return text }
        return String(text.prefix(maxChars)) + "\n...(truncated)"
    }

    static func computeDiff(before: String, after: String) -> String {
        let beforeLines = before.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let afterLines = after.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var diff: [String] = ["--- original", "+++ refined"]
        for line in beforeLines where !afterLines.contains(line) { diff.append("- \(line)") }
        for line in afterLines where !beforeLines.contains(line) { diff.append("+ \(line)") }
        return diff.joined(separator: "\n")
    }
}
