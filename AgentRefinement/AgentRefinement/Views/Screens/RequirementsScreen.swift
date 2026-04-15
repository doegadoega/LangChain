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
            Text("要件").font(.system(size: 10, weight: .bold)).foregroundStyle(.secondary)
            TextField("要件を入力...", text: $requirementsText)
                .textFieldStyle(.roundedBorder).font(.system(size: 11))
            Button {
                startExecution()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "play.fill").font(.system(size: 9))
                    Text("実行")
                }
                .font(.system(size: 11, weight: .bold))
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
                    Text("📋 要件を入力して実行してください").font(.system(size: 12)).foregroundStyle(.tertiary)
                    Text("エージェントの実行ログがここに表示されます").font(.system(size: 10)).foregroundStyle(.quaternary)
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
    }
}
