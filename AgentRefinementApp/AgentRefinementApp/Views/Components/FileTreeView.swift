import SwiftUI

struct FileNode: Identifiable {
    let id = UUID()
    let name: String
    let path: String
    let isDirectory: Bool
    var children: [FileNode]
}

struct FileTreeView: View {
    let rootPath: String
    @State private var rootNodes: [FileNode] = []

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(rootNodes) { node in
                    FileTreeRow(node: node, depth: 0)
                }
            }
            .padding(.vertical, 4)
        }
        .onAppear { loadTree() }
        .onChange(of: rootPath) { _, _ in
            // Switching projects updates only rootPath, so reload explicitly.
            loadTree()
        }
    }

    private func loadTree() {
        let url = URL(fileURLWithPath: rootPath)
        rootNodes = loadChildren(at: url, maxDepth: 3, currentDepth: 0)
    }

    private func loadChildren(at url: URL, maxDepth: Int, currentDepth: Int) -> [FileNode] {
        guard currentDepth < maxDepth else { return [] }
        let fm = FileManager.default
        guard let items = try? fm.contentsOfDirectory(
            at: url, includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }

        return items.sorted { a, b in
            let aIsDir = (try? a.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
            let bIsDir = (try? b.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
            if aIsDir != bIsDir { return aIsDir }
            return a.lastPathComponent.localizedCaseInsensitiveCompare(b.lastPathComponent) == .orderedAscending
        }.map { item in
            let isDir = (try? item.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
            let children = isDir ? loadChildren(at: item, maxDepth: maxDepth, currentDepth: currentDepth + 1) : []
            return FileNode(name: item.lastPathComponent, path: item.path, isDirectory: isDir, children: children)
        }
    }
}

struct FileTreeRow: View {
    let node: FileNode
    let depth: Int
    @State private var isExpanded: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                if node.isDirectory { isExpanded.toggle() }
            } label: {
                HStack(spacing: 4) {
                    if node.isDirectory {
                        Text(isExpanded ? "▼" : "▶").font(.system(size: 14)).foregroundStyle(.tertiary).frame(width: 10)
                    } else {
                        Spacer().frame(width: 10)
                    }
                    Text(node.isDirectory ? "📂" : "📄").font(.system(size: 16))
                    Text(node.name).font(.system(size: 14))
                        .foregroundStyle(node.isDirectory ? Color.primary : Color.blue)
                        .lineLimit(1)
                }
                .padding(.leading, CGFloat(depth * 14) + 6)
                .padding(.vertical, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded && node.isDirectory {
                ForEach(node.children) { child in
                    FileTreeRow(node: child, depth: depth + 1)
                }
            }
        }
    }
}
