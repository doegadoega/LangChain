import SwiftUI

struct WorkflowScreen: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var bridge = WorkflowBridge()
    @State private var showWorkflowPicker = false

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            HSplitView {
                WorkflowCanvasView(bridge: bridge)
                WorkflowPropertiesPanel(
                    nodeData: bridge.selectedNodeData,
                    onDelete: { bridge.deleteSelectedNode() }
                )
            }
        }
        .onChange(of: appState.selectedWorkflowId) { loadSelected() }
        .onAppear { loadSelected() }
    }

    private var toolbar: some View {
        HStack(spacing: 8) {
            Button { showWorkflowPicker.toggle() } label: {
                HStack(spacing: 4) {
                    Text("🔀")
                    Text(appState.selectedWorkflow?.name ?? "ワークフロー選択")
                        .font(.system(size: 14, weight: .semibold))
                    Text("▾").foregroundStyle(.secondary)
                }
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showWorkflowPicker) { workflowPickerPopover }

            Spacer()

            Button { bridge.deleteSelectedNode() } label: {
                Text("🗑").font(.system(size: 14))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            .buttonStyle(.plain)

            Button { saveWorkflow() } label: {
                Text("📋 保存").font(.system(size: 16, weight: .semibold))
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            .buttonStyle(.plain)

            Button {} label: {
                Text("▶ このフローで実行").font(.system(size: 14, weight: .bold))
                    .padding(.horizontal, 14).padding(.vertical, 5)
                    .background(Color.accentColor).foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 6)
    }

    private var workflowPickerPopover: some View {
        VStack(spacing: 0) {
            HStack {
                Text("ワークフロー").font(.system(size: 14, weight: .bold)).foregroundStyle(.secondary)
                Spacer()
                Button {
                    appState.addWorkflow(name: "新規ワークフロー")
                    showWorkflowPicker = false
                } label: {
                    Text("+ 新規").font(.system(size: 16, weight: .semibold))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.accentColor).foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
            .padding(10)
            Divider()
            ScrollView {
                VStack(spacing: 2) {
                    ForEach(appState.workflows) { wf in
                        Button {
                            appState.selectedWorkflowId = wf.id
                            showWorkflowPicker = false
                        } label: {
                            HStack {
                                Text(wf.name).font(.system(size: 14))
                                Spacer()
                                if wf.id == appState.selectedWorkflowId {
                                    Text("使用中").font(.system(size: 14)).foregroundStyle(.blue)
                                }
                            }
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(wf.id == appState.selectedWorkflowId ? Color.accentColor.opacity(0.1) : Color.clear)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(width: 250).frame(maxHeight: 300)
        }
    }

    private func loadSelected() {
        if let workflow = appState.selectedWorkflow {
            bridge.loadWorkflow(workflow)
        }
    }

    private func saveWorkflow() {
        bridge.getWorkflowData { _ in
            guard var workflow = appState.selectedWorkflow else { return }
            workflow.updatedAt = Date()
            Task { @MainActor in
                appState.updateWorkflow(workflow)
            }
        }
    }
}
