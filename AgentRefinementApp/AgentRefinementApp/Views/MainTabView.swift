import SwiftUI

enum MainTab: String, CaseIterable, Identifiable {
    case requirements = "要件・実行"
    case templates = "組織テンプレート"
    case agents = "エージェント管理"
    case workflow = "ワークフローエディタ"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .requirements: "📋"
        case .templates: "🏢"
        case .agents: "🤖"
        case .workflow: "🔀"
        }
    }
}

struct MainTabView: View {
    @Binding var selectedTab: MainTab
    @AppStorage("ui.simple_mode") private var simpleMode: Bool = true

    private var visibleTabs: [MainTab] {
        simpleMode ? [.requirements, .templates] : MainTab.allCases
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(visibleTabs) { tab in
                    Button {
                        selectedTab = tab
                    } label: {
                        HStack(spacing: 4) {
                            Text(tab.icon)
                                .font(.system(size: 16))
                            Text(tab.rawValue)
                                .font(.system(size: 16, weight: selectedTab == tab ? .bold : .regular))
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .foregroundStyle(selectedTab == tab ? .primary : .secondary)
                        .background(selectedTab == tab ? Color.accentColor.opacity(0.1) : Color.clear)
                        .overlay(alignment: .bottom) {
                            if selectedTab == tab {
                                Rectangle()
                                    .fill(Color.accentColor)
                                    .frame(height: 2)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                Spacer()

                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        simpleMode.toggle()
                        if simpleMode, selectedTab == .agents || selectedTab == .workflow {
                            selectedTab = .requirements
                        }
                    }
                } label: {
                    Text(simpleMode ? "詳細設定を表示" : "かんたん表示に戻す")
                        .font(.system(size: 12, weight: .semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
                .padding(.trailing, 10)
            }
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.3))

            Divider()

            Group {
                switch selectedTab {
                case .requirements:
                    RequirementsScreen()
                case .templates:
                    TemplatesScreen()
                case .agents:
                    AgentsScreen()
                case .workflow:
                    WorkflowScreen()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct PlaceholderView: View {
    let title: String
    let detail: String

    var body: some View {
        VStack(spacing: 8) {
            Text(title).font(.title2)
            Text(detail).font(.caption).foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
