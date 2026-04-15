import SwiftUI

struct AgentHistoryView: View {
    let agent: MasterAgent
    let projects: [Project]

    private var participatedProjects: [(Project, AgentSnapshot)] {
        projects.compactMap { project in
            if let snapshot = project.agentSnapshots.first(where: { $0.masterAgentId == agent.id }) {
                return (project, snapshot)
            }
            return nil
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("📁 案件履歴").font(.system(size: 14, weight: .bold)).foregroundStyle(.secondary)

            if participatedProjects.isEmpty {
                Text("まだ案件に参加していません").font(.system(size: 16)).foregroundStyle(.tertiary)
            } else {
                ForEach(participatedProjects, id: \.1.id) { project, snapshot in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(project.name).font(.system(size: 16, weight: .semibold))
                            Spacer()
                            if let avg = snapshot.averageScore {
                                Text("⭐ \(String(format: "%.1f", avg))")
                                    .font(.system(size: 15, weight: .bold)).foregroundStyle(.orange)
                            }
                        }
                        Text("参加: \(snapshot.createdAt.formatted(.dateTime.month().day()))")
                            .font(.system(size: 15)).foregroundStyle(.tertiary)

                        if !snapshot.evaluations.isEmpty {
                            HStack(spacing: 4) {
                                ForEach(snapshot.evaluations) { eval in
                                    Text("\(eval.evaluatorRole.rawValue): \(eval.score)")
                                        .font(.system(size: 14))
                                        .padding(.horizontal, 4).padding(.vertical, 1)
                                        .background(Color(nsColor: .controlBackgroundColor))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }
                    .padding(8)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
                }
            }
        }
    }
}
