import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sidecarManager: SidecarManager
    @State private var showingNewProject = false

    var body: some View {
        HStack(spacing: 0) {
            ActivityBar(
                selectedProjectId: $appState.selectedProjectId,
                projects: appState.projects,
                onAddProject: { showingNewProject = true },
                onRenameProject: { project, newName in
                    var updated = project
                    updated.name = newName
                    updated.updatedAt = Date()
                    appState.updateProject(updated)
                }
            )

            Divider()

            SidebarView(workingDirectory: appState.selectedProject?.workingDirectory)

            Divider()

            VStack(spacing: 0) {
                MainTabView(selectedTab: $appState.selectedTab)

                BottomPanelView(
                    selectedTab: $appState.bottomTab,
                    agents: appState.agents,
                    selectedAgentId: $appState.selectedAgentId,
                    onAddAgent: {
                        appState.addAgent(name: "New Agent", orgRoles: [.worker], mode: .writer, provider: .claudeCli)
                    }
                )
            }

            Divider()

            DetailPanelView()
        }
        .sheet(isPresented: $showingNewProject) {
            NewProjectSheet(isPresented: $showingNewProject)
                .environmentObject(appState)
        }
        .onAppear {
            if appState.selectedProjectId == nil {
                appState.selectedProjectId = appState.projects.first?.id
            }
        }
    }
}
