import SwiftUI

struct ContentView: View {
    @EnvironmentObject var sidecarManager: SidecarManager

    @State private var projects: [Project] = [
        Project(name: "payment-service", workingDirectory: "/Users/sfidante-he/workspace/payment-service"),
    ]
    @State private var selectedProjectId: UUID?
    @State private var selectedTab: MainTab = .requirements
    @State private var bottomTab: BottomTab = .agents
    @State private var selectedAgentId: String?

    @State private var agents: [MasterAgent] = [
        MasterAgent(id: "director", name: "Director", orgRoles: [.ceo, .manager], mode: .writer, provider: .claudeCli),
        MasterAgent(id: "architect", name: "Architect", orgRoles: [.systemDesigner, .worker], mode: .writer, provider: .claudeCli),
        MasterAgent(id: "backend-dev", name: "Backend Dev", orgRoles: [.worker], mode: .writer, provider: .geminiCli),
        MasterAgent(id: "security-qa", name: "Security QA", orgRoles: [.qa], mode: .reviewer, provider: .claudeCli),
    ]

    private var selectedProject: Project? {
        projects.first { $0.id == selectedProjectId }
    }

    private var selectedAgent: MasterAgent? {
        agents.first { $0.id == selectedAgentId }
    }

    var body: some View {
        HStack(spacing: 0) {
            ActivityBar(
                selectedProjectId: $selectedProjectId,
                projects: projects,
                onAddProject: addProject
            )

            Divider()

            SidebarView(workingDirectory: selectedProject?.workingDirectory)

            Divider()

            VStack(spacing: 0) {
                MainTabView(selectedTab: $selectedTab)

                BottomPanelView(
                    selectedTab: $bottomTab,
                    agents: agents,
                    selectedAgentId: $selectedAgentId,
                    onAddAgent: addAgent
                )
            }

            Divider()

            DetailPanelView(agent: selectedAgent)
        }
        .onAppear {
            selectedProjectId = projects.first?.id
        }
    }

    private func addProject() {
        let project = Project(name: "New Project", workingDirectory: "/tmp")
        projects = projects + [project]
        selectedProjectId = project.id
    }

    private func addAgent() {
        let agent = MasterAgent(
            id: "agent-\(agents.count + 1)",
            name: "New Agent",
            orgRoles: [.worker],
            mode: .writer,
            provider: .claudeCli
        )
        agents = agents + [agent]
        selectedAgentId = agent.id
    }
}

#Preview {
    ContentView()
        .environmentObject(SidecarManager())
}
