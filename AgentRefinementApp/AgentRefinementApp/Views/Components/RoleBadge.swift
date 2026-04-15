import SwiftUI

struct RoleBadge: View {
    let role: OrgRole

    var body: some View {
        HStack(spacing: 2) {
            Text(role.icon).font(.system(size: 14))
            Text(role.shortName).font(.system(size: 14, weight: .semibold))
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(role.color.opacity(0.15))
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(role.color.opacity(0.5), lineWidth: 1))
    }
}
