import SwiftUI

struct AgentsScreen: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            cardGrid
        }
    }

    private var toolbar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                    .font(.system(size: 16))
                TextField("検索...", text: $appState.agentSearchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .frame(maxWidth: 180)

            RoleFilterBar(selectedRole: $appState.roleFilter)

            Spacer()

            Button {
                appState.addAgent(name: "New Agent", orgRoles: [.worker], mode: .writer, provider: .claudeCli)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "plus")
                    Text("新規エージェント")
                }
                .font(.system(size: 14, weight: .semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private var cardGrid: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 220, maximum: 300))],
                spacing: 10
            ) {
                ForEach(appState.filteredAgents) { agent in
                    AgentCard(
                        agent: agent,
                        isSelected: appState.selectedAgentId == agent.id
                    ) {
                        appState.selectedAgentId = agent.id
                    }
                }
            }
            .padding(14)
        }
    }
}
