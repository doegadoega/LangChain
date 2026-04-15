import { state, parseSkills, parseDelimitedList, DEFAULT_PRESET_ID } from "./state.js?v=5";
import {
  renderAgents,
  syncStateFromDom,
  addCustomAgent,
  removeAgent,
} from "./agents.js?v=5";
import {
  initProfileDom,
  renderPresetOptions,
  applyPreset,
  loadSavedProfiles,
  renderSavedProfiles,
  saveCurrentProfile,
  loadSelectedProfile,
  deleteSelectedProfile,
} from "./profiles.js?v=5";
import {
  initStreamingDom,
  setStatus,
  handleStreamEvent,
} from "./streaming.js?v=5";
import { initWizard } from "./wizard.js?v=5";

const PAGE_NAMES = [
  "templates",
  "agents",
  "input",
  "params",
  "coding",
  "results",
  "log",
];

let currentPage = "templates";

const agentListEl = document.getElementById("agentList");
const addAgentBtn = document.getElementById("addAgentBtn");
const formEl = document.getElementById("refineForm");
const runBtn = document.getElementById("runBtn");
const runBtnSidebar = document.getElementById("runBtnSidebar");
const workflowModeEl = document.getElementById("workflowMode");
const orchestrationModeEl = document.getElementById("orchestrationMode");
const navCoding = document.getElementById("navCoding");
const sidebarEl = document.getElementById("sidebar");
const overlayEl = document.getElementById("sidebarOverlay");
const hamburgerBtn = document.getElementById("hamburgerBtn");
const orchestrationPreviewEl = document.getElementById("orchestrationPreview");

const domRefs = {
  agentListEl,
  addAgentBtn,
  statusEl: document.getElementById("status"),
  finalTextEl: document.getElementById("finalText"),
  diffTextEl: document.getElementById("diffText"),
  roundLogEl: document.getElementById("roundLog"),
  fileChangesSection: document.getElementById("fileChangesSection"),
  fileChangesTextEl: document.getElementById("fileChangesText"),
  presetSelectEl: document.getElementById("presetSelect"),
  profileNameInput: document.getElementById("profileNameInput"),
  savedProfileSelectEl: document.getElementById("savedProfileSelect"),
  objectiveEl: document.getElementById("objective"),
  globalInstructionEl: document.getElementById("globalInstruction"),
  roundsEl: document.getElementById("rounds"),
  workflowModeEl,
  orchestrationModeEl,
  workingDirectoryEl: document.getElementById("workingDirectory"),
  repoNameEl: document.getElementById("repoName"),
  targetPathsEl: document.getElementById("targetPaths"),
  techStackEl: document.getElementById("techStack"),
  acceptanceCriteriaEl: document.getElementById("acceptanceCriteria"),
  testCommandEl: document.getElementById("testCommand"),
};

function setActivePage(pageName) {
  if (!PAGE_NAMES.includes(pageName)) {
    return;
  }
  if (pageName === "coding" && workflowModeEl.value !== "coding") {
    return;
  }
  currentPage = pageName;

  document.querySelectorAll(".page-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.page === pageName);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.page === pageName);
  });
}

function syncCodingMenuVisibility() {
  const isCoding = workflowModeEl.value === "coding";
  navCoding.hidden = !isCoding;
  if (!isCoding && currentPage === "coding") {
    setActivePage("params");
  }
}

function buildExecutionBatches(agents, mode) {
  const idOrder = new Map();
  const byId = new Map();
  const depsMap = new Map();
  agents.forEach((agent, idx) => {
    idOrder.set(agent.id, idx);
    byId.set(agent.id, agent);
    depsMap.set(agent.id, parseDelimitedList(agent.depends_on_text || ""));
  });

  if (mode === "sequential") {
    return { batches: agents.map((agent) => [agent.id]) };
  }

  if (mode === "role_based") {
    const roleOrder = [
      "ceo",
      "manager",
      "worker",
      "pmo",
      "qa",
      "ui_designer",
      "system_designer",
      "ops_designer",
      "other",
    ];
    const batches = roleOrder
      .map((role) =>
        agents
          .filter((agent) => (agent.org_role || "worker") === role)
          .map((agent) => agent.id),
      )
      .filter((batch) => batch.length > 0);
    return { batches };
  }

  const indegree = new Map();
  const reverse = new Map();
  byId.forEach((_, agentId) => {
    indegree.set(agentId, 0);
    reverse.set(agentId, []);
  });

  for (const [agentId, deps] of depsMap.entries()) {
    for (const dep of deps) {
      if (!byId.has(dep)) {
        return { error: `依存先が存在しません: ${agentId} -> ${dep}` };
      }
      if (dep === agentId) {
        return { error: `自己依存は不可です: ${agentId}` };
      }
      indegree.set(agentId, (indegree.get(agentId) || 0) + 1);
      reverse.get(dep).push(agentId);
    }
  }

  let ready = Array.from(indegree.entries())
    .filter(([, degree]) => degree === 0)
    .map(([agentId]) => agentId)
    .sort((a, b) => (idOrder.get(a) || 0) - (idOrder.get(b) || 0));

  const batches = [];
  let visited = 0;
  while (ready.length > 0) {
    const current = ready;
    batches.push(current);
    visited += current.length;
    const next = [];
    current.forEach((agentId) => {
      (reverse.get(agentId) || []).forEach((nxt) => {
        indegree.set(nxt, (indegree.get(nxt) || 0) - 1);
        if (indegree.get(nxt) === 0) {
          next.push(nxt);
        }
      });
    });
    ready = next.sort((a, b) => (idOrder.get(a) || 0) - (idOrder.get(b) || 0));
  }

  if (visited !== agents.length) {
    return { error: "depends_on に循環があります" };
  }
  return { batches };
}

function renderExecutionPreview() {
  if (!orchestrationPreviewEl) {
    return;
  }
  const mode = orchestrationModeEl?.value || "sequential";
  const { batches, error } = buildExecutionBatches(state.agents, mode);
  if (error) {
    orchestrationPreviewEl.innerHTML = `<p class="preview-error">${error}</p>`;
    return;
  }
  const modeLabel =
    mode === "dependency_graph"
      ? "dependency_graph"
      : mode === "role_based"
        ? "role_based"
        : "sequential";
  const steps = (batches || [])
    .map((batch, idx) => {
      const items = batch.map((id) => `<code>${id}</code>`).join(" → ");
      return `<li>Step ${idx + 1}: ${items}</li>`;
    })
    .join("");
  orchestrationPreviewEl.innerHTML = `
    <p>Mode: <strong>${modeLabel}</strong></p>
    <ol>${steps || "<li>実行対象なし</li>"}</ol>
  `;
}

function openMobileSidebar() {
  sidebarEl.classList.add("is-open");
  overlayEl.classList.add("is-visible");
}

function closeMobileSidebar() {
  sidebarEl.classList.remove("is-open");
  overlayEl.classList.remove("is-visible");
}

document.querySelector(".sidebar-nav").addEventListener("click", (event) => {
  const navItem = event.target.closest(".nav-item");
  if (!navItem) {
    return;
  }
  const page = navItem.dataset.page;
  setActivePage(page);
  closeMobileSidebar();
});

hamburgerBtn.addEventListener("click", () => {
  if (sidebarEl.classList.contains("is-open")) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
});

overlayEl.addEventListener("click", () => {
  closeMobileSidebar();
});

addAgentBtn.addEventListener("click", () => {
  syncStateFromDom();
  addCustomAgent(agentListEl, addAgentBtn);
  renderExecutionPreview();
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
  removeAgent(card.getAttribute("data-agent-id"), agentListEl, addAgentBtn);
  renderExecutionPreview();
});

agentListEl.addEventListener("input", () => {
  syncStateFromDom();
  renderExecutionPreview();
});

document.getElementById("applyPresetBtn").addEventListener("click", () => {
  applyPreset(domRefs.presetSelectEl.value);
  syncCodingMenuVisibility();
  renderExecutionPreview();
});

document.getElementById("saveProfileBtn").addEventListener("click", () => {
  saveCurrentProfile();
});

document.getElementById("loadProfileBtn").addEventListener("click", () => {
  loadSelectedProfile();
  syncCodingMenuVisibility();
  renderExecutionPreview();
});

document.getElementById("deleteProfileBtn").addEventListener("click", () => {
  deleteSelectedProfile();
});

workflowModeEl.addEventListener("change", () => {
  syncCodingMenuVisibility();
});

orchestrationModeEl.addEventListener("change", () => {
  renderExecutionPreview();
});

runBtnSidebar.addEventListener("click", () => {
  formEl.requestSubmit();
});

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const sourceText = document.getElementById("sourceText").value;
  if (!sourceText.trim()) {
    setActivePage("input");
    alert("元テキストを入力してください。");
    return;
  }

  syncStateFromDom();

  const payload = {
    workflow_mode: workflowModeEl.value || "writing",
    orchestration_mode: orchestrationModeEl.value || "sequential",
    source_text: sourceText,
    objective: domRefs.objectiveEl.value,
    global_instruction: domRefs.globalInstructionEl.value,
    code_context: {
      repository: domRefs.repoNameEl.value || "",
      working_directory: domRefs.workingDirectoryEl.value || "",
      target_paths: parseDelimitedList(domRefs.targetPathsEl.value),
      tech_stack: domRefs.techStackEl.value || "",
      acceptance_criteria: domRefs.acceptanceCriteriaEl.value || "",
      test_command: domRefs.testCommandEl.value || "",
    },
    rounds: Number(domRefs.roundsEl.value || 1),
    agents: state.agents.map((agent) => {
      const timeoutRaw = Number(agent.mcp_timeout_sec);
      const timeout =
        Number.isFinite(timeoutRaw) && timeoutRaw >= 5 && timeoutRaw <= 600
          ? timeoutRaw
          : 60;
      return {
        id: agent.id,
        name: agent.name,
        org_role: agent.org_role || "worker",
        provider: agent.provider,
        persona: agent.persona || "",
        skills: parseSkills(agent.skills_text),
        depends_on: parseDelimitedList(agent.depends_on_text),
        command_template: agent.command_template || null,
        model: agent.model || null,
        mcp_enabled:
          agent.mcp_enabled === true ||
          String(agent.mcp_enabled).toLowerCase() === "true",
        mcp_config_path: (agent.mcp_config_path || "").trim() || null,
        mcp_servers: parseDelimitedList(agent.mcp_servers_text),
        mcp_instruction: agent.mcp_instruction || "",
        mcp_context_command: (agent.mcp_context_command || "").trim() || null,
        mcp_timeout_sec: timeout,
        is_custom: Boolean(agent.is_custom),
      };
    }),
  };

  runBtn.disabled = true;
  runBtnSidebar.disabled = true;
  setStatus("実行準備中...", "running");
  setActivePage("log");

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
    runBtnSidebar.disabled = false;
  }
});

initProfileDom(domRefs);
initStreamingDom(
  {
    statusEl: domRefs.statusEl,
    finalTextEl: domRefs.finalTextEl,
    diffTextEl: domRefs.diffTextEl,
    roundLogEl: domRefs.roundLogEl,
    fileChangesSection: domRefs.fileChangesSection,
    fileChangesTextEl: domRefs.fileChangesTextEl,
  },
  setActivePage,
);

renderPresetOptions();
loadSavedProfiles();
renderSavedProfiles();
applyPreset(DEFAULT_PRESET_ID);
syncCodingMenuVisibility();
initWizard({ navigateFn: setActivePage, formEl });
renderExecutionPreview();
setActivePage("templates");
setStatus("待機中");
