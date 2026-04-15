import SwiftUI

struct SlotEditor: View {
    let slot: Slot
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Text("⠿").foregroundStyle(.tertiary).font(.system(size: 14))
            Text(slot.orgRole.icon).font(.system(size: 16))
            VStack(alignment: .leading, spacing: 2) {
                Text(slot.orgRole.displayName).font(.system(size: 14, weight: .semibold))
                Text("\(slot.minCount)-\(slot.maxCount)名 · \(slot.required ? "必須" : "任意")")
                    .font(.system(size: 15)).foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(slot.assignedAgentIds.count)名アサイン").font(.system(size: 15)).foregroundStyle(.secondary)
            Button(action: onRemove) {
                Text("×").font(.system(size: 16, weight: .semibold)).foregroundStyle(.red).padding(4)
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color(nsColor: .separatorColor)))
    }
}
