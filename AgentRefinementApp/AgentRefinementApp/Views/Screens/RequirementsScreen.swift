import SwiftUI

struct RequirementsScreen: View {
    @EnvironmentObject var appState: AppState
    @State private var requirementsText: String = ""
    @State private var logEntries: [ExecutionLogEntry] = []
    @State private var chatMessages: [ChatMessage] = []

    var body: some View {
        VStack(spacing: 0) {
            requirementsBar
            Divider()
            executionArea
            ceoChatArea
        }
    }

    private var requirementsBar: some View {
        HStack(spacing: 8) {
            Text("要件").font(.system(size: 16, weight: .bold)).foregroundStyle(.secondary)
            TextField("要件を入力...", text: $requirementsText)
                .textFieldStyle(.roundedBorder).font(.system(size: 14))
            Button {
                startExecution()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "play.fill").font(.system(size: 15))
                    Text("実行")
                }
                .font(.system(size: 14, weight: .bold))
                .padding(.horizontal, 14).padding(.vertical, 5)
                .background(appState.isExecuting ? Color.gray : Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
            .disabled(appState.isExecuting || requirementsText.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal, 14).padding(.vertical, 8)
    }

    private var executionArea: some View {
        Group {
            if logEntries.isEmpty {
                VStack(spacing: 8) {
                    Text("📋 要件を入力して実行してください").font(.system(size: 15)).foregroundStyle(.tertiary)
                    Text("エージェントの実行ログがここに表示されます").font(.system(size: 16)).foregroundStyle(.quaternary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ExecutionLogTable(entries: logEntries)
            }
        }
    }

    private var ceoChatArea: some View {
        CEOChatView(messages: chatMessages) { message in
            chatMessages.append(ChatMessage(sender: "あなた", icon: "👤", content: message, isUser: true))
        }
        .frame(height: 100)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.3))
    }

    private func startExecution() {
        let requirements = requirementsText.trimmingCharacters(in: .whitespaces)
        guard !requirements.isEmpty else { return }

        logEntries = appState.agents.enumerated().map { index, agent in
            ExecutionLogEntry(
                agentName: agent.name,
                agentIcon: agent.primaryRole?.icon ?? "🤖",
                roles: agent.orgRoles,
                status: index == 0 ? .running : .waiting,
                logs: index == 0 ? ["→ 実行開始..."] : ["— 前ステップの完了待ち"]
            )
        }
        chatMessages.append(ChatMessage(sender: "Director", icon: "👑", content: "要件を受領しました。タスク分解を開始します。", isUser: false))

        Task {
            await appState.executeRefinement(requirements: requirements)

            var updatedEntries: [ExecutionLogEntry] = []
            var agentLogs: [String: [String]] = [:]
            var completedAgents: Set<String> = []

            for event in appState.executionEvents {
                let eventType = event["type"] as? String ?? ""
                let agentName = event["agent_name"] as? String

                switch eventType {
                case "turn_started":
                    if let name = agentName {
                        agentLogs[name, default: []].append("→ 開始")
                    }
                case "turn_output":
                    if let name = agentName,
                       let output = event["output"] as? String {
                        let preview = String(output.prefix(80))
                        agentLogs[name, default: []].append(preview)
                    }
                case "turn_completed":
                    if let name = agentName {
                        let success = event["success"] as? Bool ?? false
                        if success {
                            agentLogs[name, default: []].append("✓ 完了")
                        } else {
                            let errorMsg = event["error"] as? String ?? "エラー"
                            agentLogs[name, default: []].append("✗ " + errorMsg)
                        }
                        completedAgents.insert(name)
                    }
                case "run_completed":
                    chatMessages.append(ChatMessage(
                        sender: "Director", icon: "👑",
                        content: "全エージェントの実行が完了しました。",
                        isUser: false
                    ))
                case "run_failed", "turn_failed":
                    let errorMsg = event["error"] as? String ?? "不明なエラー"
                    chatMessages.append(ChatMessage(
                        sender: "Director", icon: "👑",
                        content: "実行エラー: \(errorMsg)",
                        isUser: false
                    ))
                default:
                    break
                }
            }

            updatedEntries = appState.agents.map { agent in
                let logs = agentLogs[agent.name] ?? ["— 未実行"]
                let status: ExecutionStatus = completedAgents.contains(agent.name)
                    ? .done
                    : (appState.isExecuting ? .running : .waiting)
                return ExecutionLogEntry(
                    agentName: agent.name,
                    agentIcon: agent.primaryRole?.icon ?? "🤖",
                    roles: agent.orgRoles,
                    status: status,
                    logs: logs
                )
            }
            logEntries = updatedEntries
        }
    }
}
