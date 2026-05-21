// STRAND — Logs & Artifacts (artboard 08). Run tree + event table + server/agent logs.
import { useEffect, useMemo, useState } from "react";
import { StrandShell } from "../components/strand/Chrome";
import { Btn, Icon, Pill, type Tone } from "../components/strand/primitives";
import { useApp } from "../state/store";
import { api } from "../api/client";
import { PROVIDER_LABEL, ROLE_LABEL } from "../lib/format";
import type { AgentLogSummary, StreamEvent } from "../types";

type View = "events" | "server" | "agents";

export function Logs() {
  const turns = useApp((s) => s.run.turns);
  const events = useApp((s) => s.run.events);
  const runStatus = useApp((s) => s.run.status);
  const managedRequests = useApp((s) => s.managedRequests);

  const [view, setView] = useState<View>("events");
  const [query, setQuery] = useState("");

  return (
    <StrandShell
      breadcrumb={["workspace", "logs"]}
      mainStyle={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* Header */}
      <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, background: "var(--paper-2)" }}>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>LOGS & ARTIFACTS</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 }}>
            <h1 className="serif" style={{ fontSize: 22, fontStyle: "italic", letterSpacing: "-0.02em" }}>~/.agent-refinement/runs/</h1>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{managedRequests.length} runs · {turns.length} turns this session</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 30, padding: "0 10px", minWidth: 280, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3 }}>
          <Icon name="search" size={12} color="var(--ink-3)" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter events / log lines…" className="mono" style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 11, color: "var(--ink)" }} />
        </div>
        <Btn variant="outline" icon="doc" size="md" onClick={() => exportRun(events, turns)}>Export</Btn>
      </div>

      {/* 2-pane: run tree + preview */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr", minHeight: 0 }}>
        {/* RUN TREE */}
        <aside style={{ borderRight: "1px solid var(--border)", overflow: "auto", background: "var(--paper)" }}>
          <div className="mono" style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em", display: "flex", gap: 6 }}>
            <span>RUNS</span><span style={{ flex: 1 }} /><span style={{ color: "var(--ink-2)" }}>{managedRequests.length}</span>
          </div>
          {runStatus !== "idle" && <RunRow id="(current session)" status={runStatus} />}
          {managedRequests.map((r) => (
            <RunRow key={r.id} id={r.id} title={r.title} status={r.status} />
          ))}
          {managedRequests.length === 0 && runStatus === "idle" && (
            <div style={{ padding: 20, fontSize: 12, color: "var(--ink-3)" }}>実行履歴がありません。</div>
          )}
        </aside>

        {/* PREVIEW */}
        <section style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>
          <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface)" }}>
            <Icon name="log" size={14} color="var(--ink-2)" />
            <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
              {view === "events" ? "events.ndjson" : view === "server" ? "server.log" : "agents/*.log"}
            </span>
            <span style={{ flex: 1 }} />
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
              {(["events", "server", "agents"] as View[]).map((v, i) => (
                <button key={v} onClick={() => setView(v)} className="mono" style={{
                  padding: "4px 10px", fontSize: 10,
                  background: v === view ? "var(--ink)" : "transparent",
                  color: v === view ? "var(--paper)" : "var(--ink-2)",
                  borderRight: i < 2 ? "1px solid var(--border)" : "none",
                }}>{v === "events" ? "EVENTS" : v === "server" ? "SERVER" : "AGENTS"}</button>
              ))}
            </div>
          </div>

          {view === "events" && <EventTable events={events} turns={turns} query={query} />}
          {view === "server" && <ServerLogPane query={query} />}
          {view === "agents" && <AgentLogPane query={query} />}
        </section>
      </div>
    </StrandShell>
  );
}

function RunRow({ id, title, status }: { id: string; title?: string; status: string }) {
  const tone: Tone =
    status === "completed" ? "ok" : status === "running" ? "info" : status === "failed" ? "danger" : status === "paused" ? "neutral" : "warn";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
      <Icon name="play" size={11} color={status === "running" ? "var(--ok)" : status === "failed" ? "var(--danger)" : "var(--ink-2)"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{id.slice(0, 22)}</span>
        {title && <span style={{ fontSize: 10, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{title}</span>}
      </div>
      <Pill tone={tone}>{status}</Pill>
    </div>
  );
}

function EventTable({ events, turns, query }: { events: StreamEvent[]; turns: { error?: string | null }[]; query: string }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => JSON.stringify(e).toLowerCase().includes(q));
  }, [events, query]);
  const passCount = turns.filter((t) => !t.error).length;
  const failCount = turns.filter((t) => t.error).length;

  return (
    <>
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="mono" style={{ display: "grid", gridTemplateColumns: "110px 130px 130px 1fr", padding: "8px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 9, letterSpacing: "0.1em", color: "var(--ink-3)", position: "sticky", top: 0, zIndex: 1 }}>
          <span>TIMESTAMP</span><span>EVENT</span><span>AGENT</span><span>PAYLOAD</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, fontSize: 12, color: "var(--ink-3)" }}>
            {events.length === 0 ? "イベントはまだありません。実行を開始すると表示されます。" : "条件に一致するイベントがありません。"}
          </div>
        ) : (
          filtered.map((e, i) => (
            <div key={i} className="mono" style={{ display: "grid", gridTemplateColumns: "110px 130px 130px 1fr", padding: "5px 18px", fontSize: 11, lineHeight: 1.5, borderBottom: "1px dotted var(--border)", color: "var(--ink-2)" }}>
              <span style={{ color: "var(--ink-4)" }}>{e.received_at ? new Date(e.received_at).toLocaleTimeString("ja-JP") : "—"}</span>
              <span style={{ color: evColor(e.type) }}>{e.type}</span>
              <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evAgent(e)}</span>
              <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evPayload(e)}</span>
            </div>
          ))
        )}
      </div>
      <div style={{ borderTop: "1px solid var(--border)", background: "var(--paper-2)", padding: "10px 18px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        <MetaCell label="EVENTS" value={String(events.length)} />
        <MetaCell label="TURNS" value={String(turns.length)} />
        <MetaCell label="PASS" value={String(passCount)} tone="ok" />
        <MetaCell label="ERRORS" value={String(failCount)} tone={failCount ? "danger" : undefined} />
      </div>
    </>
  );
}

function ServerLogPane({ query }: { query: string }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { const r = await api.getServerLogs(); setContent(r.content); } catch { /* noop */ } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const text = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return content;
    return content.split("\n").filter((l) => l.toLowerCase().includes(q)).join("\n");
  }, [content, query]);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "6px 18px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <Btn variant="outline" size="sm" icon="terminal" onClick={() => void load()}>{loading ? "読込中" : "更新"}</Btn>
      </div>
      <pre className="mono" style={{ flex: 1, margin: 0, overflow: "auto", padding: "10px 18px", fontSize: 11, lineHeight: 1.5, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>
        {text || "(ログはまだありません)"}
      </pre>
    </div>
  );
}

function AgentLogPane({ query }: { query: string }) {
  const [list, setList] = useState<AgentLogSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  useEffect(() => {
    api.listAgentLogs().then((r) => { setList(r.agents); if (r.agents[0]) setSelected(r.agents[0].agent_id); }).catch(() => setList([]));
  }, []);
  useEffect(() => {
    if (selected) api.getAgentLog(selected).then((r) => setContent(r.content)).catch(() => setContent(""));
  }, [selected]);
  const text = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return content;
    return content.split("\n").filter((l) => l.toLowerCase().includes(q)).join("\n");
  }, [content, query]);
  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "220px 1fr", minHeight: 0 }}>
      <div style={{ borderRight: "1px solid var(--border)", overflow: "auto", background: "var(--paper-2)" }}>
        {list.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--ink-3)" }}>エージェントログがありません。</div>}
        {list.map((a) => (
          <button key={a.agent_id} onClick={() => setSelected(a.agent_id)} className="mono" style={{
            display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12,
            borderBottom: "1px solid var(--border)",
            background: selected === a.agent_id ? "var(--surface)" : "transparent",
            borderLeft: selected === a.agent_id ? "2px solid var(--accent)" : "2px solid transparent",
            color: "var(--ink)",
          }}>
            {a.agent_id}
            <span style={{ display: "block", fontSize: 10, color: "var(--ink-3)" }}>{(a.size / 1024).toFixed(1)} KB</span>
          </button>
        ))}
      </div>
      <pre className="mono" style={{ margin: 0, overflow: "auto", padding: "10px 18px", fontSize: 11, lineHeight: 1.5, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}>
        {text || "(エージェントを選択)"}
      </pre>
    </div>
  );
}

function MetaCell({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{label}</div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: tone ? `var(--${tone})` : "var(--ink)", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function exportRun(events: StreamEvent[], turns: unknown[]) {
  const blob = new Blob([JSON.stringify({ events, turns }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `run-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function evColor(ev: string): string {
  if (ev === "run_failed") return "var(--danger)";
  if (ev.startsWith("run_")) return "var(--info)";
  if (ev.startsWith("round_")) return "var(--ink)";
  if (ev.startsWith("turn_")) return "var(--agent)";
  return "var(--ink-3)";
}
function evAgent(e: StreamEvent): string {
  if ("agent_name" in e && e.agent_name) return e.agent_name as string;
  if (e.type === "turn_completed") return (e.turn as { agent_name?: string })?.agent_name ?? "—";
  return "—";
}
function evPayload(e: StreamEvent): string {
  if (e.type === "turn_phase") return `${(e as { phase?: string }).phase ?? ""}`;
  if (e.type === "turn_completed") {
    const t = (e as { turn?: { org_role?: string; provider?: string } }).turn;
    const role = t?.org_role ? ROLE_LABEL[t.org_role as never] ?? t.org_role : "";
    const prov = t?.provider ? PROVIDER_LABEL[t.provider as never] ?? t.provider : "";
    return `${role} · ${prov}`;
  }
  if (e.type === "run_failed") return (e as { error?: string }).error ?? "";
  if (e.type === "round_started") return `round #${(e as { round_index?: number }).round_index ?? ""}`;
  return "";
}
