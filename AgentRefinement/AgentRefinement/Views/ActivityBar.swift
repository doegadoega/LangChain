import SwiftUI

struct ActivityBar: View {
    @EnvironmentObject var appState: AppState
    @Binding var selectedProjectId: UUID?
    let projects: [Project]
    let onAddProject: () -> Void
    let onRenameProject: (Project, String) -> Void

    @State private var renamingProject: Project?
    @State private var renameText = ""
    @State private var deletingProject: Project?

    var body: some View {
        VStack(spacing: 4) {
            Group {
                ForEach(projects) { project in
                    Button {
                        selectedProjectId = project.id
                    } label: {
                        Text(String(project.name.prefix(1)))
                            .font(.system(size: 14, weight: .bold))
                            .frame(width: 34, height: 34)
                            .background(
                                selectedProjectId == project.id
                                    ? Color.accentColor.opacity(0.2)
                                    : Color.clear
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                    .help(project.name)
                    .contextMenu {
                        Button("リネーム") {
                            renamingProject = project
                            renameText = project.name
                        }
                        Divider()
                        Button("削除", role: .destructive) {
                            deletingProject = project
                        }
                    }
                }
            }
            .alert("リネーム", isPresented: Binding(
                get: { renamingProject != nil },
                set: { if !$0 { renamingProject = nil } }
            )) {
                TextField("プロジェクト名", text: $renameText)
                Button("変更") {
                    if let p = renamingProject { onRenameProject(p, renameText) }
                    renamingProject = nil
                }
                Button("キャンセル", role: .cancel) { renamingProject = nil }
            }

            Spacer()

            Button(action: onAddProject) {
                Image(systemName: "plus")
                    .font(.system(size: 14))
                    .frame(width: 34, height: 34)
            }
            .buttonStyle(.plain)
            .help("新規案件")

            Divider()

            Button {} label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 14))
                    .frame(width: 34, height: 34)
                    .opacity(0.6)
            }
            .buttonStyle(.plain)
            .help("設定")
        }
        .padding(.top, 8)
        .padding(.bottom, 8)
        .frame(width: 48)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
        .alert("削除の確認", isPresented: Binding(
            get: { deletingProject != nil },
            set: { if !$0 { deletingProject = nil } }
        )) {
            Button("削除", role: .destructive) {
                if let p = deletingProject { appState.deleteProject(id: p.id) }
                deletingProject = nil
            }
            Button("キャンセル", role: .cancel) { deletingProject = nil }
        } message: {
            if let p = deletingProject {
                Text("「\(p.name)」を削除しますか？")
            }
        }
    }
}
