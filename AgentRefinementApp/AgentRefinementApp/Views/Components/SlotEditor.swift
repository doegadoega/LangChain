import SwiftUI

struct SlotEditor: View {
    let slot: Slot
    let agents: [MasterAgent]
    let onUpdate: (Slot) -> Void
    let onRemove: () -> Void

    @State private var showAgentPicker = false

    private var matchingAgents: [MasterAgent] {
        agents.filter { $0.orgRoles.contains(slot.orgRole) }
    }

    private var assignedAgents: [MasterAgent] {
        agents.filter { slot.assignedAgentIds.contains($0.id) }
    }

    private var availableAgents: [MasterAgent] {
        matchingAgents.filter { !slot.assignedAgentIds.contains($0.id) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            assignedList
            addAgentButton
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color(nsColor: .separatorColor)))
    }

    private var header: some View {
        HStack(spacing: 10) {
            Text("⠿").foregroundStyle(.tertiary).font(.system(size: 14))
            Text(slot.orgRole.icon).font(.system(size: 18))
            VStack(alignment: .leading, spacing: 2) {
                Text(slot.orgRole.displayName).font(.system(size: 14, weight: .semibold))
                Text("\(slot.minCount)-\(slot.maxCount)名 · \(slot.required ? "必須" : "任意")")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(slot.assignedAgentIds.count)/\(slot.maxCount)名")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(slot.assignedAgentIds.count >= slot.minCount ? .green : .orange)
            Button(action: onRemove) {
                Text("×").font(.system(size: 14, weight: .semibold)).foregroundStyle(.red).padding(4)
            }
            .buttonStyle(.plain)
        }
    }

    private var assignedList: some View {
        Group {
            if !assignedAgents.isEmpty {
                VStack(spacing: 4) {
                    ForEach(assignedAgents) { agent in
                        HStack(spacing: 6) {
                            Text(agent.primaryRole?.icon ?? "🤖")
                                .font(.system(size: 14))
                            Text(agent.name)
                                .font(.system(size: 13, weight: .medium))
                            Text(agent.provider.rawValue)
                                .font(.system(size: 11))
                                .foregroundStyle(.tertiary)
                            Spacer()
                            Button {
                                removeAgent(agent.id)
                            } label: {
                                Text("×").font(.system(size: 12)).foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(slot.orgRole.color.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
        }
    }

    private var addAgentButton: some View {
        Group {
            if slot.assignedAgentIds.count < slot.maxCount {
                if showAgentPicker {
                    agentPickerList
                } else {
                    Button { showAgentPicker = true } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                            Text("エージェントを追加")
                        }
                        .font(.system(size: 12))
                        .foregroundStyle(.blue)
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var agentPickerList: some View {
        VStack(spacing: 2) {
            if availableAgents.isEmpty {
                Text("該当ロールのエージェントがありません")
                    .font(.system(size: 12))
                    .foregroundStyle(.tertiary)
                    .padding(.vertical, 4)

                Text("エージェント管理で \(slot.orgRole.icon) \(slot.orgRole.displayName) ロールのエージェントを作成してください")
                    .font(.system(size: 11))
                    .foregroundStyle(.quaternary)
            } else {
                ForEach(availableAgents) { agent in
                    Button {
                        assignAgent(agent.id)
                        showAgentPicker = false
                    } label: {
                        HStack(spacing: 6) {
                            Text(agent.primaryRole?.icon ?? "🤖").font(.system(size: 14))
                            Text(agent.name).font(.system(size: 13, weight: .medium))
                            Spacer()
                            Text(agent.provider.rawValue)
                                .font(.system(size: 11)).foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            Button { showAgentPicker = false } label: {
                Text("閉じる").font(.system(size: 11)).foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
        }
        .padding(6)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.8))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
    }

    private func assignAgent(_ agentId: String) {
        var updated = slot
        updated.assignedAgentIds = slot.assignedAgentIds + [agentId]
        onUpdate(updated)
    }

    private func removeAgent(_ agentId: String) {
        var updated = slot
        updated.assignedAgentIds = slot.assignedAgentIds.filter { $0 != agentId }
        onUpdate(updated)
    }
}
