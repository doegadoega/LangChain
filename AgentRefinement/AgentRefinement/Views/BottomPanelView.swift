import SwiftUI

enum BottomTab: String, CaseIterable, Identifiable {
    case agents = "エージェント"
    case terminal = "ターミナル"

    var id: String { rawValue }
    var icon: String {
        switch self {
        case .agents: "🤖"
        case .terminal: "⬛"
        }
    }
}

struct BottomPanelView: View {
    @Binding var selectedTab: BottomTab
    let agents: [MasterAgent]
    @Binding var selectedAgentId: String?
    let onAddAgent: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Divider().frame(height: 2)

            HStack(spacing: 0) {
                ForEach(BottomTab.allCases) { tab in
                    Button {
                        selectedTab = tab
                    } label: {
                        HStack(spacing: 3) {
                            Text(tab.icon).font(.system(size: 9))
                            Text(tab.rawValue)
                                .font(.system(size: 10, weight: selectedTab == tab ? .bold : .regular))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .foregroundStyle(selectedTab == tab ? .primary : .secondary)
                        .overlay(alignment: .bottom) {
                            if selectedTab == tab {
                                Rectangle().fill(Color.accentColor).frame(height: 2)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.3))

            Divider()

            Group {
                switch selectedTab {
                case .agents:
                    agentCarousel
                case .terminal:
                    TerminalView()
                }
            }
        }
        .frame(height: 80)
    }

    private var agentCarousel: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Button(action: onAddAgent) {
                    RoundedRectangle(cornerRadius: 6)
                        .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [5]))
                        .foregroundStyle(.tertiary)
                        .frame(width: 44, height: 50)
                        .overlay {
                            Text("+").font(.system(size: 20)).foregroundStyle(.tertiary)
                        }
                }
                .buttonStyle(.plain)

                ForEach(agents) { agent in
                    Button {
                        selectedAgentId = agent.id
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 4) {
                                Text(agent.primaryRole?.icon ?? "🤖").font(.system(size: 12))
                                Text(agent.name).font(.system(size: 10, weight: .bold)).lineLimit(1)
                            }
                            Text(agent.orgRoles.map(\.shortName).joined(separator: " · "))
                                .font(.system(size: 8)).foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .frame(minWidth: 110, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(nsColor: .controlBackgroundColor))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .strokeBorder(
                                            selectedAgentId == agent.id ? Color.accentColor : Color(nsColor: .separatorColor),
                                            lineWidth: selectedAgentId == agent.id ? 2 : 1
                                        )
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
        }
    }
}
