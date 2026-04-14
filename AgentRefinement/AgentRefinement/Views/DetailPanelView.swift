import SwiftUI

struct DetailPanelView: View {
    let agent: MasterAgent?

    var body: some View {
        if let agent {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Text(agent.primaryRole?.icon ?? "🤖")
                            .font(.system(size: 20))
                            .frame(width: 32, height: 32)
                            .background(agent.primaryRole?.color.opacity(0.3) ?? Color.gray.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        VStack(alignment: .leading) {
                            Text(agent.name).font(.system(size: 13, weight: .bold))
                            Text("エージェント詳細").font(.system(size: 9)).foregroundStyle(.tertiary)
                        }
                    }

                    HStack(spacing: 4) {
                        ForEach(agent.orgRoles, id: \.self) { role in
                            HStack(spacing: 2) {
                                Text(role.icon).font(.system(size: 8))
                                Text(role.shortName).font(.system(size: 8, weight: .semibold))
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(role.color.opacity(0.15))
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(role.color.opacity(0.5)))
                        }
                    }

                    Divider()

                    Text("編集フォーム（Phase 2で実装）")
                        .font(.system(size: 10)).foregroundStyle(.tertiary)
                }
                .padding(14)
            }
            .frame(minWidth: 220, idealWidth: 260, maxWidth: 300)
        } else {
            VStack {
                Text("エージェントを選択してください")
                    .font(.system(size: 11)).foregroundStyle(.tertiary)
            }
            .frame(minWidth: 220, idealWidth: 260, maxWidth: 300)
        }
    }
}
