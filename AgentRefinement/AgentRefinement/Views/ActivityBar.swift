import SwiftUI

struct ActivityBar: View {
    @Binding var selectedProjectId: UUID?
    let projects: [Project]
    let onAddProject: () -> Void

    var body: some View {
        VStack(spacing: 4) {
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
    }
}
