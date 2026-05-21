// AGENT-REFINEMENT — Logs & Artifacts
// Browse runs/<id>/v<n>/  with audit-grade detail.

function LogsArtifacts({ density, sidebarMode }) {
  return (
    <div className="strand" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar breadcrumb={["workspace", "logs", "req_20260520_1283", "v2"]} density={density} theme="light"/>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideBar active="logs" mode={sidebarMode}/>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>

          {/* Header */}
          <div style={{
            padding: "12px 22px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 12, background: "var(--paper-2)",
          }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>LOGS & ARTIFACTS</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 }}>
                <h1 className="serif" style={{ fontSize: 22, fontStyle: "italic", letterSpacing: "-0.02em" }}>~/.agent-refinement/runs/</h1>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>284 versions · 47 runs · 18.4 GB</span>
              </div>
            </div>

            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              height: 30, padding: "0 10px", minWidth: 280,
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3,
            }}>
              <Icon name="search" size={12} color="var(--ink-3)"/>
              <input placeholder="filter status=running, template=team_local_full…" className="mono" style={{
                flex: 1, border: 0, background: "transparent", outline: "none",
                fontSize: 11, color: "var(--ink)",
              }}/>
            </div>

            <Btn variant="outline" icon="branch" size="md">Compare v1 ⇄ v2</Btn>
            <Btn variant="outline" icon="doc"    size="md">Export snapshot</Btn>
          </div>

          {/* 3-pane: run tree | artifact list | preview */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 320px 1fr", minHeight: 0 }}>

            {/* RUN TREE */}
            <aside style={{ borderRight: "1px solid var(--border)", overflow: "auto", background: "var(--paper)" }}>
              <div className="mono" style={{
                padding: "8px 14px", borderBottom: "1px solid var(--border)",
                fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>RUNS</span>
                <span style={{flex:1}}/>
                <span style={{ color: "var(--ink-2)" }}>47</span>
              </div>

              {RUNS.map(r => (
                <div key={r.id}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px",
                    background: r.selected ? "var(--surface-2)" : "transparent",
                    cursor: "pointer",
                  }}>
                    <Icon name="chevDn" size={9} color="var(--ink-3)"/>
                    <Icon name="play" size={11} color={r.status === "running" ? "var(--ok)" : r.status === "failed" ? "var(--danger)" : "var(--ink-2)"}/>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink)", fontWeight: r.selected ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{r.id}</span>
                    <Pill tone={r.status === "completed" ? "ok" : r.status === "running" ? "info" : r.status === "failed" ? "danger" : "neutral"}>{r.status}</Pill>
                  </div>
                  {r.versions && (
                    <div style={{ paddingLeft: 14 }}>
                      {r.versions.map(v => (
                        <div key={v.n} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "6px 14px",
                          background: v.selected ? "var(--surface)" : "transparent",
                          borderLeft: v.selected ? "2px solid var(--accent)" : "2px solid transparent",
                          cursor: "pointer",
                        }}>
                          <span style={{ width: 12, borderTop: "1px dashed var(--border-2)" }}/>
                          <Icon name="doc" size={10} color="var(--ink-3)"/>
                          <span className="mono" style={{ fontSize: 11, color: v.selected ? "var(--ink)" : "var(--ink-2)", fontWeight: v.selected ? 600 : 400 }}>{v.n}</span>
                          <span style={{flex:1}}/>
                          <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>{v.size}</span>
                          {v.failed && <Pill tone="danger">FAILED</Pill>}
                          {!v.failed && v.gate === "PASS" && <Dot tone="ok" size={5}/>}
                          {!v.failed && v.gate === "REWORK" && <Dot tone="warn" size={5}/>}
                          {!v.failed && v.gate === "ESCALATE" && <Dot tone="danger" size={5}/>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </aside>

            {/* ARTIFACT LIST */}
            <aside style={{ borderRight: "1px solid var(--border)", overflow: "auto", background: "var(--paper-2)" }}>
              <div className="mono" style={{
                padding: "8px 14px", borderBottom: "1px solid var(--border)",
                fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>req_20260520_1283 / v2 /</span>
                <span style={{flex:1}}/>
                <span style={{ color: "var(--ink-2)" }}>14 files</span>
              </div>

              <div style={{ padding: "4px 0" }}>
                {[
                  { name: "run.md",                kind: "front-matter", size: "3.2 KB", changed: false },
                  { name: "result.json",           kind: "final",         size: "84 KB",  changed: false },
                  { name: "events.ndjson",         kind: "stream",        size: "412 KB", changed: false, selected: true },
                  { name: "prompt-system.md",      kind: "prompt",        size: "12 KB",  changed: false },
                  { name: "meta.json",             kind: "stats",         size: "1.1 KB", changed: false },
                  { name: "diff.patch",            kind: "diff",          size: "8.4 KB", changed: true },
                ].map(f => <FileRow key={f.name} f={f}/>)}

                <div className="mono" style={{
                  padding: "10px 14px 4px", fontSize: 9, color: "var(--ink-3)",
                  letterSpacing: "0.12em",
                }}>turns/</div>
                {[
                  { name: "01-ceo.md",        kind: "turn", size: "1.8 KB", role: "CEO" },
                  { name: "02-manager.md",    kind: "turn", size: "4.2 KB", role: "MANAGER" },
                  { name: "03-worker_2.md",   kind: "turn", size: "12 KB",  role: "WORKER" },
                  { name: "04-worker_2.md",   kind: "turn", size: "8.6 KB", role: "WORKER" },
                  { name: "05-qa_1.md",       kind: "turn", size: "3.2 KB", role: "QA",   verdict: "PASS" },
                  { name: "06-qa_2.md",       kind: "turn", size: "3.8 KB", role: "QA",   verdict: "PASS" },
                  { name: "07-qa_3.md",       kind: "turn", size: "2.4 KB", role: "QA",   verdict: "PENDING" },
                ].map(f => <FileRow key={f.name} f={f} indent/>)}
              </div>
            </aside>

            {/* PREVIEW */}
            <section style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>
              {/* Preview header */}
              <div style={{
                padding: "10px 18px", borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: 10, background: "var(--surface)",
              }}>
                <Icon name="log" size={14} color="var(--ink-2)"/>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>events.ndjson</span>
                <Pill tone="neutral">stream</Pill>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>412 KB · 1,284 lines · UTF-8</span>
                <span style={{flex:1}}/>
                <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)" }}>
                  {["NDJSON","TABLE","TIMELINE"].map((t, i) => (
                    <button key={t} className="mono" style={{
                      padding: "4px 10px", fontSize: 10,
                      background: i === 1 ? "var(--ink)" : "transparent",
                      color: i === 1 ? "var(--paper)" : "var(--ink-2)",
                      borderRight: i < 2 ? "1px solid var(--border)" : "none",
                    }}>{t}</button>
                  ))}
                </div>
                <Btn variant="outline" size="sm" icon="doc">Export</Btn>
                <Btn variant="outline" size="sm" icon="link">Copy path</Btn>
              </div>

              {/* Table view of events */}
              <div style={{ flex: 1, overflow: "auto" }}>
                <div className="mono" style={{
                  display: "grid",
                  gridTemplateColumns: "120px 100px 130px 110px 80px 1fr",
                  padding: "8px 18px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  fontSize: 9, letterSpacing: "0.1em", color: "var(--ink-3)",
                  position: "sticky", top: 0, zIndex: 1,
                }}>
                  <span>TIMESTAMP</span>
                  <span>EVENT</span>
                  <span>AGENT</span>
                  <span>TURN</span>
                  <span>STATUS</span>
                  <span>PAYLOAD</span>
                </div>

                {[
                  { t: "09:20:00.142", ev: "run_started",      ag: "orchestrator", tn: "—",      st: "OK",   pl: "{ id: 'req_…_1283', mode: 'coding' }" },
                  { t: "09:20:01.025", ev: "ceo_decision",     ag: "ceo",          tn: "—",      st: "OK",   pl: "{ worker: 'sonnet-4-6', qa: 'codex' }" },
                  { t: "09:20:04.811", ev: "turn_started",     ag: "manager",      tn: "01",     st: "RUN",  pl: "{ round: 1 }" },
                  { t: "09:20:18.402", ev: "turn_output",      ag: "manager",      tn: "01",     st: "OK",   pl: "{ chunks: 14, bytes: 4200 }" },
                  { t: "09:20:20.911", ev: "turn_completed",   ag: "manager",      tn: "01",     st: "OK",   pl: "{ tokens_in: 800, tokens_out: 412 }" },
                  { t: "09:21:02.300", ev: "turn_started",     ag: "worker_2",     tn: "02",     st: "RUN",  pl: "{ depends_on: ['manager'] }" },
                  { t: "09:21:18.711", ev: "file_change",      ag: "worker_2",     tn: "02",     st: "OK",   pl: "{ path: 'services/payment.py', +: 18, -: 7 }" },
                  { t: "09:22:14.420", ev: "file_change",      ag: "worker_2",     tn: "02",     st: "OK",   pl: "{ path: 'tests/test_payment.py', +: 42, -: 12 }" },
                  { t: "09:22:54.018", ev: "turn_output",      ag: "worker_2",     tn: "02",     st: "WARN", pl: "{ tests: { pass: 6, fail: 2 } }" },
                  { t: "09:23:34.522", ev: "turn_completed",   ag: "worker_2",     tn: "02",     st: "OK",   pl: "{ tokens_in: 4200, tokens_out: 1100 }" },
                  { t: "09:24:18.110", ev: "gate_judgment",    ag: "qa_2",         tn: "04",     st: "WARN", pl: "{ verdict: 'REWORK', note: 'happy-path only' }" },
                  { t: "09:24:46.840", ev: "gate_judgment",    ag: "qa_1",         tn: "03",     st: "OK",   pl: "{ verdict: 'PASS' }" },
                  { t: "09:25:02.301", ev: "error",            ag: "qa_3",         tn: "05",     st: "ERR",  pl: "{ kind: 'ESCALATE', issue: 42 }" },
                  { t: "09:25:08.100", ev: "run_paused",       ag: "orchestrator", tn: "—",     st: "WARN", pl: "{ reason: 'awaiting_ceo_review' }" },
                ].map((e, i) => (
                  <div key={i} className="mono" style={{
                    display: "grid",
                    gridTemplateColumns: "120px 100px 130px 110px 80px 1fr",
                    padding: "5px 18px",
                    fontSize: 11, lineHeight: 1.5,
                    borderBottom: "1px dotted var(--border)",
                    background: i === 6 ? "color-mix(in oklab, var(--accent-soft) 30%, transparent)" : "transparent",
                    color: "var(--ink-2)",
                  }}>
                    <span style={{ color: "var(--ink-4)" }}>{e.t}</span>
                    <span style={{ color: evColor(e.ev) }}>{e.ev}</span>
                    <span style={{ color: "var(--ink)" }}>{e.ag}</span>
                    <span style={{ color: "var(--ink-3)" }}>{e.tn}</span>
                    <span style={{
                      color: e.st === "OK" ? "var(--ok)" : e.st === "WARN" ? "var(--warn)" : e.st === "ERR" ? "var(--danger)" : "var(--info)",
                      fontWeight: 600,
                    }}>{e.st}</span>
                    <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.pl}</span>
                  </div>
                ))}
              </div>

              {/* Footer: meta */}
              <div style={{
                borderTop: "1px solid var(--border)",
                background: "var(--paper-2)",
                padding: "10px 18px",
                display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
                fontSize: 11, fontFamily: "var(--font-mono)",
              }}>
                <MetaCell label="STATUS"      value="REWORK" tone="warn"/>
                <MetaCell label="TOTAL TURNS" value="12 · 7 agents"/>
                <MetaCell label="DURATION"    value="14:42"/>
                <MetaCell label="TOKENS"      value="184k in / 32k out"/>
                <MetaCell label="COST"        value="$0.84" tone="accent"/>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

const RUNS = [
  { id: "req_20260520_1284", status: "running",   selected: false, versions: [
    { n: "v1", size: "412 KB", gate: "PASS" },
    { n: "v2", size: "—",       gate: null, running: true },
  ]},
  { id: "req_20260520_1283", status: "rework",    selected: true, versions: [
    { n: "v1", size: "284 KB", gate: "REWORK" },
    { n: "v2", size: "412 KB", gate: "REWORK", selected: true },
  ]},
  { id: "req_20260520_1280", status: "paused",    versions: [
    { n: "v1", size: "112 KB", gate: "PASS" },
  ]},
  { id: "req_20260519_1276", status: "completed", versions: [
    { n: "v1", size: "284 KB", gate: "REWORK" },
    { n: "v2", size: "318 KB", gate: "PASS" },
  ]},
  { id: "req_20260519_1274", status: "failed",    versions: [
    { n: "v1-failed", size: "42 KB", failed: true },
  ]},
  { id: "req_20260518_1271", status: "completed", versions: [
    { n: "v1", size: "194 KB", gate: "PASS" },
  ]},
];

function FileRow({ f, indent }) {
  const kindIcon = { stream: "log", final: "doc", front: "doc", prompt: "doc", stats: "doc", diff: "branch", turn: "user", "front-matter": "doc" }[f.kind] || "doc";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: indent ? "5px 14px 5px 30px" : "6px 14px",
      background: f.selected ? "var(--surface)" : "transparent",
      borderLeft: f.selected ? "2px solid var(--accent)" : "2px solid transparent",
      cursor: "pointer",
    }}>
      {indent && <span style={{ width: 8, borderTop: "1px dashed var(--border-2)" }}/>}
      <Icon name={kindIcon} size={11} color={f.selected ? "var(--accent)" : "var(--ink-3)"}/>
      <span className="mono" style={{ fontSize: 11, color: f.selected ? "var(--ink)" : "var(--ink-2)", fontWeight: f.selected ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {f.name}
      </span>
      {f.role && <RoleBadge role={f.role}/>}
      {f.verdict && (
        <Pill tone={f.verdict === "PASS" ? "ok" : f.verdict === "REWORK" ? "warn" : "info"}>{f.verdict}</Pill>
      )}
      <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>{f.size}</span>
    </div>
  );
}

function MetaCell({ label, value, tone }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: tone ? `var(--${tone}${tone === "warn" ? "" : "-deep"})` : "var(--ink)", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function evColor(ev) {
  if (ev.startsWith("run_")) return "var(--info)";
  if (ev === "ceo_decision") return "var(--ink)";
  if (ev.startsWith("turn_")) return "var(--agent)";
  if (ev === "file_change") return "var(--accent-deep)";
  if (ev === "gate_judgment") return "var(--warn)";
  if (ev === "error") return "var(--danger)";
  return "var(--ink-3)";
}

window.LogsArtifacts = LogsArtifacts;
