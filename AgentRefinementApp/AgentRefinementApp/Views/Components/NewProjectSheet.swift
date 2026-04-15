import SwiftUI

struct NewProjectSheet: View {
    @EnvironmentObject var appState: AppState
    @Binding var isPresented: Bool

    @State private var projectName = ""
    @State private var workingDirectory = ""

    private var canCreate: Bool {
        !projectName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !workingDirectory.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("新規案件").font(.headline)

            VStack(alignment: .leading, spacing: 6) {
                Text("案件名").font(.system(size: 12, weight: .medium))
                TextField("例: MyProject", text: $projectName)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("作業ディレクトリ").font(.system(size: 12, weight: .medium))
                HStack(spacing: 6) {
                    TextField("/path/to/project", text: $workingDirectory)
                        .textFieldStyle(.roundedBorder)
                    Button("📂 選択") { selectDirectory() }
                }
            }

            Spacer()

            HStack {
                Button("キャンセル") { isPresented = false }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("作成") {
                    appState.addProject(
                        name: projectName.trimmingCharacters(in: .whitespaces),
                        workingDirectory: workingDirectory.trimmingCharacters(in: .whitespaces)
                    )
                    isPresented = false
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!canCreate)
            }
        }
        .padding(20)
        .frame(width: 420, height: 220)
    }

    private func selectDirectory() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = true
        panel.prompt = "選択"
        panel.begin { response in
            if response == .OK, let url = panel.url {
                workingDirectory = url.path
            }
        }
    }
}
