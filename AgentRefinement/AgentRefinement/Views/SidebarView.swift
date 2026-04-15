import SwiftUI

struct SidebarView: View {
    let workingDirectory: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: "folder").foregroundStyle(.blue)
                Text("Explorer").font(.system(size: 11, weight: .bold)).textCase(.uppercase).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10).padding(.vertical, 8)

            Divider()

            if let dir = workingDirectory {
                Text(URL(fileURLWithPath: dir).lastPathComponent)
                    .font(.system(size: 11, weight: .semibold))
                    .padding(.horizontal, 10).padding(.top, 6)

                FileTreeView(rootPath: dir)
            } else {
                VStack {
                    Text("案件を選択してください")
                        .font(.system(size: 11)).foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(minWidth: 180, idealWidth: 200, maxWidth: 240)
    }
}
