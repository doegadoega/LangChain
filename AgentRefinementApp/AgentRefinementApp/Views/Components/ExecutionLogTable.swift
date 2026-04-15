import SwiftUI

struct ExecutionLogEntry: Identifiable {
    let id = UUID()
    let agentName: String
    let agentIcon: String
    let roles: [OrgRole]
    let status: ExecutionStatus
    let logs: [String]
}

enum ExecutionStatus: String {
    case done = "完了"
    case running = "実行中"
    case waiting = "待機"

    var color: Color {
        switch self {
        case .done: .green
        case .running: .blue
        case .waiting: .gray
        }
    }
}

struct ExecutionLogTable: View {
    let entries: [ExecutionLogEntry]

    var body: some View {
        VStack(spacing: 0) {
            headerRow
            Divider()
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(entries) { entry in
                        entryRow(entry)
                        Divider()
                    }
                }
            }
        }
    }

    private var headerRow: some View {
        HStack(spacing: 0) {
            Text("エージェント").frame(width: 120, alignment: .leading)
            Text("状態").frame(width: 60, alignment: .leading)
            Text("ログ出力").frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12).padding(.vertical, 6)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
    }

    private func entryRow(_ entry: ExecutionLogEntry) -> some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(entry.agentIcon).font(.system(size: 15))
                    Text(entry.agentName).font(.system(size: 16, weight: .semibold))
                }
                HStack(spacing: 3) {
                    ForEach(entry.roles, id: \.self) { role in
                        RoleBadge(role: role)
                    }
                }
            }
            .frame(width: 120, alignment: .leading)

            Text(entry.status.rawValue)
                .font(.system(size: 15, weight: .semibold))
                .padding(.horizontal, 6).padding(.vertical, 1)
                .background(entry.status.color.opacity(0.15))
                .clipShape(Capsule())
                .frame(width: 60, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                ForEach(entry.logs, id: \.self) { log in
                    Text(log).font(.system(size: 15, design: .monospaced)).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
    }
}
