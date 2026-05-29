// STRAND — Advanced Run. Config form | stream events | agent outputs + diff.
// Presentation migrated to the strand design system; behavior preserved verbatim.
import { useMemo, useState } from "react";
import { Activity, FileDiff, Hash, RefreshCcw, Terminal } from "lucide-react";
import { StrandShell } from "../components/strand/Chrome";
import { Btn, Panel, Pill } from "../components/strand/primitives";
import { fieldLabelStyle, inputStyle, selectStyle, textareaStyle } from "../components/strand/formStyles";
import { useApp } from "../state/store";
import { PROVIDER_LABEL, ROLE_LABEL, formatDuration, formatTime } from "../lib/format";
import type { Status } from "../components/ui/StatusBadge";

const STATUS_TONE: Record<Status, "neutral" | "ok" | "warn" | "danger" | "info"> = {
  PASS: "ok",
  REWORK: "warn",
  ESCALATE: "danger",
  RUNNING: "info",
  IDLE: "neutral",
};

export function Execution() {
  const request = useApp((s) => s.request);
  const updateRequest = useApp((s) => s.updateRequest);
  const run = useApp((s) => s.run);
  const startRun = useApp((s) => s.startRun);
  const stopRun = useApp((s) => s.stopRun);
  const resetRun = useApp((s) => s.resetRun);

  const [activeTurn, setActiveTurn] = useState<string | null>(null);

  const enabledAgents = useMemo(
    () => request.agents.filter((a) => a.enabled !== false),
    [request.agents],
  );

  const turnStatusFor = (agentId: string): Status => {
    const last = [...run.turns].reverse().find((t) => t.agent_id === agentId);
    if (!last) return "IDLE";
    if (last.error) return "ESCALATE";
    return "PASS";
  };

  return (
    <StrandShell breadcrumb={["design", "advanced-run"]} mainStyle={{ display: "flex", overflow: "hidden" }}>
      <style>{"@keyframes adv-run-pulse{0%,100%{opacity:1}50%{opacity:0.3}}.adv-run-pulse{animation:adv-run-pulse 1.4s ease-in-out infinite}"}</style>
      <div
        className="advanced-run"
        style={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "360px minmax(0,1fr) minmax(0,1fr)",
          gap: 16,
          padding: 16,
          background: "var(--paper)",
          overflow: "hidden",
        }}
      >
        {/* Run config */}
        <Panel
          title="Run Settings"
          action={
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {enabledAgents.length} agents
            </span>
          }
          padded={false}
          style={{ minHeight: 0 }}
        >
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <span className="mono" style={fieldLabelStyle}>workflow_mode</span>
              <select
                value={request.workflow_mode}
                onChange={(e) => updateRequest({ workflow_mode: e.target.value as never })}
                className="mono"
                style={selectStyle()}
              >
                <option value="writing">writing</option>
                <option value="coding">coding</option>
              </select>
            </div>
            <div>
              <span className="mono" style={fieldLabelStyle}>orchestration_mode</span>
              <select
                value={request.orchestration_mode}
                onChange={(e) => updateRequest({ orchestration_mode: e.target.value as never })}
                className="mono"
                style={selectStyle()}
              >
                <option value="sequential">sequential</option>
                <option value="role_based">role_based</option>
                <option value="dependency_graph">dependency_graph</option>
              </select>
            </div>
            <div>
              <span className="mono" style={fieldLabelStyle}>rounds (1-5)</span>
              <input
                type="number"
                min={1}
                max={5}
                value={request.rounds}
                onChange={(e) => updateRequest({ rounds: Math.max(1, Math.min(5, +e.target.value)) })}
                style={inputStyle()}
              />
            </div>
            {request.workflow_mode === "coding" && (
              <div>
                <span className="mono" style={fieldLabelStyle}>working_directory</span>
                <input
                  placeholder="/path/to/repo"
                  value={request.code_context.working_directory}
                  onChange={(e) =>
                    updateRequest({
                      code_context: { ...request.code_context, working_directory: e.target.value },
                    })
                  }
                  className="mono"
                  style={{ ...inputStyle(), fontFamily: "var(--strand-font-mono)" }}
                />
              </div>
            )}
            <div>
              <span className="mono" style={fieldLabelStyle}>objective</span>
              <input
                placeholder="目的"
                value={request.objective}
                onChange={(e) => updateRequest({ objective: e.target.value })}
                style={inputStyle()}
              />
            </div>
            <div>
              <span className="mono" style={fieldLabelStyle}>global_instruction</span>
              <textarea
                placeholder="全体ルール"
                value={request.global_instruction}
                onChange={(e) => updateRequest({ global_instruction: e.target.value })}
                style={textareaStyle()}
              />
            </div>
            <div>
              <span className="mono" style={fieldLabelStyle}>source_text · 要件</span>
              <textarea
                rows={6}
                placeholder="推敲対象のテキスト / 要件"
                value={request.source_text}
                onChange={(e) => updateRequest({ source_text: e.target.value })}
                style={textareaStyle()}
              />
            </div>
            <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
              {run.status === "running" ? (
                <Btn
                  variant="solid"
                  onClick={stopRun}
                  style={{ flex: 1, justifyContent: "center", background: "var(--danger)", borderColor: "var(--danger)", color: "white" }}
                >
                  停止
                </Btn>
              ) : (
                <Btn
                  variant="solid"
                  tone="accent"
                  onClick={() => startRun()}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  ▶ 実行開始
                </Btn>
              )}
              <Btn variant="outline" onClick={resetRun} title="リセット" style={{ width: 36, padding: 0, justifyContent: "center" }}>
                <RefreshCcw style={{ width: 16, height: 16 }} />
              </Btn>
            </div>
          </div>
        </Panel>

        {/* Stream log */}
        <Panel
          title={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Activity style={{ width: 14, height: 14, color: "var(--ink-3)" }} />
              Stream Events
            </span>
          }
          action={
            <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--ink-3)" }}>
              <span>round {run.currentRound}/{request.rounds}</span>
              <span>·</span>
              <span>{formatDuration(run.startedAt, run.endedAt)}</span>
            </span>
          }
          padded={false}
          style={{ minHeight: 0 }}
        >
          <div
            className="mono"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontSize: 11,
            }}
          >
            {run.events.length === 0 && (
              <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 12, color: "var(--ink-3)" }}>
                実行待機中
              </div>
            )}
            {run.events.map((ev, i) => (
              <EventRow key={i} ev={ev} onSelectTurn={setActiveTurn} />
            ))}
            {run.error && (
              <div
                style={{
                  borderRadius: 3,
                  border: "1px solid var(--danger)",
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  padding: 8,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                }}
              >
                {run.error}
              </div>
            )}
          </div>
        </Panel>

        {/* Right: turns & diff */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "hidden", minWidth: 0 }}>
          <Panel
            title={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Terminal style={{ width: 14, height: 14, color: "var(--ink-3)" }} />
                Agent Outputs
              </span>
            }
            action={
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                {run.turns.length} turns
              </span>
            }
            padded={false}
            style={{ minHeight: "40%" }}
          >
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {enabledAgents.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>エージェント未配置</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                {enabledAgents.map((a) => {
                  const status = turnStatusFor(a.id);
                  const last = [...run.turns].reverse().find((t) => t.agent_id === a.id);
                  const sel = activeTurn === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setActiveTurn(a.id)}
                      style={{
                        textAlign: "left",
                        padding: 8,
                        borderRadius: 4,
                        border: sel ? "1px solid var(--accent)" : "1px solid var(--border)",
                        background: sel ? "var(--surface)" : "var(--surface-2)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.name}
                        </span>
                        <Pill tone={STATUS_TONE[status]}>{status}</Pill>
                      </div>
                      <div className="mono" style={{ marginTop: 4, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                        {ROLE_LABEL[a.org_role]} · {PROVIDER_LABEL[a.provider]}
                      </div>
                      {last?.output && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 11,
                            color: "var(--ink-3)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {last.output.slice(0, 120)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>

          <Panel
            title={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FileDiff style={{ width: 14, height: 14, color: "var(--ink-3)" }} />
                {activeTurn ? "Turn Output" : "Diff Viewer"}
              </span>
            }
            action={
              run.finalText && !activeTurn ? (
                <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--ink-3)" }}>
                  <Hash style={{ width: 12, height: 12 }} />
                  final {run.finalText.length}c
                </span>
              ) : undefined
            }
            padded={false}
            style={{ minHeight: 0, flex: 1 }}
          >
            <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
              {activeTurn ? (
                <TurnView agentId={activeTurn} />
              ) : run.diff ? (
                <DiffView text={run.diff} />
              ) : (
                <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 12, color: "var(--ink-3)" }}>
                  差分・最終稿はここに表示
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </StrandShell>
  );
}

function TurnView({ agentId }: { agentId: string }) {
  const turns = useApp((s) => s.run.turns.filter((t) => t.agent_id === agentId));
  if (turns.length === 0)
    return <div style={{ fontSize: 12, color: "var(--ink-3)" }}>出力なし</div>;
  const last = turns[turns.length - 1];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {last.error && (
        <div
          style={{
            borderRadius: 3,
            border: "1px solid var(--danger)",
            background: "var(--danger-bg)",
            color: "var(--danger)",
            padding: 8,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          {last.error}
        </div>
      )}
      <pre
        className="mono"
        style={{
          whiteSpace: "pre-wrap",
          fontSize: 12,
          lineHeight: 1.6,
          color: "var(--ink)",
          margin: 0,
        }}
      >
        {last.output || "(空)"}
      </pre>
      {last.file_changes && (
        <div>
          <div className="mono" style={{ marginBottom: 6, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)" }}>
            file changes
          </div>
          <DiffView text={last.file_changes} />
        </div>
      )}
    </div>
  );
}

function DiffView({ text }: { text: string }) {
  return (
    <div style={{ overflow: "auto", borderRadius: 4, border: "1px solid var(--border)", background: "var(--paper)" }}>
      {text.split("\n").map((line, i) => {
        const tone = line.startsWith("+")
          ? { color: "var(--ok)", background: "var(--ok-bg)" }
          : line.startsWith("-")
            ? { color: "var(--danger)", background: "var(--danger-bg)" }
            : line.startsWith("@@")
              ? { color: "var(--accent-deep)", background: "transparent" }
              : { color: "var(--ink-3)", background: "transparent" };
        return (
          <div
            key={i}
            className="mono"
            style={{ padding: "1px 12px", fontSize: 11, whiteSpace: "pre", color: tone.color, background: tone.background }}
          >
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}

function EventRow({
  ev,
  onSelectTurn,
}: {
  ev: ReturnType<typeof useApp.getState>["run"]["events"][number];
  onSelectTurn: (id: string) => void;
}) {
  const time = formatTime(Date.now());
  let label = "";
  let tone = "var(--ink-3)";
  switch (ev.type) {
    case "run_started":
      label = "run_started";
      tone = "var(--ok)";
      break;
    case "round_started":
      label = `round_started · ${ev.round_index}`;
      tone = "var(--ok)";
      break;
    case "turn_started":
      label = `turn_started · ${ev.agent_name} (${ROLE_LABEL[ev.org_role]})`;
      tone = "var(--info)";
      break;
    case "turn_completed":
      label = `turn_completed · ${ev.turn.agent_name}${ev.turn.error ? " · ERROR" : ""}`;
      tone = ev.turn.error ? "var(--danger)" : "var(--ok)";
      break;
    case "round_completed":
      label = `round_completed · ${ev.round_index}`;
      tone = "var(--accent-deep)";
      break;
    case "run_completed":
      label = "run_completed";
      tone = "var(--ok)";
      break;
    case "run_failed":
      label = `run_failed · ${ev.error}`;
      tone = "var(--danger)";
      break;
  }
  const clickable = ev.type === "turn_completed";
  return (
    <button
      disabled={!clickable}
      onClick={() => clickable && onSelectTurn((ev as { turn: { agent_id: string } }).turn.agent_id)}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "flex-start",
        gap: 8,
        borderRadius: 3,
        padding: "4px 8px",
        textAlign: "left",
        background: "transparent",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <span style={{ color: "var(--ink-4)" }}>[{time}]</span>
      <span style={{ color: tone }}>{label}</span>
    </button>
  );
}
