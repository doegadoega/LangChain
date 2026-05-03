import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var showNewProjectSheet = false
    @AppStorage("ui.simple_mode") private var simpleMode: Bool = true

    var body: some View {
        HSplitView {
            // Left: Project list + Sidebar combined
            leftPanel
                .frame(minWidth: 200, idealWidth: 260, maxWidth: 400)

            // Center: Main content + Bottom panel
            VStack(spacing: 0) {
                MainTabView(selectedTab: $appState.selectedTab)

                if !simpleMode {
                    BottomPanelView(
                        selectedTab: $appState.bottomTab,
                        agents: appState.agents,
                        selectedAgentId: $appState.selectedAgentId,
                        onAddAgent: {
                            appState.addAgent(name: "New Agent", orgRoles: [.worker], mode: .writer, provider: .claudeCli)
                        }
                    )
                }
            }
            .frame(minWidth: 500)

            // Right: Detail panel (only when agent selected)
            if !simpleMode, appState.selectedAgentId != nil {
                DetailPanelView()
                    .frame(minWidth: 250, idealWidth: 300, maxWidth: 450)
            }
        }
        .onAppear {
            if appState.selectedProjectId == nil {
                appState.selectedProjectId = appState.projects.first?.id
            }
        }
        .sheet(isPresented: $showNewProjectSheet) {
            NewProjectSheet(isPresented: $showNewProjectSheet)
                .environmentObject(appState)
        }
    }

    private var leftPanel: some View {
        HStack(spacing: 0) {
            ActivityBar(
                selectedProjectId: $appState.selectedProjectId,
                projects: appState.projects,
                onAddProject: { showNewProjectSheet = true },
                onRenameProject: renameProject
            )
            Divider()
            VStack(spacing: 0) {
                projectHeader
                Divider()
                projectList
                Divider()
                if simpleMode {
                    simpleModeHintPanel
                } else {
                    SidebarView(workingDirectory: appState.selectedProject?.workingDirectory)
                }
            }
        }
    }

    private var projectHeader: some View {
        HStack {
            Text("📁 案件")
                .font(.system(size: 14, weight: .bold))
            Spacer()
            Button { showNewProjectSheet = true } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(.blue)
            }
            .buttonStyle(.plain)
            .help("新規案件")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var projectList: some View {
        ScrollView {
            VStack(spacing: 2) {
                ForEach(appState.projects) { project in
                    Button {
                        appState.selectedProjectId = project.id
                    } label: {
                        HStack(spacing: 10) {
                            Text(projectIcon(project))
                                .font(.system(size: 20))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(project.name)
                                    .font(.system(size: 13, weight: .semibold))
                                    .lineLimit(1)
                                Text(project.workingDirectory)
                                    .font(.system(size: 10))
                                    .foregroundStyle(.tertiary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            if project.status == .active {
                                Circle()
                                    .fill(.green)
                                    .frame(width: 8, height: 8)
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            appState.selectedProjectId == project.id
                                ? Color.accentColor.opacity(0.12)
                                : Color.clear
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
        }
        .frame(minHeight: 80, idealHeight: 120, maxHeight: 200)
    }

    private func projectIcon(_ project: Project) -> String {
        switch project.status {
        case .active: "🟢"
        case .completed: "✅"
        case .archived: "📦"
        }
    }

    private func renameProject(_ project: Project, _ newName: String) {
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        var updated = project
        updated.name = trimmed
        updated.updatedAt = Date()
        appState.updateProject(updated)
    }

    private var simpleModeHintPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("かんたんモード")
                .font(.system(size: 13, weight: .bold))
            Text("1. 左上の + で案件作成")
                .font(.system(size: 12))
            Text("2. 要件・実行で内容入力")
                .font(.system(size: 12))
            Text("3. 実行して結果確認")
                .font(.system(size: 12))
            Spacer()
        }
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(10)
    }
}
