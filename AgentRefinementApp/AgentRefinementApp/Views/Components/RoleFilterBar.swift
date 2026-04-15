import SwiftUI

struct RoleFilterBar: View {
    @Binding var selectedRole: OrgRole?

    var body: some View {
        HStack(spacing: 3) {
            filterButton(label: "全て", role: nil, isActive: selectedRole == nil)
            ForEach(OrgRole.allCases) { role in
                filterButton(label: role.shortName, icon: role.icon, role: role, isActive: selectedRole == role, color: role.color)
            }
        }
    }

    private func filterButton(label: String, icon: String? = nil, role: OrgRole?, isActive: Bool, color: Color = .accentColor) -> some View {
        Button {
            selectedRole = role
        } label: {
            HStack(spacing: 2) {
                if let icon { Text(icon).font(.system(size: 15)) }
                Text(label).font(.system(size: 15, weight: isActive ? .bold : .regular))
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(isActive ? color.opacity(0.2) : Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(isActive ? color : Color.clear, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
