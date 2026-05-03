import SwiftUI

private enum ProjectCreationStep: Int, CaseIterable {
    case basic = 0
    case requirements = 1
    case organization = 2

    var title: String {
        switch self {
        case .basic: "案件情報"
        case .requirements: "要件"
        case .organization: "組織"
        }
    }
}

struct NewProjectSheet: View {
    @EnvironmentObject var appState: AppState
    @Binding var isPresented: Bool
    @AppStorage("ui.simple_mode") private var simpleMode: Bool = true

    @State private var step: ProjectCreationStep = .basic
    @State private var projectName = ""
    @State private var workingDirectory = ""
    @State private var requirementsText = ""
    @State private var selectedTemplateId: UUID?
    @State private var defaultAgentsBySlotId: [UUID: String] = [:]
    @State private var runAfterCreate = true

    private var selectedTemplate: OrganizationTemplate? {
        guard let selectedTemplateId else { return nil }
        return appState.templates.first { $0.id == selectedTemplateId }
    }

    private var canContinueFromBasic: Bool {
        !projectName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !workingDirectory.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var hasExecutableRequirements: Bool {
        !requirementsText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canFinish: Bool {
        canContinueFromBasic && (!runAfterCreate || hasExecutableRequirements)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            stepContent
            Spacer()
            footerButtons
        }
        .padding(20)
        .frame(width: 620, height: 520)
        .onAppear {
            guard selectedTemplateId == nil else { return }
            applyAutomationPrefillIfNeeded()
            selectedTemplateId = appState.templates.first(where: \.isPreset)?.id
            syncDefaultAgentsWithTemplate(clearPrevious: true)
        }
        .onChange(of: selectedTemplateId) {
            syncDefaultAgentsWithTemplate(clearPrevious: true)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("新規案件セットアップ")
                .font(.system(size: 20, weight: .bold))

            HStack(spacing: 8) {
                ForEach(ProjectCreationStep.allCases, id: \.rawValue) { current in
                    HStack(spacing: 6) {
                        Text("\(current.rawValue + 1)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(step.rawValue >= current.rawValue ? .white : .secondary)
                            .frame(width: 18, height: 18)
                            .background(step.rawValue >= current.rawValue ? Color.accentColor : Color.gray.opacity(0.3))
                            .clipShape(Circle())
                        Text(current.title)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(step == current ? .primary : .secondary)
                    }
                    if current != .organization {
                        Rectangle()
                            .fill(step.rawValue > current.rawValue ? Color.accentColor : Color.gray.opacity(0.25))
                            .frame(width: 22, height: 1)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case .basic:
            basicStepView
        case .requirements:
            requirementsStepView
        case .organization:
            organizationStepView
        }
    }

    private var basicStepView: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("案件名")
                    .font(.system(size: 14, weight: .semibold))
                TextField("例: MyProject", text: $projectName)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("new_project.name")
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("作業ディレクトリ")
                    .font(.system(size: 14, weight: .semibold))
                HStack(spacing: 6) {
                    TextField("/path/to/project", text: $workingDirectory)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("new_project.working_directory")
                    Button("📂 選択") { selectDirectory() }
                }
            }
        }
    }

    private var requirementsStepView: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("要件を入力")
                .font(.system(size: 14, weight: .semibold))
            TextEditor(text: $requirementsText)
                .font(.system(size: 13))
                .padding(8)
                .background(Color(nsColor: .textBackgroundColor))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(Color(nsColor: .separatorColor))
                )
                .accessibilityIdentifier("new_project.requirements")

            Text("作成後にそのまま実行する場合は、ここで要件を入力してください。")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }
    }

    private var organizationStepView: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                Text(simpleMode ? "チーム設定（おすすめのままでOK）" : "組織テンプレート")
                    .font(.system(size: 14, weight: .semibold))
                Picker("", selection: $selectedTemplateId) {
                    Text("なし").tag(nil as UUID?)
                    ForEach(appState.templates) { template in
                        Text(template.name).tag(template.id as UUID?)
                    }
                }
                .pickerStyle(.menu)
                .accessibilityIdentifier("new_project.template")
            }

            if simpleMode {
                Text("標準チームなら、そのまま「次へ」で問題ありません。")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            } else if let template = selectedTemplate {
                Text("デフォルトエージェント")
                    .font(.system(size: 14, weight: .semibold))

                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(template.slots) { slot in
                            HStack(spacing: 10) {
                                Text(slot.orgRole.icon)
                                    .font(.system(size: 16))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(slot.orgRole.displayName)
                                        .font(.system(size: 13, weight: .semibold))
                                    Text(slot.required ? "必須スロット" : "任意スロット")
                                        .font(.system(size: 11))
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()

                                Picker("", selection: slotSelectionBinding(slot)) {
                                    Text("未指定").tag("")
                                    ForEach(matchingAgents(for: slot.orgRole)) { agent in
                                        Text(agent.name).tag(agent.id)
                                    }
                                }
                                .frame(width: 220)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    .padding(.vertical, 2)
                }
                .frame(maxHeight: 210)
            } else {
                Text("テンプレートを指定しない場合は、既存エージェント全体で実行されます。")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }

            Toggle("作成後すぐに実行する", isOn: $runAfterCreate)
                .font(.system(size: 13, weight: .medium))
                .accessibilityIdentifier("new_project.run_after_create")
        }
    }

    private var footerButtons: some View {
        HStack {
            Button("キャンセル") { isPresented = false }
                .keyboardShortcut(.cancelAction)
                .accessibilityIdentifier("new_project.cancel")

            Spacer()

            if step.rawValue > 0 {
                Button("戻る") {
                    step = ProjectCreationStep(rawValue: step.rawValue - 1) ?? .basic
                }
                .accessibilityIdentifier("new_project.back")
            }

            if step != .organization {
                Button("次へ") {
                    step = ProjectCreationStep(rawValue: step.rawValue + 1) ?? .organization
                }
                .keyboardShortcut(.defaultAction)
                .disabled(step == .basic && !canContinueFromBasic)
                .accessibilityIdentifier("new_project.next")
            } else {
                Button(runAfterCreate ? "作成して実行" : "作成") {
                    submit()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!canFinish)
                .accessibilityIdentifier("new_project.submit")
            }
        }
    }

    private func submit() {
        let trimmedName = projectName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDirectory = workingDirectory.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedRequirements = requirementsText.trimmingCharacters(in: .whitespacesAndNewlines)

        if let updatedTemplate = appState.templateCopyApplyingDefaultAgents(
            templateId: selectedTemplateId,
            defaultAgentsBySlotId: defaultAgentsBySlotId
        ) {
            appState.updateTemplate(updatedTemplate)
        }

        appState.addProject(
            name: trimmedName,
            workingDirectory: trimmedDirectory,
            templateId: selectedTemplateId,
            requirements: trimmedRequirements
        )

        if runAfterCreate && !trimmedRequirements.isEmpty {
            appState.queueRequirementsRun(trimmedRequirements)
        }

        isPresented = false
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

    private func matchingAgents(for role: OrgRole) -> [MasterAgent] {
        appState.agents.filter { $0.orgRoles.contains(role) }
    }

    private func slotSelectionBinding(_ slot: Slot) -> Binding<String> {
        Binding(
            get: { defaultAgentsBySlotId[slot.id] ?? "" },
            set: { newValue in
                defaultAgentsBySlotId[slot.id] = newValue.isEmpty ? nil : newValue
            }
        )
    }

    private func syncDefaultAgentsWithTemplate(clearPrevious: Bool) {
        guard let template = selectedTemplate else {
            if clearPrevious {
                defaultAgentsBySlotId = [:]
            }
            return
        }

        var nextAssignments: [UUID: String] = clearPrevious ? [:] : defaultAgentsBySlotId
        for slot in template.slots {
            if let assigned = slot.assignedAgentIds.first {
                nextAssignments[slot.id] = assigned
                continue
            }
            if let candidate = matchingAgents(for: slot.orgRole).first {
                nextAssignments[slot.id] = candidate.id
            }
        }
        defaultAgentsBySlotId = nextAssignments
    }

    private func applyAutomationPrefillIfNeeded() {
        let env = ProcessInfo.processInfo.environment
        if let value = env["AGENT_REFINEMENT_E2E_PROJECT_NAME"], !value.isEmpty {
            projectName = value
        }
        if let value = env["AGENT_REFINEMENT_E2E_WORKDIR"], !value.isEmpty {
            workingDirectory = value
        }
        if let value = env["AGENT_REFINEMENT_E2E_REQUIREMENTS"], !value.isEmpty {
            requirementsText = value
        }
    }
}
