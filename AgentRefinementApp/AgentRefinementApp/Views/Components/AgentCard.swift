import SwiftUI

struct AgentCard: View {
    let agent: MasterAgent
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text(agent.primaryRole?.icon ?? "🤖")
                        .font(.system(size: 18))
                        .frame(width: 36, height: 36)
                        .background(agent.primaryRole?.color.opacity(0.3) ?? Color.gray.opacity(0.3))
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(agent.name)
                            .font(.system(size: 12, weight: .bold))
                            .lineLimit(1)
                        Text("\(agent.provider.rawValue) · \(agent.model ?? "default")")
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer()
                }

                HStack(spacing: 4) {
                    ForEach(agent.orgRoles, id: \.self) { role in
                        RoleBadge(role: role)
                    }
                }

                if let persona = agent.persona, !persona.isEmpty {
                    Text(persona)
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(nsColor: .controlBackgroundColor))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(
                                isSelected ? Color.accentColor : Color(nsColor: .separatorColor),
                                lineWidth: isSelected ? 2 : 1
                            )
                    )
            )
        }
        .buttonStyle(.plain)
    }
}
