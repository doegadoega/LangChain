// STRAND — Dashboard / Home (artboard 02), wired to the real store.
import type { CSSProperties } from "react";
import { useApp } from "../state/store";
import { StrandShell } from "../components/strand/Chrome";
import { Btn, Dot, Icon, Panel, Pill, Stat } from "../components/strand/primitives";
import { PROVIDER_LABEL, ROLE_LABEL } from "../lib/format";

const iconBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  borderRadius: 3,
  color: "var(--ink-2)",
};

function fmtClock(d = new Date()) {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const mon = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${days[d.getDay()]} · ${mon[d.getMonth()]} ${d.getDate()} · ${hh}:${mm} JST`;
}

export function Dashboard() {
  const run = useApp((s) => s.run);
  const agents = useApp((s) => s.request.agents);
  const managedRequests = useApp((s) => s.managedRequests);
  const templates = useApp((s) => s.templates);
  const setScreen = useApp((s) => s.setScreen);

  const enabled = agents.filter((a) => a.enabled !== false);
  const passCount = run.turns.filter((t) => !t.error).length;
  const failCount = run.turns.filter((t) => t.error).length;
  const passRate = run.turns.length === 0 ? 0 : Math.round((passCount / run.turns.length) * 100);
  const activeRuns = managedRequests.filter((r) => r.status === "running");
  const decisions = managedRequests.filter((r) => (r.verification_feedback?.length ?? 0) > 0 || r.error);

  const stats = [
    { label: "ACTIVE RUNS", value: String(activeRuns.length || (run.status === "running" ? 1 : 0)), delta: null },
    { label: "PASS RATE", value: `${passRate}%`, delta: passRate >= 80 ? "+" : null },
    { label: "REWORK", value: String(failCount), delta: null },
    { label: "ESCALATED", value: String(run.status === "failed" ? 1 : 0), delta: null },
    { label: "TURNS · RUN", value: String(run.turns.length), delta: null },
    { label: "AGENTS", value: String(enabled.length), delta: null },
  ];

  return (
    <StrandShell breadcrumb={["workspace", "dashboard"]} mainStyle={{ padding: 24 }}>
          {/* Greeting */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                {fmtClock()}
              </div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
                <h1 className="serif" style={{ fontSize: 38, fontStyle: "italic", letterSpacing: "-0.02em" }}>
                  Agent Refinement
                </h1>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  ↳ {activeRuns.length} runs active · {decisions.length} need review
                </span>
              </div>
            </div>
            <Btn variant="solid" tone="accent" icon="play" size="lg" onClick={() => setScreen("coding")}>
              Resume run
            </Btn>
            <Btn variant="outline" icon="terminal" size="lg" onClick={() => setScreen("execution")}>
              orchestrate
            </Btn>
          </div>

          {/* Stat strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              marginBottom: 24,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              borderRadius: 4,
            }}
          >
            {stats.map((s, i) => (
              <div key={i} style={{ padding: "14px 16px", borderRight: i < 5 ? "1px solid var(--border)" : "none" }}>
                <Stat label={s.label} value={s.value} delta={s.delta} />
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Panel
                title="Active runs"
                accent="var(--agent)"
                action={
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                    {managedRequests.length} requests
                  </span>
                }
                padded={false}
              >
                {managedRequests.length === 0 ? (
                  <EmptyRow text="まだ実行依頼がありません。Coding か Workspace から作成してください。" />
                ) : (
                  managedRequests.slice(0, 6).map((r, i) => {
                    const state = r.status === "running" ? "running" : r.status === "paused" ? "paused" : r.error ? "waiting" : "done";
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto auto",
                          alignItems: "center",
                          gap: 14,
                          padding: "12px 14px",
                          borderTop: i > 0 ? "1px solid var(--border)" : "none",
                          cursor: "pointer",
                        }}
                        onClick={() => setScreen("workspace")}
                      >
                        <div
                          style={{
                            width: 4,
                            alignSelf: "stretch",
                            background:
                              state === "running" ? "var(--ok)" : state === "waiting" ? "var(--warn)" : state === "paused" ? "var(--ink-3)" : "var(--border-2)",
                          }}
                        />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.id.slice(0, 18)}</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{r.title}</span>
                            <Pill tone={r.request.workflow_mode === "coding" ? "accent" : "neutral"}>
                              {(r.request.workflow_mode ?? "writing").toUpperCase()}
                            </Pill>
                            {state === "running" && <Pill tone="ok"><Dot tone="ok" size={5} /> RUNNING</Pill>}
                            {state === "waiting" && <Pill tone="warn">NEEDS REVIEW</Pill>}
                            {state === "paused" && <Pill tone="neutral">PAUSED</Pill>}
                            {state === "done" && <Pill tone="neutral">DONE</Pill>}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-2)" }}>
                            <span className="mono" style={{ color: "var(--ink-3)" }}>
                              {r.request.code_context?.working_directory || "no working dir"}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                            {r.agent_turns?.length ?? 0}
                          </div>
                          <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em" }}>TURNS</div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button style={iconBtnStyle}><Icon name="eye" size={11} /></button>
                          <button style={iconBtnStyle}><Icon name="more" size={11} /></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </Panel>

              <Panel
                title="Live activity"
                accent="var(--accent)"
                action={
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Dot tone={run.status === "running" ? "ok" : "neutral"} size={6} />
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                      {run.status === "running" ? "STREAMING" : run.status.toUpperCase()}
                    </span>
                  </div>
                }
                padded={false}
              >
                {run.events.length === 0 ? (
                  <EmptyRow text="イベントはまだありません。" />
                ) : (
                  run.events.slice(-10).reverse().map((e, i) => (
                    <div
                      key={i}
                      className="mono"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "70px 90px 1fr",
                        alignItems: "center",
                        gap: 10,
                        padding: "6px 14px",
                        fontSize: 11,
                        borderTop: i > 0 ? "1px dotted var(--border)" : "none",
                        color: "var(--ink-2)",
                      }}
                    >
                      <span style={{ color: "var(--ink-3)" }}>
                        {e.received_at ? new Date(e.received_at).toLocaleTimeString("ja-JP") : ""}
                      </span>
                      <Pill
                        tone={
                          e.type === "turn_completed" || e.type === "turn_phase"
                            ? "agent"
                            : e.type === "run_failed"
                              ? "danger"
                              : e.type === "run_completed"
                                ? "ok"
                                : "info"
                        }
                        style={{ justifyContent: "center" }}
                      >
                        {e.type.replace("_", " ")}
                      </Pill>
                      <span style={{ fontFamily: "var(--strand-font-sans)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {eventSummary(e)}
                      </span>
                    </div>
                  ))
                )}
              </Panel>
            </div>

            {/* RIGHT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Panel title="Decision queue · CEO" accent="var(--accent)" padded={false}>
                {decisions.length === 0 ? (
                  <EmptyRow text="CEO の判断待ちはありません。" />
                ) : (
                  decisions.slice(0, 5).map((r, i) => (
                    <div
                      key={r.id}
                      style={{
                        padding: "12px 14px",
                        borderTop: i > 0 ? "1px solid var(--border)" : "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        background: r.error ? "color-mix(in oklab, var(--danger-bg) 35%, transparent)" : "transparent",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Pill tone={r.error ? "danger" : "warn"}>{r.error ? "ESCALATE" : "REVIEW"}</Pill>
                        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{r.id.slice(0, 16)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--ink)" }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.error ?? `${r.verification_feedback?.length ?? 0} feedback`}</div>
                    </div>
                  ))
                )}
              </Panel>

              <Panel title="Decision agents" accent="var(--agent)" padded={false}>
                {enabled.filter((a) => a.model_decision === "ceo_decides").length === 0 ? (
                  <EmptyRow text="CEO 決定対象のエージェントはありません。" />
                ) : (
                  enabled
                    .filter((a) => a.model_decision === "ceo_decides")
                    .map((a, i) => (
                      <div
                        key={a.id}
                        style={{ padding: "12px 14px", borderTop: i > 0 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <Icon name="agent" size={12} color="var(--agent-deep)" />
                        <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>{a.name}</span>
                        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{ROLE_LABEL[a.org_role]}</span>
                        <Pill tone={a.model ? "ok" : "warn"}>{a.model || "未決定"}</Pill>
                      </div>
                    ))
                )}
              </Panel>

              <Panel title="Recent templates" padded={false}>
                {templates.slice(0, 4).map((tpl, i) => (
                  <div
                    key={tpl.id}
                    style={{ padding: "12px 14px", borderTop: i > 0 ? "1px solid var(--border)" : "none", display: "flex", flexDirection: "column", gap: 4, cursor: "pointer" }}
                    onClick={() => setScreen("team")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="user" size={12} color="var(--ink-2)" />
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{tpl.name}</span>
                      <span style={{ flex: 1 }} />
                      <Pill tone="agent">{tpl.agents.length} agents</Pill>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", display: "flex", gap: 12, marginTop: 2 }}>
                      <span><Dot tone="accent" size={5} /> {tpl.orchestration_mode ?? "role_based"}</span>
                      <span>rounds: {tpl.rounds ?? 1}</span>
                      <span>{(tpl.agents[0] && PROVIDER_LABEL[tpl.agents[0].provider]) || ""}</span>
                    </div>
                  </div>
                ))}
              </Panel>
            </div>
          </div>
    </StrandShell>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ padding: "20px 14px", textAlign: "center", fontSize: 12, color: "var(--ink-3)" }}>{text}</div>
  );
}

function eventSummary(e: { type: string } & Record<string, unknown>): string {
  switch (e.type) {
    case "turn_completed":
      return `turn_completed · ${(e as { turn?: { agent_name?: string } }).turn?.agent_name ?? ""}`;
    case "turn_phase":
      return `${(e as { agent_name?: string }).agent_name ?? ""} · ${(e as { phase?: string }).phase ?? ""}`;
    case "turn_started":
      return `turn_started · ${(e as { agent_name?: string }).agent_name ?? ""}`;
    case "round_started":
      return `round_started · #${(e as { round_index?: number }).round_index ?? ""}`;
    case "run_failed":
      return `run_failed · ${(e as { error?: string }).error ?? ""}`;
    case "run_completed":
      return "run_completed";
    default:
      return e.type;
  }
}
