import SwiftUI

struct RequirementsScreen: View {
    @EnvironmentObject var appState: AppState
    @AppStorage("ui.simple_mode") private var simpleMode: Bool = true
    @State private var logEntries: [ExecutionLogEntry] = []
    @State private var chatMessages: [ChatMessage] = []
    @State private var detailedOutputs: [DetailedAgentOutput] = []
    @State private var finalResult: FinalExecutionResult?
    @State private var showDetailedOutputs = false

    var body: some View {
        VStack(spacing: 0) {
            requirementsBar
            Divider()
            executionArea
            ceoChatArea
        }
        .sheet(isPresented: $showDetailedOutputs) {
            DetailedOutputsSheet(
                outputs: detailedOutputs,
                finalResult: finalResult
            )
        }
        .onAppear {
            applyStoredProjectRequirementsIfNeeded()
        }
        .onChange(of: appState.selectedProjectId) {
            applyStoredProjectRequirementsIfNeeded()
        }
        .onChange(of: appState.pendingRequirementsAutoRunToken) {
            // New-project wizard sets a token to request immediate execution.
            startExecution()
        }
    }

    private var requirementsBar: some View {
        VStack(alignment: .leading, spacing: 4) {
            if simpleMode {
                Text("やりたいことを1文で入力して「実行」を押すだけです。")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }

            HStack(alignment: .bottom, spacing: 8) {
                Text(simpleMode ? "やりたいこと" : "要件")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.secondary)
                MultilineComposer(
                    text: $appState.requirementsDraft,
                    placeholder: simpleMode
                        ? "例: 最高の晩餐について、3つの案を提案して"
                        : "要件を入力...",
                    minHeight: 36,
                    maxHeight: 140,
                    isEnabled: !appState.isExecuting
                ) {
                    startExecution()
                }
                .frame(maxWidth: .infinity)

                Button {
                    startExecution()
                } label: {
                    HStack(spacing: 4) {
                        if appState.isExecuting {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Image(systemName: "play.fill").font(.system(size: 15))
                        }
                        Text(appState.isExecuting ? "実行中..." : "実行")
                    }
                    .font(.system(size: 14, weight: .bold))
                    .padding(.horizontal, 14).padding(.vertical, 5)
                    .background(appState.isExecuting ? Color.gray : Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
                .disabled(appState.isExecuting || appState.requirementsDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                Button {
                    showDetailedOutputs = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "doc.text.magnifyingglass").font(.system(size: 14))
                        Text("出力全文")
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .padding(.horizontal, 12).padding(.vertical, 5)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .foregroundStyle(.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
                .disabled(detailedOutputs.isEmpty && finalResult == nil)
            }

            HStack {
                Spacer()
                Text("⌘+Enter で実行")
                    .font(.system(size: 12))
                    .foregroundStyle(.tertiary)
            }
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
        CEOChatView(inputText: $appState.chatDraft, messages: chatMessages) { message in
            chatMessages.append(ChatMessage(sender: "あなた", icon: "👤", content: message, isUser: true))
        }
        .frame(height: 140)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.3))
    }

    private func startExecution() {
        guard appState.selectedProject != nil else {
            chatMessages.append(ChatMessage(
                sender: "Director",
                icon: "👑",
                content: "先に左上の + から案件を作成してください。",
                isUser: false
            ))
            return
        }

        guard let requirements = appState.consumeRequirementsDraft() else { return }
        appState.updateSelectedProjectRequirements(requirements)
        detailedOutputs = []
        finalResult = nil

        let executionAgents = appState.executionAgentsForSelectedProject()
        logEntries = executionAgents.enumerated().map { index, agent in
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
                            if let preview = event["output"] as? String, !preview.isEmpty {
                                agentLogs[name, default: []].append(preview)
                            }
                            agentLogs[name, default: []].append("✓ 完了")
                            if let fullOutput = event["full_output"] as? String, !fullOutput.isEmpty {
                                detailedOutputs.append(.init(agentName: name, output: fullOutput))
                            }
                        } else {
                            let errorMsg = event["error"] as? String ?? "エラー"
                            agentLogs[name, default: []].append("✗ " + errorMsg)
                        }
                        completedAgents.insert(name)
                    }
                case "run_completed":
                    let finalText = (event["final_text"] as? String) ?? ""
                    let diff = (event["diff"] as? String) ?? ""
                    finalResult = FinalExecutionResult(finalText: finalText, diff: diff)
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

            updatedEntries = executionAgents.map { agent in
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

    private func applyStoredProjectRequirementsIfNeeded() {
        guard
            appState.requirementsDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            let requirements = appState.selectedProject?.requirements?.trimmingCharacters(in: .whitespacesAndNewlines),
            !requirements.isEmpty
        else {
            return
        }
        appState.requirementsDraft = requirements
    }
}

private struct DetailedAgentOutput: Identifiable {
    let id = UUID()
    let agentName: String
    let output: String
}

private struct FinalExecutionResult {
    let finalText: String
    let diff: String
}

private struct DetailedOutputsSheet: View {
    let outputs: [DetailedAgentOutput]
    let finalResult: FinalExecutionResult?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("推論結果（全文）")
                    .font(.system(size: 18, weight: .bold))
                Spacer()
                Button("閉じる") { dismiss() }
                    .keyboardShortcut(.cancelAction)
            }

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if outputs.isEmpty {
                        Text("まだ出力はありません。")
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                    }

                    ForEach(Array(outputs.enumerated()), id: \.element.id) { index, item in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(index + 1). \(item.agentName)")
                                .font(.system(size: 14, weight: .semibold))
                            selectableBlock(item.output)
                        }
                    }

                    if let finalResult {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("最終結果")
                                .font(.system(size: 14, weight: .bold))
                            selectableBlock(finalResult.finalText.isEmpty ? "(空)" : finalResult.finalText)

                            if !finalResult.diff.isEmpty {
                                Text("差分")
                                    .font(.system(size: 13, weight: .semibold))
                                selectableBlock(finalResult.diff)
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .padding(16)
        .frame(minWidth: 760, minHeight: 520)
    }

    private func selectableBlock(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13, design: .monospaced))
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(Color(nsColor: .textBackgroundColor))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(nsColor: .separatorColor))
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
