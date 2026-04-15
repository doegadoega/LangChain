import { escapeHtml } from "./state.js?v=5";

let statusEl = null;
let finalTextEl = null;
let diffTextEl = null;
let roundLogEl = null;
let fileChangesSection = null;
let fileChangesTextEl = null;
let onNavigate = null;
let liveRunState = null;

export function initStreamingDom(refs, navigateFn) {
  statusEl = refs.statusEl;
  finalTextEl = refs.finalTextEl;
  diffTextEl = refs.diffTextEl;
  roundLogEl = refs.roundLogEl;
  fileChangesSection = refs.fileChangesSection;
  fileChangesTextEl = refs.fileChangesTextEl;
  onNavigate = navigateFn;
}

export function setStatus(message, kind = "") {
  statusEl.className = "status";
  if (kind) {
    statusEl.classList.add(kind);
  }
  statusEl.textContent = message;
}

export function resetLivePanels() {
  finalTextEl.textContent = "推敲中...";
  finalTextEl.classList.remove("empty");
  diffTextEl.textContent = "推敲中...";
  diffTextEl.classList.remove("empty");
  roundLogEl.innerHTML = "";

  if (fileChangesSection) {
    fileChangesSection.hidden = true;
  }
  if (fileChangesTextEl) {
    fileChangesTextEl.textContent = "";
  }
}

function ensureRoundElement(roundIndex) {
  let roundEl = roundLogEl.querySelector(
    `[data-round-index="${roundIndex}"]`,
  );
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
  turnEl.innerHTML = `<h4>${escapeHtml(headerText)}</h4><div class="error" hidden></div><pre>実行中...</pre><div class="turn-file-changes" hidden></div>`;
  roundEl.appendChild(turnEl);
  return turnEl;
}

function renderFileChangesInTurn(turnEl, fileChanges) {
  const container = turnEl.querySelector(".turn-file-changes");
  if (!container || !fileChanges) {
    return;
  }
  container.hidden = false;
  container.innerHTML = `<details><summary class="file-changes-toggle">ファイル変更を表示</summary><pre class="code-diff">${escapeHtml(fileChanges)}</pre></details>`;
}

function renderResult(result) {
  finalTextEl.textContent = result.final_text || "(empty)";
  finalTextEl.classList.remove("empty");

  diffTextEl.textContent = result.diff || "差分なし";
  diffTextEl.classList.remove("empty");

  // Show file changes section when available
  if (result.file_changes && fileChangesSection && fileChangesTextEl) {
    fileChangesSection.hidden = false;
    fileChangesTextEl.textContent = result.file_changes;
  }

  roundLogEl.innerHTML = (result.rounds || [])
    .map((round) => {
      const turns = (round.turns || [])
        .map((turn) => {
          const output = turn.output || "";
          const roleLabel = turn.org_role || turn.mode || "-";
          const error = turn.error
            ? `<div class="error">Error: ${escapeHtml(turn.error)}</div>`
            : "";
          const mcpMeta = turn.mcp_enabled
            ? `<div class="turn-meta">MCP: ${
                turn.mcp_context_used ? "context loaded" : "enabled"
              }${
                turn.mcp_context_error
                  ? ` (error: ${escapeHtml(turn.mcp_context_error)})`
                  : ""
              }</div>`
            : "";
          const fileChangesBlock = turn.file_changes
            ? `<details><summary class="file-changes-toggle">ファイル変更を表示</summary><pre class="code-diff">${escapeHtml(turn.file_changes)}</pre></details>`
            : "";
          return `
            <div class="turn">
              <h4>${escapeHtml(turn.agent_name)} (${roleLabel} / ${turn.provider})</h4>
              ${error}
              ${mcpMeta}
              <pre>${escapeHtml(output)}</pre>
              ${fileChangesBlock}
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

function renderExecutionPlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) {
    return;
  }
  const summary = plan
    .map((batch, idx) => `Step ${idx + 1}: ${(batch || []).join(" -> ")}`)
    .join("\n");
  const info = document.createElement("article");
  info.className = "round";
  info.innerHTML = `<h4>Execution Plan</h4><pre>${escapeHtml(summary)}</pre>`;
  roundLogEl.appendChild(info);
}

export function handleStreamEvent(event) {
  if (!event || typeof event !== "object") {
    return;
  }

  if (event.type === "run_started") {
    if (onNavigate) {
      onNavigate("log");
    }
    liveRunState = {
      totalTurns: Number(event.total_turns || 0),
      completedTurns: 0,
      hasWorkingDir: Boolean(event.has_working_dir),
      orchestrationMode: String(event.orchestration_mode || "sequential"),
    };
    resetLivePanels();
    renderExecutionPlan(event.execution_plan);
    const modeLabel = liveRunState.hasWorkingDir ? " [実コード生成]" : "";
    setStatus(
      `実行中... 0/${liveRunState.totalTurns}${modeLabel} [${liveRunState.orchestrationMode}]`,
      "running",
    );
    return;
  }

  if (event.type === "round_started") {
    ensureRoundElement(event.round_index);
    return;
  }

  if (event.type === "turn_started") {
    const header = `${event.agent_name} (${event.org_role || "-"} / ${event.provider})`;
    ensureTurnElement(
      event.round_index,
      event.turn_index,
      event.agent_id,
      header,
    );
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
    const header = `${turn.agent_name || "agent"} (${turn.org_role || "-"} / ${turn.provider || "-"})`;
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
    const mcpSuffix = turn.mcp_enabled
      ? `\n\n[MCP] ${
          turn.mcp_context_used ? "context loaded" : "enabled"
        }${
          turn.mcp_context_error
            ? ` | error: ${turn.mcp_context_error}`
            : ""
        }`
      : "";
    preEl.textContent = (turn.output || "(empty)") + mcpSuffix;

    // Show per-turn file changes
    if (turn.file_changes) {
      renderFileChangesInTurn(turnEl, turn.file_changes);
    }

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
    if (onNavigate) {
      onNavigate("results");
    }
    return;
  }

  if (event.type === "run_failed") {
    setStatus(`失敗: ${event.error || "unknown error"}`, "err");
  }
}
