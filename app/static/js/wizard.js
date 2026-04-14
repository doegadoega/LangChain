import { state, escapeHtml, parseSkills, parseDelimitedList, clone } from "./state.js?v=4";
import { syncStateFromDom } from "./agents.js?v=4";
import { setStatus, handleStreamEvent } from "./streaming.js?v=4";

const CODING_TEAM_PRESET = [
  {
    id: "ceo",
    name: "社長",
    mode: "writer",
    provider: "codex_cli",
    persona: "全体を俯瞰し、ビジネス要件と技術方針を最終決定する。優先順位を明確にし、スコープを定義する。",
    skills_text: "要件定義\nスコープ決定\n優先順位判断\nビジネス視点レビュー",
    command_template: "",
    model: "",
    is_custom: false,
    depends_on: [],
    enabled: true,
  },
  {
    id: "manager",
    name: "マネージャー",
    mode: "reviewer",
    provider: "codex_cli",
    persona: "社長の方針を受けてタスクを分解し、各エンジニアへ作業指示を出す。進捗管理とリスク管理を行う。",
    skills_text: "タスク分解\n進捗管理\nリスク管理\n品質基準設定",
    command_template: "",
    model: "",
    is_custom: false,
    depends_on: ["ceo"],
    enabled: true,
  },
  {
    id: "engineer_1",
    name: "エンジニア1号",
    mode: "writer",
    provider: "codex_cli",
    persona: "設計・アーキテクチャ担当。システム全体の構成を設計し、技術選定とインターフェース定義を行う。",
    skills_text: "アーキテクチャ設計\n技術選定\nAPI設計\nデータモデリング",
    command_template: "",
    model: "",
    is_custom: false,
    depends_on: ["manager"],
    enabled: true,
  },
  {
    id: "engineer_2",
    name: "エンジニア2号",
    mode: "writer",
    provider: "codex_cli",
    persona: "実装担当。設計に基づいて具体的なコードを書き、テストコードも作成する。",
    skills_text: "コーディング\nテスト実装\nデバッグ\nリファクタリング",
    command_template: "",
    model: "",
    is_custom: false,
    depends_on: ["manager", "engineer_1"],
    enabled: true,
  },
  {
    id: "engineer_3",
    name: "エンジニア3号",
    mode: "editor",
    provider: "codex_cli",
    persona: "品質保証・統合担当。コードレビュー、テスト検証、最終統合を行い、リリース可能な状態にまとめる。",
    skills_text: "コードレビュー\nテスト検証\n統合テスト\nリリース準備",
    command_template: "",
    model: "",
    is_custom: false,
    depends_on: ["engineer_1", "engineer_2"],
    enabled: true,
  },
];

const PROVIDER_OPTIONS = [
  { value: "codex_cli", label: "Codex CLI" },
  { value: "claude_cli", label: "Claude CLI" },
  { value: "gemini_cli", label: "Gemini CLI" },
];

const LANGUAGE_OPTIONS = [
  { value: "swift", label: "Swift", icon: "\u{1F34E}" },
  { value: "python", label: "Python", icon: "\u{1F40D}" },
  { value: "typescript", label: "TypeScript", icon: "\u{1F4D8}" },
  { value: "javascript", label: "JavaScript", icon: "\u{1F4D2}" },
  { value: "go", label: "Go", icon: "\u{1F535}" },
  { value: "rust", label: "Rust", icon: "\u{1F980}" },
  { value: "java", label: "Java", icon: "\u2615" },
  { value: "kotlin", label: "Kotlin", icon: "\u{1F7E3}" },
  { value: "cpp", label: "C/C++", icon: "\u2699\uFE0F" },
  { value: "ruby", label: "Ruby", icon: "\u{1F48E}" },
  { value: "php", label: "PHP", icon: "\u{1F418}" },
  { value: "csharp", label: "C#", icon: "\u{1F3AF}" },
];

function getDefaultWorkingDir() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `Workspace/${yyyy}-${mm}-${dd}`;
}

let wizardAgents = [];
let selectedLanguage = "";
let currentWizardStep = 1;
let navigateFn = null;
let formEl = null;

export function initWizard(refs) {
  navigateFn = refs.navigateFn;
  formEl = refs.formEl;
  wizardAgents = clone(CODING_TEAM_PRESET);
  selectedLanguage = "";
  renderWizardAgents();
  renderLanguageSelector();
  wireWizardEvents();

  const workingDirEl = document.getElementById("workingDirectory");
  if (workingDirEl && !workingDirEl.value) {
    workingDirEl.value = getDefaultWorkingDir();
  }
}

function renderWizardAgents() {
  const listEl = document.getElementById("wizardAgentList");
  if (!listEl) {
    return;
  }

  listEl.innerHTML = wizardAgents
    .map((agent) => {
      const skills = parseSkills(agent.skills_text);
      const offClass = agent.enabled ? "" : " is-off";
      const roleClass = agent.mode;
      const providerOptions = PROVIDER_OPTIONS
        .map((opt) => `<option value="${opt.value}"${opt.value === agent.provider ? " selected" : ""}>${opt.label}</option>`)
        .join("");

      return `
        <div class="wizard-agent-card${offClass}" data-wizard-agent="${agent.id}">
          <input type="checkbox" class="wizard-agent-toggle"
            data-wizard-toggle="${agent.id}"
            ${agent.enabled ? "checked" : ""} />
          <div class="wizard-agent-body">
            <div class="wizard-agent-header">
              ${escapeHtml(agent.name)}
              <span class="wizard-agent-role ${roleClass}">${agent.mode}</span>
            </div>
            <p class="wizard-agent-persona">${escapeHtml(agent.persona)}</p>
            <div class="wizard-agent-footer">
              <div class="wizard-skill-tags">
                ${skills.map((s) => `<span class="wizard-skill-tag">${escapeHtml(s)}</span>`).join("")}
              </div>
              <select class="wizard-provider-select" data-wizard-provider="${agent.id}">
                ${providerOptions}
              </select>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderLanguageSelector() {
  const containerEl = document.getElementById("wizardLanguageList");
  if (!containerEl) {
    return;
  }
  containerEl.innerHTML = LANGUAGE_OPTIONS
    .map(
      (lang) =>
        `<button type="button" class="wizard-lang-chip" data-lang="${lang.value}"><span class="wizard-lang-icon">${lang.icon}</span>${escapeHtml(lang.label)}</button>`,
    )
    .join("");
}

function setWizardStep(step) {
  currentWizardStep = step;

  document.querySelectorAll(".wizard-panel").forEach((panel) => {
    panel.classList.toggle("is-active", Number(panel.dataset.wstep) === step);
  });

  document.querySelectorAll(".wizard-step").forEach((btn) => {
    const btnStep = Number(btn.dataset.wstep);
    btn.classList.toggle("is-active", btnStep === step);
    btn.classList.toggle("is-done", btnStep < step);
  });

  if (step === 3) {
    renderSummary();
  }
}

function renderSummary() {
  const summaryEl = document.getElementById("wizardSummary");
  if (!summaryEl) {
    return;
  }

  const enabledAgents = wizardAgents.filter((a) => a.enabled);
  const workingDir = document.getElementById("workingDirectory").value || "(未設定)";
  const repoName = document.getElementById("repoName").value || "(未設定)";
  const targetPaths = document.getElementById("targetPaths").value || "(未設定)";
  const codingSource = document.getElementById("codingSourceText").value || "(未設定)";
  const techStack = document.getElementById("techStack").value || "(未設定)";
  const criteria = document.getElementById("acceptanceCriteria").value || "(未設定)";
  const langLabel = selectedLanguage || "(未選択)";

  const agentChips = enabledAgents
    .map(
      (a) =>
        `<span class="wizard-skill-tag">${escapeHtml(a.name)} (${a.mode})</span>`,
    )
    .join("");

  const hasWorkingDir = document.getElementById("workingDirectory").value.trim();
  const modeLabel = hasWorkingDir
    ? '<span class="wizard-mode-badge live">実コード生成モード</span>'
    : '<span class="wizard-mode-badge text">テキスト出力モード</span>';

  summaryEl.innerHTML = `
    <div class="wizard-summary-section">
      <h4>実行モード</h4>
      ${modeLabel}
    </div>
    <div class="wizard-summary-section">
      <h4>選択されたエージェント (${enabledAgents.length}名)</h4>
      <div class="wizard-summary-agents">${agentChips}</div>
    </div>
    <div class="wizard-summary-section">
      <h4>要件</h4>
      <div class="wizard-summary-row">
        <span class="wizard-summary-label">作業ディレクトリ</span>
        <span class="wizard-summary-value">${escapeHtml(workingDir)}</span>
      </div>
      <div class="wizard-summary-row">
        <span class="wizard-summary-label">リポジトリ</span>
        <span class="wizard-summary-value">${escapeHtml(repoName)}</span>
      </div>
      <div class="wizard-summary-row">
        <span class="wizard-summary-label">対象パス</span>
        <span class="wizard-summary-value">${escapeHtml(targetPaths)}</span>
      </div>
      <div class="wizard-summary-row">
        <span class="wizard-summary-label">要件</span>
        <span class="wizard-summary-value">${escapeHtml(codingSource)}</span>
      </div>
      <div class="wizard-summary-row">
        <span class="wizard-summary-label">言語</span>
        <span class="wizard-summary-value">${escapeHtml(langLabel)}</span>
      </div>
      <div class="wizard-summary-row">
        <span class="wizard-summary-label">オーケストレーション</span>
        <span class="wizard-summary-value">dependency_graph</span>
      </div>
      <div class="wizard-summary-row">
        <span class="wizard-summary-label">技術スタック</span>
        <span class="wizard-summary-value">${escapeHtml(techStack)}</span>
      </div>
      <div class="wizard-summary-row">
        <span class="wizard-summary-label">受入条件</span>
        <span class="wizard-summary-value">${escapeHtml(criteria)}</span>
      </div>
    </div>
  `;
}

function buildWizardPayload() {
  const enabledAgents = wizardAgents.filter((a) => a.enabled);
  const enabledAgentIds = new Set(enabledAgents.map((agent) => agent.id));
  const codingSourceText = document.getElementById("codingSourceText").value || "";
  const rounds = Number(document.getElementById("wizardRounds").value || 2);

  return {
    workflow_mode: "coding",
    orchestration_mode: "dependency_graph",
    source_text: codingSourceText,
    objective: "要件を満たす設計・実装を、分業体制で段階的に完成させる",
    global_instruction:
      "各エージェントは自分の役割に集中し、前のエージェントの出力を引き継いで改善する。曖昧なTODOを残さない。",
    code_context: {
      repository: document.getElementById("repoName").value || "",
      working_directory: document.getElementById("workingDirectory").value || "",
      target_paths: parseDelimitedList(
        document.getElementById("targetPaths").value,
      ),
      tech_stack: [selectedLanguage, document.getElementById("techStack").value || ""].filter(Boolean).join(", "),
      acceptance_criteria:
        document.getElementById("acceptanceCriteria").value || "",
      test_command: document.getElementById("testCommand").value || "",
    },
    rounds,
    agents: enabledAgents.map((agent) => {
      const timeoutRaw = Number(agent.mcp_timeout_sec);
      const timeout =
        Number.isFinite(timeoutRaw) && timeoutRaw >= 5 && timeoutRaw <= 600
          ? timeoutRaw
          : 60;
      return {
        id: agent.id,
        name: agent.name,
        mode: agent.mode,
        provider: agent.provider,
        persona: agent.persona || "",
        skills: parseSkills(agent.skills_text),
        depends_on: (agent.depends_on || []).filter((dep) =>
          enabledAgentIds.has(dep),
        ),
        command_template: agent.command_template || null,
        model: agent.model || null,
        mcp_enabled:
          agent.mcp_enabled === true ||
          String(agent.mcp_enabled).toLowerCase() === "true",
        mcp_config_path: agent.mcp_config_path || null,
        mcp_servers: parseDelimitedList(agent.mcp_servers_text || ""),
        mcp_instruction: agent.mcp_instruction || "",
        mcp_context_command: agent.mcp_context_command || null,
        mcp_timeout_sec: timeout,
        is_custom: Boolean(agent.is_custom),
      };
    }),
  };
}

function wireWizardEvents() {
  const wizardAgentList = document.getElementById("wizardAgentList");
  if (wizardAgentList) {
    wizardAgentList.addEventListener("change", (event) => {
      const toggle = event.target.closest("[data-wizard-toggle]");
      if (toggle) {
        const agentId = toggle.dataset.wizardToggle;
        const agent = wizardAgents.find((a) => a.id === agentId);
        if (agent) {
          agent.enabled = toggle.checked;
          const card = toggle.closest(".wizard-agent-card");
          if (card) {
            card.classList.toggle("is-off", !agent.enabled);
          }
        }
        return;
      }

      const providerSelect = event.target.closest("[data-wizard-provider]");
      if (providerSelect) {
        const agentId = providerSelect.dataset.wizardProvider;
        const agent = wizardAgents.find((a) => a.id === agentId);
        if (agent) {
          agent.provider = providerSelect.value;
        }
      }
    });
  }

  document.querySelectorAll(".wizard-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      setWizardStep(Number(btn.dataset.wstep));
    });
  });

  document.querySelectorAll(".wizard-next, .wizard-prev").forEach((btn) => {
    btn.addEventListener("click", () => {
      setWizardStep(Number(btn.dataset.goto));
    });
  });

  const langList = document.getElementById("wizardLanguageList");
  if (langList) {
    langList.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-lang]");
      if (!chip) {
        return;
      }
      const wasActive = chip.classList.contains("is-active");
      langList.querySelectorAll(".wizard-lang-chip").forEach((c) => {
        c.classList.remove("is-active");
      });
      if (wasActive) {
        selectedLanguage = "";
      } else {
        chip.classList.add("is-active");
        const lang = LANGUAGE_OPTIONS.find((l) => l.value === chip.dataset.lang);
        selectedLanguage = lang ? lang.label : "";
      }
    });
  }

  const wizardRunBtn = document.getElementById("wizardRunBtn");
  if (wizardRunBtn) {
    wizardRunBtn.addEventListener("click", async () => {
      const codingSourceText = document.getElementById("codingSourceText").value;
      if (!codingSourceText.trim()) {
        setWizardStep(2);
        alert("要件を入力してください。");
        return;
      }

      const enabledAgents = wizardAgents.filter((a) => a.enabled);
      if (enabledAgents.length === 0) {
        setWizardStep(1);
        alert("少なくとも1人のエージェントを選択してください。");
        return;
      }
      if (!enabledAgents.some((agent) => agent.mode === "editor")) {
        setWizardStep(1);
        alert("少なくとも1人の editor エージェントを選択してください。");
        return;
      }

      const payload = buildWizardPayload();

      wizardRunBtn.disabled = true;
      const sidebarRunBtn = document.getElementById("runBtnSidebar");
      if (sidebarRunBtn) {
        sidebarRunBtn.disabled = true;
      }

      setStatus("実行準備中...", "running");
      logToConsole("=== 推敲実行開始 ===");
      logToConsole(`チーム構成: ${enabledAgents.map((a) => a.name).join(" / ")}`);
      logToConsole(`ラウンド数: ${payload.rounds}`);

      if (navigateFn) {
        navigateFn("log");
      }

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
              const event = JSON.parse(line);
              logStreamEvent(event);
              handleStreamEvent(event);
            } catch {
              // Ignore malformed event chunks.
            }
          }
        }

        const tail = buffer.trim();
        if (tail) {
          try {
            const event = JSON.parse(tail);
            logStreamEvent(event);
            handleStreamEvent(event);
          } catch {
            // Ignore malformed final chunk.
          }
        }
      } catch (error) {
        setStatus(`失敗: ${error.message}`, "err");
        logToConsole(`[ERROR] ${error.message}`);
      } finally {
        wizardRunBtn.disabled = false;
        const sidebarBtn = document.getElementById("runBtnSidebar");
        if (sidebarBtn) {
          sidebarBtn.disabled = false;
        }
      }
    });
  }
}

function logToConsole(message) {
  const timestamp = new Date().toLocaleTimeString("ja-JP");
  console.log(`[AI推敲 ${timestamp}] ${message}`);
}

function logStreamEvent(event) {
  if (!event || !event.type) {
    return;
  }

  switch (event.type) {
    case "run_started": {
      const modeLabel = event.has_working_dir ? "実コード生成" : "テキスト出力";
      logToConsole(`実行開始 - 合計ターン数: ${event.total_turns} [${modeLabel}]`);
      break;
    }
    case "round_started":
      logToConsole(`--- Round ${event.round_index} 開始 ---`);
      break;
    case "turn_started":
      logToConsole(`  [${event.agent_name}] (${event.mode}) 作業開始...`);
      break;
    case "turn_completed": {
      const turn = event.turn || {};
      const outputPreview = (turn.output || "").slice(0, 100);
      if (turn.error) {
        logToConsole(`  [${turn.agent_name}] エラー: ${turn.error}`);
      } else {
        logToConsole(`  [${turn.agent_name}] 完了 - ${outputPreview}...`);
        if (turn.file_changes) {
          const changedLines = turn.file_changes.split("\n").length;
          logToConsole(`  [${turn.agent_name}] ファイル変更: ${changedLines}行の差分`);
        }
      }
      break;
    }
    case "round_completed":
      logToConsole(`--- Round ${event.round_index} 完了 ---`);
      break;
    case "run_completed":
      logToConsole("=== 推敲完了 ===");
      break;
    case "run_failed":
      logToConsole(`=== 失敗: ${event.error} ===`);
      break;
  }
}

export function resetWizard() {
  wizardAgents = clone(CODING_TEAM_PRESET);
  selectedLanguage = "";
  currentWizardStep = 1;
  renderWizardAgents();
  renderLanguageSelector();
  setWizardStep(1);
}
