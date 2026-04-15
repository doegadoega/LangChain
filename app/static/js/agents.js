import { state, escapeHtml, MAX_CUSTOM_AGENTS } from "./state.js?v=5";

const LEGACY_MODE_TO_ORG_ROLE = {
  writer: "worker",
  reviewer: "qa",
  editor: "manager",
};

export function normalizeAgent(agent, index = 0) {
  const dependsOnText =
    typeof agent.depends_on_text === "string"
      ? agent.depends_on_text
      : Array.isArray(agent.depends_on)
        ? agent.depends_on.join("\n")
        : "";
  const mcpServersText =
    typeof agent.mcp_servers_text === "string"
      ? agent.mcp_servers_text
      : Array.isArray(agent.mcp_servers)
        ? agent.mcp_servers.join("\n")
        : "";
  const mcpEnabled =
    agent.mcp_enabled === true || String(agent.mcp_enabled).toLowerCase() === "true";
  const resolvedOrgRole =
    (agent.org_role && String(agent.org_role).trim()) ||
    LEGACY_MODE_TO_ORG_ROLE[String(agent.mode || "").toLowerCase()] ||
    "worker";
  return {
    id: agent.id || `agent-${index + 1}`,
    name: agent.name || `Agent ${index + 1}`,
    org_role: resolvedOrgRole,
    provider: agent.provider || "codex_cli",
    persona: agent.persona || "",
    skills_text: agent.skills_text || "",
    depends_on_text: dependsOnText,
    command_template: agent.command_template || "",
    model: agent.model || "",
    mcp_enabled: mcpEnabled ? "true" : "false",
    mcp_config_path: agent.mcp_config_path || "",
    mcp_servers_text: mcpServersText,
    mcp_instruction: agent.mcp_instruction || "",
    mcp_context_command: agent.mcp_context_command || "",
    mcp_timeout_sec: Number(agent.mcp_timeout_sec || 60),
    is_custom: Boolean(agent.is_custom),
  };
}

export function computeNextCustomIndex() {
  let max = 0;
  state.agents.forEach((agent) => {
    const match = String(agent.id).match(/^custom-(\d+)$/);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  });
  state.customIndex = max + 1;
}

export function customAgentCount() {
  return state.agents.filter((agent) => agent.is_custom).length;
}

export function renderAgents(agentListEl, addAgentBtn) {
  agentListEl.innerHTML = state.agents
    .map((agent) => {
      return `
        <div class="agent-card" data-agent-id="${agent.id}">
          <div class="agent-title">
            <span>${escapeHtml(agent.name)} ${agent.is_custom ? '<span class="tag">custom</span>' : '<span class="tag">default</span>'}</span>
            ${agent.is_custom ? '<button type="button" class="remove-btn" data-action="remove">削除</button>' : ""}
          </div>

          <div class="agent-meta">
            <label>
              名前
              <input data-field="name" value="${escapeHtml(agent.name)}" />
            </label>

            <label>
              組織ロール
              <select data-field="org_role">
                <option value="ceo" ${agent.org_role === "ceo" ? "selected" : ""}>ceo</option>
                <option value="manager" ${agent.org_role === "manager" ? "selected" : ""}>manager</option>
                <option value="worker" ${agent.org_role === "worker" ? "selected" : ""}>worker</option>
                <option value="pmo" ${agent.org_role === "pmo" ? "selected" : ""}>pmo</option>
                <option value="qa" ${agent.org_role === "qa" ? "selected" : ""}>qa</option>
                <option value="ui_designer" ${agent.org_role === "ui_designer" ? "selected" : ""}>ui_designer</option>
                <option value="system_designer" ${agent.org_role === "system_designer" ? "selected" : ""}>system_designer</option>
                <option value="ops_designer" ${agent.org_role === "ops_designer" ? "selected" : ""}>ops_designer</option>
                <option value="other" ${agent.org_role === "other" ? "selected" : ""}>other</option>
              </select>
            </label>

            <label>
              Provider
              <select data-field="provider">
                <option value="gemini_cli" ${agent.provider === "gemini_cli" ? "selected" : ""}>gemini_cli</option>
                <option value="claude_cli" ${agent.provider === "claude_cli" ? "selected" : ""}>claude_cli</option>
                <option value="codex_cli" ${agent.provider === "codex_cli" ? "selected" : ""}>codex_cli</option>
                <option value="custom_cli" ${agent.provider === "custom_cli" ? "selected" : ""}>custom_cli</option>
              </select>
            </label>

            <label>
              model(任意)
              <input data-field="model" value="${escapeHtml(agent.model || "")}" placeholder="例: gpt-5.3-codex" />
            </label>
          </div>

          <label>
            ペルソナ
            <textarea data-field="persona" rows="2">${escapeHtml(agent.persona || "")}</textarea>
          </label>

          <label>
            スキル(改行またはカンマ区切り)
            <textarea data-field="skills_text" rows="2">${escapeHtml(agent.skills_text || "")}</textarea>
          </label>

          <label>
            depends_on (エージェントID。改行またはカンマ区切り)
            <textarea data-field="depends_on_text" rows="2" placeholder="例: manager,qa-1">${escapeHtml(agent.depends_on_text || "")}</textarea>
          </label>

          <label>
            command_template (custom_cli時に必須)
            <input data-field="command_template" value="${escapeHtml(agent.command_template || "")}" placeholder="例: codex exec {prompt}" />
          </label>

          <details class="agent-mcp-block">
            <summary>MCP設定</summary>
            <div class="agent-meta">
              <label>
                MCP有効
                <select data-field="mcp_enabled">
                  <option value="false" ${String(agent.mcp_enabled) === "false" ? "selected" : ""}>OFF</option>
                  <option value="true" ${String(agent.mcp_enabled) === "true" ? "selected" : ""}>ON</option>
                </select>
              </label>
              <label>
                MCP timeout(sec)
                <input data-field="mcp_timeout_sec" type="number" min="5" max="600" value="${Number(agent.mcp_timeout_sec || 60)}" />
              </label>
            </div>

            <label>
              mcp_config_path (任意)
              <input data-field="mcp_config_path" value="${escapeHtml(agent.mcp_config_path || "")}" placeholder="例: /Users/you/.mcp/config.json" />
            </label>

            <label>
              mcp_servers (改行またはカンマ区切り)
              <textarea data-field="mcp_servers_text" rows="2" placeholder="例: github&#10;figma">${escapeHtml(agent.mcp_servers_text || "")}</textarea>
            </label>

            <label>
              mcp_context_command (任意)
              <input data-field="mcp_context_command" value="${escapeHtml(agent.mcp_context_command || "")}" placeholder="例: mcp-client query --servers {mcp_servers_csv} --prompt {prompt}" />
            </label>

            <label>
              mcp_instruction (任意)
              <textarea data-field="mcp_instruction" rows="2" placeholder="例: まずGitHub issueとPR差分を確認してから提案する">${escapeHtml(agent.mcp_instruction || "")}</textarea>
            </label>
          </details>
        </div>
      `;
    })
    .join("");

  addAgentBtn.disabled = customAgentCount() >= MAX_CUSTOM_AGENTS;
}

export function syncStateFromDom() {
  const cards = document.querySelectorAll(".agent-card");
  cards.forEach((card) => {
    const agentId = card.getAttribute("data-agent-id");
    const agent = state.agents.find((item) => item.id === agentId);
    if (!agent) {
      return;
    }

    card.querySelectorAll("[data-field]").forEach((el) => {
      const field = el.getAttribute("data-field");
      agent[field] = el.value;
    });
  });
}

export function addCustomAgent(agentListEl, addAgentBtn) {
  if (customAgentCount() >= MAX_CUSTOM_AGENTS) {
    alert(`追加できるcustom agentは最大${MAX_CUSTOM_AGENTS}人です。`);
    return;
  }

  const idx = state.customIndex++;
  state.agents.push({
    id: `custom-${idx}`,
    name: `Custom ${idx}`,
    org_role: "worker",
    provider: "codex_cli",
    persona: "専門観点で改善点を指摘する。",
    skills_text: "",
    depends_on_text: "",
    command_template: "",
    model: "",
    mcp_enabled: "false",
    mcp_config_path: "",
    mcp_servers_text: "",
    mcp_instruction: "",
    mcp_context_command: "",
    mcp_timeout_sec: 60,
    is_custom: true,
  });
  renderAgents(agentListEl, addAgentBtn);
}

export function removeAgent(agentId, agentListEl, addAgentBtn) {
  state.agents = state.agents.filter((agent) => agent.id !== agentId);
  computeNextCustomIndex();
  renderAgents(agentListEl, addAgentBtn);
}
