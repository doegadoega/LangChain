import {
  state,
  clone,
  escapeHtml,
  parseDelimitedList,
  PROFILE_STORAGE_KEY,
  BUILTIN_PRESETS,
  DEFAULT_PRESET_ID,
} from "./state.js?v=4";
import {
  normalizeAgent,
  computeNextCustomIndex,
  renderAgents,
  syncStateFromDom,
} from "./agents.js?v=4";
import { setStatus } from "./streaming.js?v=4";

let domRefs = null;

export function initProfileDom(refs) {
  domRefs = refs;
}

export function renderPresetOptions() {
  domRefs.presetSelectEl.innerHTML = BUILTIN_PRESETS.map(
    (preset) => `<option value="${preset.id}">${escapeHtml(preset.name)}</option>`,
  ).join("");
  domRefs.presetSelectEl.value = DEFAULT_PRESET_ID;
}

export function applyConfig(config) {
  const mode = config.workflow_mode || "writing";
  const orchestrationMode = config.orchestration_mode || "sequential";
  const codeContext = config.code_context || {};

  domRefs.objectiveEl.value = config.objective || "";
  domRefs.globalInstructionEl.value = config.global_instruction || "";
  domRefs.roundsEl.value = String(config.rounds || 1);
  domRefs.workflowModeEl.value = mode;
  domRefs.orchestrationModeEl.value = orchestrationMode;
  domRefs.workingDirectoryEl.value = codeContext.working_directory || "";
  domRefs.repoNameEl.value = codeContext.repository || "";
  domRefs.targetPathsEl.value = Array.isArray(codeContext.target_paths)
    ? codeContext.target_paths.join("\n")
    : "";
  domRefs.techStackEl.value = codeContext.tech_stack || "";
  domRefs.acceptanceCriteriaEl.value = codeContext.acceptance_criteria || "";
  domRefs.testCommandEl.value = codeContext.test_command || "";

  state.agents = (config.agents || []).map((agent, index) =>
    normalizeAgent(agent, index),
  );
  computeNextCustomIndex();
  renderAgents(domRefs.agentListEl, domRefs.addAgentBtn);
}

export function captureCurrentConfig() {
  syncStateFromDom();
  return {
    workflow_mode: domRefs.workflowModeEl.value || "writing",
    orchestration_mode: domRefs.orchestrationModeEl.value || "sequential",
    objective: domRefs.objectiveEl.value,
    global_instruction: domRefs.globalInstructionEl.value,
    code_context: {
      working_directory: domRefs.workingDirectoryEl.value || "",
      repository: domRefs.repoNameEl.value || "",
      target_paths: parseDelimitedList(domRefs.targetPathsEl.value),
      tech_stack: domRefs.techStackEl.value || "",
      acceptance_criteria: domRefs.acceptanceCriteriaEl.value || "",
      test_command: domRefs.testCommandEl.value || "",
    },
    rounds: Number(domRefs.roundsEl.value || 1),
    agents: state.agents.map((agent) => ({ ...agent })),
  };
}

function getPresetById(presetId) {
  return BUILTIN_PRESETS.find((preset) => preset.id === presetId) || null;
}

export function applyPreset(presetId) {
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

export function loadSavedProfiles() {
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

export function renderSavedProfiles() {
  const options = ['<option value="">保存済みを選択</option>'];
  state.savedProfiles.forEach((profile) => {
    options.push(
      `<option value="${profile.id}">${escapeHtml(profile.name)}</option>`,
    );
  });
  domRefs.savedProfileSelectEl.innerHTML = options.join("");
}

export function saveCurrentProfile() {
  const name = (domRefs.profileNameInput.value || "").trim();
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
    state.savedProfiles.push({ id: profileId, name, config });
  }

  persistSavedProfiles();
  renderSavedProfiles();
  domRefs.savedProfileSelectEl.value = profileId;
  setStatus(`構成を保存: ${name}`, "ok");
}

export function loadSelectedProfile() {
  const selectedId = domRefs.savedProfileSelectEl.value;
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

export function deleteSelectedProfile() {
  const selectedId = domRefs.savedProfileSelectEl.value;
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

  state.savedProfiles = state.savedProfiles.filter(
    (item) => item.id !== selectedId,
  );
  persistSavedProfiles();
  renderSavedProfiles();
  setStatus(`保存済み構成を削除: ${profile.name}`, "ok");
}
