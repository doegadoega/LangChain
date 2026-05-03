import SwiftUI

private struct OrchestrationOption: Identifiable {
    let id: String
    let title: String
    let description: String
}

private let orchestrationOptions: [OrchestrationOption] = [
    .init(
        id: "sequential",
        title: "1人ずつ順番に実行",
        description: "初めてならこの設定がおすすめです。分かりやすく順番に進みます。"
    ),
    .init(
        id: "dependency_graph",
        title: "依存関係に沿って実行",
        description: "前提タスクが終わった順に進みます。エージェント設計に慣れた方向けです。"
    ),
    .init(
        id: "role_based",
        title: "役割ごとにまとめて実行",
        description: "CEO→Manager→Worker…のグループ単位で進みます。"
    ),
]

private func orchestrationOption(for mode: String) -> OrchestrationOption {
    orchestrationOptions.first { $0.id == mode } ?? orchestrationOptions[0]
}

struct TemplatesScreen: View {
    @EnvironmentObject var appState: AppState
    @AppStorage("ui.simple_mode") private var simpleMode: Bool = true
    @State private var selectedTemplateId: UUID?

    private var selectedTemplate: OrganizationTemplate? {
        appState.templates.first { $0.id == selectedTemplateId }
    }

    private var hasDefaultTemplate: Bool {
        appState.templates.contains { $0.isPreset && $0.name == "標準チーム" }
    }

    var body: some View {
        HSplitView {
            templateList.frame(minWidth: 200, idealWidth: 220, maxWidth: 260)
            templateDetail
        }
    }

    private var templateList: some View {
        VStack(spacing: 0) {
            HStack {
                Text("チーム設定").font(.system(size: 14, weight: .bold)).foregroundStyle(.secondary)
                Spacer()
                Button {
                    selectedTemplateId = appState.installDefaultTeamPreset()
                } label: {
                    HStack(spacing: 2) {
                        Image(systemName: "sparkles")
                        Text("おすすめ設定")
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(hasDefaultTemplate ? Color.gray.opacity(0.3) : Color.green.opacity(0.8))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
                .disabled(hasDefaultTemplate)

                Button {
                    appState.addTemplate(name: "新規テンプレート")
                    selectedTemplateId = appState.templates.last?.id
                } label: {
                    HStack(spacing: 2) {
                        Image(systemName: "plus")
                        Text("新規")
                    }
                    .font(.system(size: 16, weight: .semibold))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Color.accentColor).foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
            .padding(10)
            Divider()

            ScrollView {
                LazyVStack(spacing: 2) {
                    ForEach(appState.templates) { template in
                        Button {
                            selectedTemplateId = template.id
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(template.name).font(.system(size: 14, weight: .semibold))
                                Text("\(template.slots.count)スロット · \(orchestrationOption(for: template.orchestrationMode).title)")
                                    .font(.system(size: 15)).foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                selectedTemplateId == template.id
                                    ? Color.accentColor.opacity(0.1)
                                    : Color.clear
                            )
                            .overlay(alignment: .leading) {
                                if selectedTemplateId == template.id {
                                    Rectangle().fill(Color.accentColor).frame(width: 2)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var templateDetail: some View {
        Group {
            if let template = selectedTemplate {
                TemplateDetailView(template: template)
            } else {
                VStack {
                    Text("テンプレートを選択してください")
                        .font(.system(size: 14)).foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

struct TemplateDetailView: View {
    @EnvironmentObject var appState: AppState
    @AppStorage("ui.simple_mode") private var simpleMode: Bool = true
    let template: OrganizationTemplate

    @State private var name: String = ""
    @State private var orchestrationMode: String = "sequential"
    @State private var workflowMode: String = "coding"
    @State private var rounds: Int = 1
    @State private var addSlotRole: OrgRole = .worker

    private var selectedOrchestrationOption: OrchestrationOption {
        orchestrationOption(for: orchestrationMode)
    }

    private var assignedAgentCount: Int {
        // Slot間で同じエージェントが重複しても、実人数で説明できるように重複除去する。
        Set(template.slots.flatMap(\.assignedAgentIds)).count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                headerSection
                Divider()
                settingsSection
                Divider()
                slotsSection
                Divider()
                footerButtons
            }
            .padding(16)
        }
        .onAppear { loadTemplate() }
        .onChange(of: template.id) { loadTemplate() }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField("テンプレート名", text: $name)
                .font(.system(size: 14, weight: .bold)).textFieldStyle(.plain)
            Text("作成: \(template.createdAt.formatted(.dateTime.month().day()))")
                .font(.system(size: 15)).foregroundStyle(.tertiary)
            Button {
                appState.deleteTemplate(id: template.id)
            } label: {
                Text("🗑 削除").font(.system(size: 16)).foregroundStyle(.red)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color.red.opacity(0.5)))
            }
            .buttonStyle(.plain)
        }
    }

    private var settingsSection: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("実行の進め方").font(.system(size: 15, weight: .semibold)).foregroundStyle(.secondary)
                Picker("", selection: $orchestrationMode) {
                    ForEach(orchestrationOptions) { option in
                        Text(option.title).tag(option.id)
                    }
                }
                .font(.system(size: 16))
                Text(selectedOrchestrationOption.description)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                if assignedAgentCount < 2 {
                    Text("現在の割り当ては \(assignedAgentCount) 人です。2人以上割り当てると違いが分かりやすくなります。")
                        .font(.system(size: 11))
                        .foregroundStyle(.orange)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if !simpleMode {
                VStack(alignment: .leading, spacing: 2) {
                    Text("ラウンド").font(.system(size: 15, weight: .semibold)).foregroundStyle(.secondary)
                    Picker("", selection: $rounds) {
                        ForEach(1...5, id: \.self) { n in Text("\(n)").tag(n) }
                    }
                    .font(.system(size: 16))
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("作業タイプ").font(.system(size: 15, weight: .semibold)).foregroundStyle(.secondary)
                    Picker("", selection: $workflowMode) {
                        Text("文章中心").tag("writing")
                        Text("コード作成").tag("coding")
                    }
                    .font(.system(size: 16))
                }
            }
        }
    }

    private var slotsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("スロット定義").font(.system(size: 14, weight: .bold)).foregroundStyle(.secondary)

            ForEach(template.slots) { slot in
                SlotEditor(
                    slot: slot,
                    agents: appState.agents,
                    onUpdate: { updated in
                        var t = template
                        t.slots = t.slots.map { $0.id == updated.id ? updated : $0 }
                        appState.updateTemplate(t)
                    },
                    onRemove: {
                        var t = template
                        t.slots = t.slots.filter { $0.id != slot.id }
                        appState.updateTemplate(t)
                    }
                )
            }

            HStack(spacing: 6) {
                Picker("", selection: $addSlotRole) {
                    ForEach(OrgRole.allCases) { role in
                        Text("\(role.icon) \(role.displayName)").tag(role)
                    }
                }.font(.system(size: 16))

                Button {
                    var t = template
                    t.slots.append(Slot(orgRole: addSlotRole))
                    appState.updateTemplate(t)
                } label: {
                    Text("+ 追加").font(.system(size: 16, weight: .semibold))
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(Color.accentColor).foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
            .padding(8)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [5]))
                    .foregroundStyle(.tertiary)
            )
        }
    }

    private var footerButtons: some View {
        HStack {
            Spacer()
            Button { save() } label: {
                Text("保存").font(.system(size: 14, weight: .bold))
                    .padding(.horizontal, 16).padding(.vertical, 6)
                    .background(Color.accentColor).foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)
        }
    }

    private func loadTemplate() {
        name = template.name
        orchestrationMode = template.orchestrationMode
        workflowMode = template.workflowMode
        rounds = template.rounds
    }

    private func save() {
        var updated = template
        updated.name = name
        updated.orchestrationMode = orchestrationMode
        updated.workflowMode = workflowMode
        updated.rounds = rounds
        updated.updatedAt = Date()
        appState.updateTemplate(updated)
    }
}
