const MAX_CUSTOM_AGENTS = 5;
const PROFILE_STORAGE_KEY = "agent_refinement_profiles_v1";
const DEFAULT_PRESET_ID = "writing_refine";

const BUILTIN_PRESETS = [
  {
    id: "writing_refine",
    name: "文章推敲チーム",
    workflow_mode: "writing",
    code_context: {},
    objective: "読み手に通る文章にする",
    global_instruction: "前置きなしで本文だけ出力。曖昧表現を減らす。",
    rounds: 1,
    agents: [
      {
        id: "drafter",
        name: "Drafter",
        mode: "writer",
        provider: "codex_cli",
        persona: "論点を整理し、目的達成に必要な骨子を作る。",
        skills_text: "構成設計\n要約\n明確化",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "critic",
        name: "Critic",
        mode: "reviewer",
        provider: "codex_cli",
        persona: "厳しめのレビュー担当。曖昧さ、冗長さ、根拠不足を指摘する。",
        skills_text: "論理性チェック\n曖昧表現の削減\n読み手目線レビュー",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "editor",
        name: "Editor",
        mode: "editor",
        provider: "codex_cli",
        persona: "全指摘を統合し、最終版として自然で通る文章に仕上げる。",
        skills_text: "統合推敲\nトーン調整\n最終品質確認",
        command_template: "",
        model: "",
        is_custom: false,
      },
    ],
  },
  {
    id: "architecture_review",
    name: "設計レビュー組織",
    workflow_mode: "coding",
    code_context: {
      repository: "",
      target_paths: [],
      tech_stack: "既存アーキテクチャに準拠し、運用性とセキュリティを重視する。",
      acceptance_criteria:
        "1) 構成要素が明確 2) 主要リスクと対策が明記 3) 次に実装へ移せる具体度",
      test_command: "",
    },
    objective: "要件を満たす設計案を作り、リスクとトレードオフを可視化する",
    global_instruction:
      "出力は 1)設計概要 2)主要コンポーネント 3)データフロー 4)リスクと対策 の順で簡潔に。",
    rounds: 2,
    agents: [
      {
        id: "architect",
        name: "Architect",
        mode: "writer",
        provider: "codex_cli",
        persona: "要件から全体アーキテクチャ案を組み立てる。",
        skills_text: "アーキテクチャ設計\n分割統治\n技術選定",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "scalability",
        name: "Scalability Reviewer",
        mode: "reviewer",
        provider: "codex_cli",
        persona: "負荷・拡張性・運用性の穴を見つける。",
        skills_text: "スケーラビリティ\nSLO/SLI\n可観測性",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "security",
        name: "Security Reviewer",
        mode: "reviewer",
        provider: "claude_cli",
        persona: "脅威モデル観点で設計の弱点を指摘する。",
        skills_text: "脅威分析\n権限設計\n監査ログ",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "design_editor",
        name: "Design Editor",
        mode: "editor",
        provider: "codex_cli",
        persona: "設計案とレビューを統合し、意思決定しやすい最終版へまとめる。",
        skills_text: "意思決定資料化\nトレードオフ明文化\n要点整理",
        command_template: "",
        model: "",
        is_custom: false,
      },
    ],
  },
  {
    id: "coding_delivery",
    name: "実装デリバリーチーム",
    workflow_mode: "coding",
    code_context: {
      repository: "",
      target_paths: [],
      tech_stack: "",
      acceptance_criteria: "",
      test_command: "",
    },
    objective: "実装方針・品質観点・受け入れ条件を揃えて、実装に着手できる状態にする",
    global_instruction:
      "実装対象、変更方針、レビュー観点、テスト観点を明示。曖昧なTODOを残さない。",
    rounds: 2,
    agents: [
      {
        id: "impl_planner",
        name: "Implementation Planner",
        mode: "writer",
        provider: "codex_cli",
        persona: "実装の段取りと変更方針を作成する。",
        skills_text: "タスク分解\n依存関係整理\n実装計画",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "code_reviewer",
        name: "Code Reviewer",
        mode: "reviewer",
        provider: "claude_cli",
        persona: "バグやリグレッションを優先して指摘する。",
        skills_text: "不具合検知\nリスク評価\n保守性レビュー",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "qa_reviewer",
        name: "QA Reviewer",
        mode: "reviewer",
        provider: "codex_cli",
        persona: "テスト不足と受け入れ条件の漏れを指摘する。",
        skills_text: "テスト設計\n境界値\n受け入れ基準",
        command_template: "",
        model: "",
        is_custom: false,
      },
      {
        id: "release_editor",
        name: "Release Editor",
        mode: "editor",
        provider: "codex_cli",
        persona: "最終的に実装指示として実行可能な文章へ整える。",
        skills_text: "統合編集\n実行可能性確認\nリリース観点",
        command_template: "",
        model: "",
        is_custom: false,
      },
    ],
  },
];

const state = {
  agents: [],
  customIndex: 1,
  savedProfiles: [],
};

const agentListEl = document.getElementById("agentList");
const addAgentBtn = document.getElementById("addAgentBtn");
const formEl = document.getElementById("refineForm");
const runBtn = document.getElementById("runBtn");
const statusEl = document.getElementById("status");
const finalTextEl = document.getElementById("finalText");
const diffTextEl = document.getElementById("diffText");
const roundLogEl = document.getElementById("roundLog");
const workflowModeEl = document.getElementById("workflowMode");
const codingFieldsEl = document.getElementById("codingFields");
const repoNameEl = document.getElementById("repoName");
const targetPathsEl = document.getElementById("targetPaths");
const techStackEl = document.getElementById("techStack");
const acceptanceCriteriaEl = document.getElementById("acceptanceCriteria");
const testCommandEl = document.getElementById("testCommand");
const screenPanels = Array.from(document.querySelectorAll(".screen-panel"));
const viewTabButtons = Array.from(document.querySelectorAll(".view-tab"));

const presetSelectEl = document.getElementById("presetSelect");
const applyPresetBtn = document.getElementById("applyPresetBtn");
const profileNameInput = document.getElementById("profileNameInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const savedProfileSelectEl = document.getElementById("savedProfileSelect");
const loadProfileBtn = document.getElementById("loadProfileBtn");
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const toRunFromTeamBtn = document.getElementById("toRunFromTeam");
const toTeamFromRunBtn = document.getElementById("toTeamFromRun");
const toResultFromRunBtn = document.getElementById("toResultFromRun");
const toTeamFromResultBtn = document.getElementById("toTeamFromResult");
const toRunFromResultBtn = document.getElementById("toRunFromResult");

let liveRunState = null;

function setActiveScreen(screenName) {
  screenPanels.forEach((panel) => {
    const active = panel.dataset.screen === screenName;
    panel.classList.toggle("is-active", active);
  });
  viewTabButtons.forEach((btn) => {
    const active = btn.dataset.screen === screenName;
    btn.classList.toggle("is-active", active);
  });
}

function clone(value) {
  return structuredClone(value);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(message, kind = "") {
  statusEl.className = "status";
  if (kind) {
    statusEl.classList.add(kind);
  }
  statusEl.textContent = message;
}

function parseSkills(skillsText) {
  return (skillsText || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDelimitedList(rawValue) {
  return (rawValue || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function syncCodingFieldsVisibility() {
  const isCoding = workflowModeEl.value === "coding";
  codingFieldsEl.hidden = !isCoding;
}

function normalizeAgent(agent, index = 0) {
  return {
    id: agent.id || `agent-${index + 1}`,
    name: agent.name || `Agent ${index + 1}`,
    mode: agent.mode || "reviewer",
    provider: agent.provider || "codex_cli",
    persona: agent.persona || "",
    skills_text: agent.skills_text || "",
    command_template: agent.command_template || "",
    model: agent.model || "",
    is_custom: Boolean(agent.is_custom),
  };
}

function computeNextCustomIndex() {
  let max = 0;
  state.agents.forEach((agent) => {
    const match = String(agent.id).match(/^custom-(\d+)$/);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  });
  state.customIndex = max + 1;
}

function customAgentCount() {
  return state.agents.filter((agent) => agent.is_custom).length;
}

function renderAgents() {
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
            command_template (custom_cli時に必須)
            <input data-field="command_template" value="${escapeHtml(agent.command_template || "")}" placeholder="例: codex exec {prompt}" />
          </label>
        </div>
      `;
    })
    .join("");

  addAgentBtn.disabled = customAgentCount() >= MAX_CUSTOM_AGENTS;
}

function syncStateFromDom() {
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

function addCustomAgent() {
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
    command_template: "",
    model: "",
    is_custom: true,
  });
  renderAgents();
}

function removeAgent(agentId) {
  state.agents = state.agents.filter((agent) => agent.id !== agentId);
  computeNextCustomIndex();
  renderAgents();
}

function applyConfig(config) {
  const objectiveEl = document.getElementById("objective");
  const globalInstructionEl = document.getElementById("globalInstruction");
  const roundsEl = document.getElementById("rounds");
  const mode = config.workflow_mode || "writing";
  const codeContext = config.code_context || {};

  objectiveEl.value = config.objective || "";
  globalInstructionEl.value = config.global_instruction || "";
  roundsEl.value = String(config.rounds || 1);
  workflowModeEl.value = mode;
  repoNameEl.value = codeContext.repository || "";
  targetPathsEl.value = Array.isArray(codeContext.target_paths)
    ? codeContext.target_paths.join("\n")
    : "";
  techStackEl.value = codeContext.tech_stack || "";
  acceptanceCriteriaEl.value = codeContext.acceptance_criteria || "";
  testCommandEl.value = codeContext.test_command || "";
  syncCodingFieldsVisibility();

  state.agents = (config.agents || []).map((agent, index) => normalizeAgent(agent, index));
  computeNextCustomIndex();
  renderAgents();
}

function captureCurrentConfig() {
  syncStateFromDom();
  return {
    workflow_mode: workflowModeEl.value || "writing",
    objective: document.getElementById("objective").value,
    global_instruction: document.getElementById("globalInstruction").value,
    code_context: {
      repository: repoNameEl.value || "",
      target_paths: parseDelimitedList(targetPathsEl.value),
      tech_stack: techStackEl.value || "",
      acceptance_criteria: acceptanceCriteriaEl.value || "",
      test_command: testCommandEl.value || "",
    },
    rounds: Number(document.getElementById("rounds").value || 1),
    agents: state.agents.map((agent) => ({ ...agent })),
  };
}

function getPresetById(presetId) {
  return BUILTIN_PRESETS.find((preset) => preset.id === presetId) || null;
}

function renderPresetOptions() {
  presetSelectEl.innerHTML = BUILTIN_PRESETS.map(
    (preset) => `<option value="${preset.id}">${escapeHtml(preset.name)}</option>`,
  ).join("");
  presetSelectEl.value = DEFAULT_PRESET_ID;
}

function applyPreset(presetId) {
  const preset = getPresetById(presetId);
  if (!preset) {
    return;
  }

  applyConfig({
    workflow_mode: preset.workflow_mode || "writing",
    code_context: clone(preset.code_context || {}),
    objective: preset.objective,
    global_instruction: preset.global_instruction,
    rounds: preset.rounds,
    agents: clone(preset.agents),
  });
  setStatus(`テンプレート適用: ${preset.name}`, "ok");
}

function loadSavedProfiles() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      state.savedProfiles = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      state.savedProfiles = [];
      return;
    }

    state.savedProfiles = parsed
      .filter((item) => item && typeof item === "object" && item.id && item.name)
      .map((item) => ({
        id: String(item.id),
        name: String(item.name),
        config: item.config || null,
      }));
  } catch {
    state.savedProfiles = [];
  }
}

function persistSavedProfiles() {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.savedProfiles));
}

function renderSavedProfiles() {
  const options = ['<option value="">保存済みを選択</option>'];
  state.savedProfiles.forEach((profile) => {
    options.push(`<option value="${profile.id}">${escapeHtml(profile.name)}</option>`);
  });
  savedProfileSelectEl.innerHTML = options.join("");
}

function saveCurrentProfile() {
  const name = (profileNameInput.value || "").trim();
  if (!name) {
    alert("保存名を入力してください。");
    return;
  }

  const config = captureCurrentConfig();
  const profileId = `profile-${Date.now()}`;

  const existing = state.savedProfiles.find((item) => item.name === name);
  if (existing) {
    existing.config = config;
    existing.id = profileId;
  } else {
    state.savedProfiles.push({
      id: profileId,
      name,
      config,
    });
  }

  persistSavedProfiles();
  renderSavedProfiles();
  savedProfileSelectEl.value = profileId;
  setStatus(`構成を保存: ${name}`, "ok");
}

function loadSelectedProfile() {
  const selectedId = savedProfileSelectEl.value;
  if (!selectedId) {
    alert("読込対象を選択してください。");
    return;
  }

  const profile = state.savedProfiles.find((item) => item.id === selectedId);
  if (!profile || !profile.config) {
    alert("選択した構成が見つかりません。");
    return;
  }

  applyConfig(profile.config);
  setStatus(`保存済み構成を読込: ${profile.name}`, "ok");
}

function deleteSelectedProfile() {
  const selectedId = savedProfileSelectEl.value;
  if (!selectedId) {
    alert("削除対象を選択してください。");
    return;
  }

  const profile = state.savedProfiles.find((item) => item.id === selectedId);
  if (!profile) {
    return;
  }

  if (!window.confirm(`「${profile.name}」を削除しますか？`)) {
    return;
  }

  state.savedProfiles = state.savedProfiles.filter((item) => item.id !== selectedId);
  persistSavedProfiles();
  renderSavedProfiles();
  setStatus(`保存済み構成を削除: ${profile.name}`, "ok");
}

function renderResult(result) {
  finalTextEl.textContent = result.final_text || "(empty)";
  finalTextEl.classList.remove("empty");

  diffTextEl.textContent = result.diff || "差分なし";
  diffTextEl.classList.remove("empty");

  roundLogEl.innerHTML = (result.rounds || [])
    .map((round) => {
      const turns = (round.turns || [])
        .map((turn) => {
          const output = turn.output || "";
          const error = turn.error
            ? `<div class="error">Error: ${escapeHtml(turn.error)}</div>`
            : "";
          return `
            <div class="turn">
              <h4>${escapeHtml(turn.agent_name)} (${turn.mode} / ${turn.provider})</h4>
              ${error}
              <pre>${escapeHtml(output)}</pre>
            </div>
          `;
        })
        .join("");

      return `
        <article class="round">
          <h4>Round ${round.round_index}</h4>
          ${turns}
        </article>
      `;
    })
    .join("");
}

function resetLivePanels() {
  finalTextEl.textContent = "推敲中...";
  finalTextEl.classList.remove("empty");
  diffTextEl.textContent = "推敲中...";
  diffTextEl.classList.remove("empty");
  roundLogEl.innerHTML = "";
}

function ensureRoundElement(roundIndex) {
  let roundEl = roundLogEl.querySelector(`[data-round-index="${roundIndex}"]`);
  if (roundEl) {
    return roundEl;
  }

  roundEl = document.createElement("article");
  roundEl.className = "round running";
  roundEl.dataset.roundIndex = String(roundIndex);
  roundEl.innerHTML = `<h4>Round ${roundIndex} <span class="tag live">実行中</span></h4>`;
  roundLogEl.appendChild(roundEl);
  return roundEl;
}

function ensureTurnElement(roundIndex, turnIndex, agentId, headerText) {
  const roundEl = ensureRoundElement(roundIndex);
  const turnKey = `${roundIndex}-${turnIndex}-${agentId}`;
  let turnEl = roundEl.querySelector(`[data-turn-key="${turnKey}"]`);
  if (turnEl) {
    return turnEl;
  }

  turnEl = document.createElement("div");
  turnEl.className = "turn pending";
  turnEl.dataset.turnKey = turnKey;
  turnEl.innerHTML = `<h4>${escapeHtml(headerText)}</h4><div class="error" hidden></div><pre>実行中...</pre>`;
  roundEl.appendChild(turnEl);
  return turnEl;
}

function handleStreamEvent(event) {
  if (!event || typeof event !== "object") {
    return;
  }

  if (event.type === "run_started") {
    setActiveScreen("result");
    liveRunState = {
      totalTurns: Number(event.total_turns || 0),
      completedTurns: 0,
    };
    resetLivePanels();
    setStatus(`実行中... 0/${liveRunState.totalTurns}`, "running");
    return;
  }

  if (event.type === "round_started") {
    ensureRoundElement(event.round_index);
    return;
  }

  if (event.type === "turn_started") {
    const header = `${event.agent_name} (${event.mode} / ${event.provider})`;
    ensureTurnElement(event.round_index, event.turn_index, event.agent_id, header);
    if (liveRunState) {
      setStatus(
        `実行中... ${liveRunState.completedTurns}/${liveRunState.totalTurns} | Round ${event.round_index} ${event.agent_name}`,
        "running",
      );
    }
    return;
  }

  if (event.type === "turn_completed") {
    const turn = event.turn || {};
    const header = `${turn.agent_name || "agent"} (${turn.mode || "-"} / ${turn.provider || "-"})`;
    const turnEl = ensureTurnElement(
      event.round_index,
      event.turn_index,
      turn.agent_id || "unknown",
      header,
    );
    turnEl.classList.remove("pending");

    const errorEl = turnEl.querySelector(".error");
    const preEl = turnEl.querySelector("pre");
    const h4El = turnEl.querySelector("h4");
    h4El.textContent = header;

    if (turn.error) {
      errorEl.textContent = `Error: ${turn.error}`;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    preEl.textContent = turn.output || "(empty)";

    if (liveRunState) {
      liveRunState.completedTurns = Number(
        event.completed_turns ?? liveRunState.completedTurns + 1,
      );
      setStatus(
        `実行中... ${liveRunState.completedTurns}/${liveRunState.totalTurns}`,
        "running",
      );
    }
    return;
  }

  if (event.type === "round_completed") {
    const roundEl = ensureRoundElement(event.round_index);
    roundEl.classList.remove("running");
    const badge = roundEl.querySelector(".tag.live");
    if (badge) {
      badge.textContent = "完了";
      badge.classList.add("done");
    }
    return;
  }

  if (event.type === "run_completed") {
    renderResult(event.result || {});
    setStatus("実行完了", "ok");
    return;
  }

  if (event.type === "run_failed") {
    setStatus(`失敗: ${event.error || "unknown error"}`, "err");
  }
}

addAgentBtn.addEventListener("click", () => {
  syncStateFromDom();
  addCustomAgent();
});

agentListEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target.dataset.action !== "remove") {
    return;
  }

  syncStateFromDom();
  const card = target.closest(".agent-card");
  if (!card) {
    return;
  }
  const agentId = card.getAttribute("data-agent-id");
  removeAgent(agentId);
});

applyPresetBtn.addEventListener("click", () => {
  const presetId = presetSelectEl.value;
  applyPreset(presetId);
});

saveProfileBtn.addEventListener("click", () => {
  saveCurrentProfile();
});

loadProfileBtn.addEventListener("click", () => {
  loadSelectedProfile();
});

deleteProfileBtn.addEventListener("click", () => {
  deleteSelectedProfile();
});

workflowModeEl.addEventListener("change", () => {
  syncCodingFieldsVisibility();
});

viewTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const screen = btn.dataset.screen;
    setActiveScreen(screen);
  });
});

toRunFromTeamBtn.addEventListener("click", () => {
  setActiveScreen("run");
});

toTeamFromRunBtn.addEventListener("click", () => {
  setActiveScreen("team");
});

toResultFromRunBtn.addEventListener("click", () => {
  setActiveScreen("result");
});

toTeamFromResultBtn.addEventListener("click", () => {
  setActiveScreen("team");
});

toRunFromResultBtn.addEventListener("click", () => {
  setActiveScreen("run");
});

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  syncStateFromDom();

  const payload = {
    workflow_mode: workflowModeEl.value || "writing",
    source_text: document.getElementById("sourceText").value,
    objective: document.getElementById("objective").value,
    global_instruction: document.getElementById("globalInstruction").value,
    code_context: {
      repository: repoNameEl.value || "",
      target_paths: parseDelimitedList(targetPathsEl.value),
      tech_stack: techStackEl.value || "",
      acceptance_criteria: acceptanceCriteriaEl.value || "",
      test_command: testCommandEl.value || "",
    },
    rounds: Number(document.getElementById("rounds").value || 1),
    agents: state.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      mode: agent.mode,
      provider: agent.provider,
      persona: agent.persona || "",
      skills: parseSkills(agent.skills_text),
      command_template: agent.command_template || null,
      model: agent.model || null,
      is_custom: Boolean(agent.is_custom),
    })),
  };

  runBtn.disabled = true;
  setStatus("実行準備中...", "running");
  setActiveScreen("result");
  liveRunState = null;

  try {
    const response = await fetch("/api/refine/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error("stream is unavailable");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        try {
          handleStreamEvent(JSON.parse(line));
        } catch {
          // Ignore malformed event chunks.
        }
      }
    }

    const tail = buffer.trim();
    if (tail) {
      try {
        handleStreamEvent(JSON.parse(tail));
      } catch {
        // Ignore malformed final chunk.
      }
    }
  } catch (error) {
    setStatus(`失敗: ${error.message}`, "err");
  } finally {
    runBtn.disabled = false;
  }
});

renderPresetOptions();
loadSavedProfiles();
renderSavedProfiles();
applyPreset(DEFAULT_PRESET_ID);
setActiveScreen("team");
setStatus("待機中");
