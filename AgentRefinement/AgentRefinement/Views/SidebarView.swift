import SwiftUI

struct SidebarView: View {
    let workingDirectory: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: "folder")
                    .foregroundStyle(.blue)
                Text("Explorer")
                    .font(.system(size: 11, weight: .bold))
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)

            Divider()

            if let dir = workingDirectory {
                Text(URL(fileURLWithPath: dir).lastPathComponent)
                    .font(.system(size: 11, weight: .semibold))
                    .padding(.horizontal, 10)
                    .padding(.top, 8)

                Text("フォルダーツリー（Phase 2で実装）")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
                    .padding(.horizontal, 10)
                    .padding(.top, 4)
            } else {
                Text("案件を選択してください")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
                    .padding(10)
            }

            Spacer()
        }
        .frame(minWidth: 180, idealWidth: 200, maxWidth: 240)
    }
}
