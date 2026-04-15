import SwiftUI

struct DetailPanelView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        if let agent = appState.selectedAgent {
            AgentEditForm(agent: agent)
                .id(agent.id)
        } else {
            VStack {
                Text("エージェントを選択してください")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
            .frame(minWidth: 220, idealWidth: 260, maxWidth: 300)
        }
    }
}

struct AgentEditForm: View {
    @EnvironmentObject var appState: AppState
    let agent: MasterAgent

    @State private var name: String = ""
    @State private var orgRoles: [OrgRole] = []
    @State private var mode: AgentMode = .writer
    @State private var provider: ProviderKind = .claudeCli
    @State private var model: String = ""
    @State private var persona: String = ""
    @State private var skills: String = ""
    @State private var dependsOn: String = ""
    @State private var mcpEnabled: Bool = false
    @State private var mcpConfigPath: String = ""
    @State private var modelDecision: ModelDecision = .fixed
    @State private var showRolePicker = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                header
                actionButtons
                Divider()
                formFields
                mcpSection
                saveButton
            }
            .padding(14)
        }
        .frame(minWidth: 220, idealWidth: 260, maxWidth: 300)
        .onAppear { loadFromAgent() }
        .onChange(of: agent.id) { loadFromAgent() }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text(agent.primaryRole?.icon ?? "🤖")
                .font(.system(size: 20))
                .frame(width: 32, height: 32)
                .background(agent.primaryRole?.color.opacity(0.3) ?? Color.gray.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            VStack(alignment: .leading) {
                Text(agent.name).font(.system(size: 13, weight: .bold))
                Text("エージェント編集").font(.system(size: 9)).foregroundStyle(.tertiary)
            }
        }
    }

    private var actionButtons: some View {
        HStack(spacing: 6) {
            Button {
                appState.duplicateAgent(id: agent.id)
            } label: {
                Text("📋 複製して作成")
                    .font(.system(size: 10, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .background(Color.accentColor.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color.accentColor, lineWidth: 1))
            }
            .buttonStyle(.plain)

            Button {
                appState.deleteAgent(id: agent.id)
            } label: {
                Text("🗑 削除")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .background(Color.red.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color.red.opacity(0.5), lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }

    private var formFields: some View {
        VStack(alignment: .leading, spacing: 8) {
            fieldLabel("名前")
            TextField("", text: $name).textFieldStyle(.roundedBorder).font(.system(size: 11))

            fieldLabel("組織ロール（複数選択可）")
            roleSelector

            fieldLabel("実行モード")
            Picker("", selection: $mode) {
                ForEach(AgentMode.allCases, id: \.self) { m in Text(m.rawValue).tag(m) }
            }.pickerStyle(.segmented).font(.system(size: 10))

            fieldLabel("プロバイダー")
            Picker("", selection: $provider) {
                ForEach(ProviderKind.allCases, id: \.self) { p in Text(p.rawValue).tag(p) }
            }.font(.system(size: 11))

            fieldLabel("モデル")
            TextField("例: claude-sonnet-4-6", text: $model).textFieldStyle(.roundedBorder).font(.system(size: 11))

            fieldLabel("ペルソナ")
            TextEditor(text: $persona)
                .font(.system(size: 11))
                .frame(height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color(nsColor: .separatorColor)))

            fieldLabel("スキル（カンマ区切り）")
            TextField("例: 文章構成, 論理展開", text: $skills).textFieldStyle(.roundedBorder).font(.system(size: 11))

            fieldLabel("モデル決定")
            Picker("", selection: $modelDecision) {
                Text("fixed").tag(ModelDecision.fixed)
                Text("ceo_decides").tag(ModelDecision.ceoDecides)
            }.pickerStyle(.segmented).font(.system(size: 10))
        }
    }

    private var roleSelector: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                ForEach(orgRoles, id: \.self) { role in
                    HStack(spacing: 2) {
                        Text(role.icon).font(.system(size: 8))
                        Text(role.shortName).font(.system(size: 8, weight: .semibold))
                        Button {
                            orgRoles = orgRoles.filter { $0 != role }
                        } label: {
                            Text("×").font(.system(size: 8)).foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(role.color.opacity(0.15))
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(role.color.opacity(0.5)))
                }

                Button { showRolePicker.toggle() } label: {
                    Text("+ 追加").font(.system(size: 8))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [3])))
                }
                .buttonStyle(.plain)
            }

            if showRolePicker {
                VStack(spacing: 2) {
                    ForEach(OrgRole.allCases.filter { !orgRoles.contains($0) }) { role in
                        Button {
                            orgRoles.append(role)
                            showRolePicker = false
                        } label: {
                            HStack(spacing: 4) {
                                Text(role.icon).font(.system(size: 10))
                                Text(role.displayName).font(.system(size: 10))
                                Spacer()
                            }
                            .padding(.horizontal, 8).padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color(nsColor: .separatorColor)))
            }
        }
    }

    private var mcpSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider()
            fieldLabel("MCP設定")
            Toggle("MCP有効", isOn: $mcpEnabled).font(.system(size: 11))
            if mcpEnabled {
                fieldLabel("Config Path")
                TextField("/path/to/mcp-config.json", text: $mcpConfigPath)
                    .textFieldStyle(.roundedBorder).font(.system(size: 11))
            }
        }
    }

    private var saveButton: some View {
        Button { save() } label: {
            Text("保存")
                .font(.system(size: 12, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
        .padding(.top, 6)
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text).font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
    }

    private func loadFromAgent() {
        name = agent.name
        orgRoles = agent.orgRoles
        mode = agent.mode
        provider = agent.provider
        model = agent.model ?? ""
        persona = agent.persona ?? ""
        skills = agent.skills.joined(separator: ", ")
        dependsOn = agent.dependsOn.joined(separator: ", ")
        mcpEnabled = agent.mcpEnabled
        mcpConfigPath = agent.mcpConfigPath ?? ""
        modelDecision = agent.modelDecision
    }

    private func save() {
        let updated = MasterAgent(
            id: agent.id, name: name, orgRoles: orgRoles,
            mode: mode, provider: provider,
            model: model.isEmpty ? nil : model,
            persona: persona.isEmpty ? nil : persona,
            skills: skills.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) },
            dependsOn: dependsOn.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) },
            commandTemplate: agent.commandTemplate,
            mcpEnabled: mcpEnabled,
            mcpConfigPath: mcpConfigPath.isEmpty ? nil : mcpConfigPath,
            mcpServers: agent.mcpServers,
            mcpInstruction: agent.mcpInstruction,
            mcpContextCommand: agent.mcpContextCommand,
            mcpTimeoutSec: agent.mcpTimeoutSec,
            modelDecision: modelDecision,
            createdAt: agent.createdAt, updatedAt: Date()
        )
        appState.updateAgent(updated)
    }
}
