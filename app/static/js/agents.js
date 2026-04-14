import { state, escapeHtml, MAX_CUSTOM_AGENTS } from "./state.js?v=3";

export function normalizeAgent(agent, index = 0) {
  const dependsOnText =
    typeof agent.depends_on_text === "string"
      ? agent.depends_on_text
      : Array.isArray(agent.depends_on)
        ? agent.depends_on.join("\n")
        : "";
  return {
    id: agent.id || `agent-${index + 1}`,
    name: agent.name || `Agent ${index + 1}`,
    mode: agent.mode || "reviewer",
    provider: agent.provider || "codex_cli",
    persona: agent.persona || "",
    skills_text: agent.skills_text || "",
    depends_on_text: dependsOnText,
    command_template: agent.command_template || "",
    model: agent.model || "",
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
              役割
              <select data-field="mode">
                <option value="writer" ${agent.mode === "writer" ? "selected" : ""}>writer</option>
                <option value="reviewer" ${agent.mode === "reviewer" ? "selected" : ""}>reviewer</option>
                <option value="editor" ${agent.mode === "editor" ? "selected" : ""}>editor</option>
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
            <textarea data-field="depends_on_text" rows="2" placeholder="例: critic,editor">${escapeHtml(agent.depends_on_text || "")}</textarea>
          </label>

          <label>
            command_template (custom_cli時に必須)
            <input data-field="command_template" value="${escapeHtml(agent.command_template || "")}" placeholder="例: codex exec {prompt}" />
          </label>
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
    mode: "reviewer",
    provider: "codex_cli",
    persona: "専門観点で改善点を指摘する。",
    skills_text: "",
    depends_on_text: "",
    command_template: "",
    model: "",
    is_custom: true,
  });
  renderAgents(agentListEl, addAgentBtn);
}

export function removeAgent(agentId, agentListEl, addAgentBtn) {
  state.agents = state.agents.filter((agent) => agent.id !== agentId);
  computeNextCustomIndex();
  renderAgents(agentListEl, addAgentBtn);
}
