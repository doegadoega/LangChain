import SwiftUI

struct WorkflowPropertiesPanel: View {
    let nodeData: [String: Any]?
    let onDelete: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                if let data = nodeData {
                    nodeProperties(data)
                } else {
                    Text("ノードを選択してください")
                        .font(.system(size: 11)).foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .padding(12)
        }
        .frame(width: 220)
    }

    private func nodeProperties(_ data: [String: Any]) -> some View {
        let type = data["type"] as? String ?? "unknown"
        let label = data["label"] as? String ?? ""

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(nodeIcon(type)).font(.system(size: 16))
                VStack(alignment: .leading) {
                    Text(label).font(.system(size: 12, weight: .bold))
                    Text(type).font(.system(size: 9)).foregroundStyle(.tertiary)
                }
            }
            Divider()
            Text("ノードタイプ: \(type)").font(.system(size: 10)).foregroundStyle(.secondary)
            if let x = data["x"] as? Double, let y = data["y"] as? Double {
                Text("位置: (\(Int(x)), \(Int(y)))").font(.system(size: 10)).foregroundStyle(.secondary)
            }
            Divider()
            Button(action: onDelete) {
                Text("🗑 ノードを削除").font(.system(size: 10, weight: .semibold)).foregroundStyle(.red)
                    .frame(maxWidth: .infinity).padding(.vertical, 5)
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color.red.opacity(0.5)))
            }
            .buttonStyle(.plain)
        }
    }

    private func nodeIcon(_ type: String) -> String {
        ["start": "▶", "end": "⏹", "slot": "📦", "gate": "⛩", "loop": "🔁", "fork": "⑃", "join": "⑃"][type] ?? "📦"
    }
}
