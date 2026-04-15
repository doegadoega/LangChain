import SwiftUI

struct TemplatesScreen: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTemplateId: UUID?

    private var selectedTemplate: OrganizationTemplate? {
        appState.templates.first { $0.id == selectedTemplateId }
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
                Text("テンプレート").font(.system(size: 14, weight: .bold)).foregroundStyle(.secondary)
                Spacer()
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
                                Text("\(template.slots.count)スロット · \(template.orchestrationMode)")
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
    let template: OrganizationTemplate

    @State private var name: String = ""
    @State private var orchestrationMode: String = "sequential"
    @State private var workflowMode: String = "coding"
    @State private var rounds: Int = 1
    @State private var addSlotRole: OrgRole = .worker

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
                Text("オーケストレーション").font(.system(size: 15, weight: .semibold)).foregroundStyle(.secondary)
                Picker("", selection: $orchestrationMode) {
                    Text("sequential").tag("sequential")
                    Text("dependency_graph").tag("dependency_graph")
                    Text("role_based").tag("role_based")
                }.font(.system(size: 16))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("ラウンド").font(.system(size: 15, weight: .semibold)).foregroundStyle(.secondary)
                Picker("", selection: $rounds) {
                    ForEach(1...5, id: \.self) { n in Text("\(n)").tag(n) }
                }.font(.system(size: 16))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("モード").font(.system(size: 15, weight: .semibold)).foregroundStyle(.secondary)
                Picker("", selection: $workflowMode) {
                    Text("writing").tag("writing")
                    Text("coding").tag("coding")
                }.font(.system(size: 16))
            }
        }
    }

    private var slotsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("スロット定義").font(.system(size: 14, weight: .bold)).foregroundStyle(.secondary)

            ForEach(template.slots) { slot in
                SlotEditor(slot: slot) {
                    var t = template
                    t.slots = t.slots.filter { $0.id != slot.id }
                    appState.updateTemplate(t)
                }
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
