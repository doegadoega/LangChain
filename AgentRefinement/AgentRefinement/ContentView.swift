import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var sidecarManager: SidecarManager

    var body: some View {
        HStack(spacing: 0) {
            ActivityBar(
                selectedProjectId: $appState.selectedProjectId,
                projects: appState.projects,
                onAddProject: {
                    appState.addProject(name: "New Project", workingDirectory: "/tmp")
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
        .onAppear {
            if appState.selectedProjectId == nil {
                appState.selectedProjectId = appState.projects.first?.id
            }
        }
    }
}
