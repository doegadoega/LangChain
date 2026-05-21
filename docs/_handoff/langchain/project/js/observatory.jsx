// AGENT-REFINEMENT — Execution (Coding Mode)
// Mission-control for a single Run: roster of agents, NDJSON event stream, current turn detail.

function Observatory({ density, sidebarMode }) {
  return (
    <div className="strand" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar breadcrumb={["workspace", "execution", "req_20260520_1284"]} density={density} theme="light"/>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideBar active="execution" mode={sidebarMode}/>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>

          {/* Title bar */}
          <div style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "flex-end", gap: 18,
            background: "var(--paper-2)",
          }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                EXECUTION · CODING · dependency_graph · round 2/3
              </div>
              <h1 className="serif" style={{ fontSize: 28, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 2 }}>
                feature: payment-flow webhook
              </h1>
              <div className="mono" style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>req_20260520_1284</span>
                <span>·</span>
                <span>worktree: ai/req_1284</span>
                <span>·</span>
                <span>working_dir: ~/repos/foo</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 3, overflow: "hidden" }}>
              {["LIVE","REPLAY","VERSIONS (v2)"].map((t, i) => (
                <button key={t} style={{
                  padding: "0 14px", height: 30, fontSize: 11, fontFamily: "var(--font-mono)",
                  background: i === 0 ? "var(--ink)" : "transparent",
                  color: i === 0 ? "var(--paper)" : "var(--ink-2)",
                  borderRight: i < 2 ? "1px solid var(--border)" : "none",
                  letterSpacing: "0.04em",
                }}>{t}</button>
              ))}
            </div>
            <Btn variant="solid" tone="accent" icon="stop">Stop all</Btn>
          </div>

          {/* Stat strip */}
          <div className="mono" style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            fontSize: 11,
          }}>
            {[
              ["AGENTS",       "7 / 8 enabled",          "var(--ok)"],
              ["EVENTS/MIN",   "142",                    null],
              ["TURNS",        "12 · round 2/3",          null],
              ["FILE DIFFS",   "3 files · +84 / −19",    "var(--ok)"],
              ["ERRORS",       "0",                      null],
              ["TOKENS",       "284k in / 41k out",      null],
              ["SPEND · RUN",  "$0.84",                  "var(--accent)"],
            ].map(([l, v, c], i) => (
              <div key={l} style={{ padding: "10px 14px", borderRight: i < 6 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{l}</div>
                <div style={{ marginTop: 2, fontSize: 13, color: c || "var(--ink)", fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Three-column workspace */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr 400px", minHeight: 0 }}>

            {/* === ROSTER === */}
            <div style={{
              borderRight: "1px solid var(--border)",
              background: "var(--paper)",
              overflow: "auto",
              display: "flex", flexDirection: "column",
            }}>
              <div className="mono" style={{
                padding: "10px 14px", fontSize: 9, letterSpacing: "0.12em",
                color: "var(--ink-3)", borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span>ROSTER · team_local_full</span>
                <span style={{flex:1}}/>
                <span style={{ color: "var(--ink-2)" }}>7</span>
              </div>

              {[
                { id: "a1", name: "ceo",       role: "CEO",     model: "codex_cli · fixed",     state: "done",    task: "Selected model bindings",   time: "—",     tokens: 1800 },
                { id: "a2", name: "manager",   role: "MANAGER", model: "codex_cli · fixed",     state: "running", task: "Dispatching sub-tasks",     time: "2:14",  tokens: 4200, selected: false },
                { id: "a3", name: "pmo",       role: "PMO",     model: "codex_cli · ceo",       state: "idle",    task: "Reviewing plan integrity",  time: "—",     tokens: 800 },
                { id: "a4", name: "worker_1",  role: "WORKER",  model: "claude_cli · sonnet",   state: "done",    task: "Wrote tests/test_payment",  time: "—",     tokens: 5400 },
                { id: "a5", name: "worker_2",  role: "WORKER",  model: "claude_cli · sonnet",   state: "running", task: "Editing services/payment.py", time: "2:14", tokens: 12400, selected: true },
                { id: "a6", name: "worker_3",  role: "WORKER",  model: "claude_cli · sonnet",   state: "queued",  task: "Queue position 1",           time: "—",     tokens: 0 },
                { id: "a7", name: "qa_1",      role: "QA",      model: "codex_cli · ceo",       state: "waiting", task: "Awaiting worker_2 output",   time: "—",     tokens: 0 },
                { id: "a8", name: "qa_2",      role: "QA",      model: "codex_cli · ceo",       state: "waiting", task: "Awaiting worker_2 output",   time: "—",     tokens: 0 },
                { id: "a9", name: "qa_3",      role: "QA",      model: "gemini_cli · ceo",      state: "error",   task: "ESCALATE · unclear AC",       time: "—",     tokens: 600 },
              ].map(a => (
                <div key={a.id} style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  background: a.selected ? "var(--surface)" : "transparent",
                  borderLeft: a.selected ? "2px solid var(--accent)" : "2px solid transparent",
                  position: "relative",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StateChip state={a.state}/>
                    <span className="mono" style={{ fontSize: 12, fontWeight: a.selected ? 600 : 500, color: "var(--ink)" }}>
                      {a.name}
                    </span>
                    <span style={{flex:1}}/>
                    <RoleBadge role={a.role}/>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 11, color: "var(--ink-2)" }}>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{a.model}</span>
                    <span style={{ color: "var(--ink-4)" }}>·</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{a.time}</span>
                  </div>
                  <div style={{ fontSize: 11, color: a.state === "error" ? "var(--danger)" : "var(--ink-2)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.task}
                  </div>
                </div>
              ))}

              <div style={{ flex: 1 }}/>
              <div style={{ padding: 10, borderTop: "1px solid var(--border)" }}>
                <Btn variant="outline" icon="plus" style={{ width: "100%", justifyContent: "center" }}>Edit team · Composer</Btn>
              </div>
            </div>

            {/* === LIVE LOG STREAM === */}
            <div style={{ display: "flex", flexDirection: "column", background: "var(--surface-sunk)", overflow: "hidden" }}>
              {/* Filter bar */}
              <div style={{
                padding: "8px 14px", borderBottom: "1px solid var(--border)",
                background: "var(--paper-2)",
                display: "flex", alignItems: "center", gap: 10, fontSize: 11,
              }}>
                <span className="mono" style={{ color: "var(--ink-3)", fontSize: 9, letterSpacing: "0.12em" }}>EVENT</span>
                {[
                  { l: "ALL",            n: 142, active: true },
                  { l: "RUN_STARTED",    n: 1 },
                  { l: "TURN_STARTED",   n: 12 },
                  { l: "TURN_OUTPUT",    n: 89 },
                  { l: "TURN_COMPLETED", n: 11 },
                  { l: "FILE_CHANGE",    n: 24 },
                  { l: "GATE",           n: 4 },
                  { l: "ERROR",          n: 1, tone: "danger" },
                ].map(f => (
                  <button key={f.l} style={{
                    height: 22, padding: "0 8px", borderRadius: 2,
                    background: f.active ? "var(--ink)" : "transparent",
                    color: f.active ? "var(--paper)" : f.tone === "danger" ? "var(--danger)" : "var(--ink-2)",
                    border: f.active ? "1px solid var(--ink)" : "1px solid var(--border)",
                    fontSize: 10, fontFamily: "var(--font-mono)",
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <span>{f.l}</span>
                    <span style={{ opacity: 0.6 }}>{f.n}</span>
                  </button>
                ))}
                <span style={{ flex: 1 }}/>
                <Dot tone="ok" size={6}/>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>STREAMING · 142/min</span>
                <button style={{ width: 22, height: 22, border: "1px solid var(--border)", borderRadius: 3, display: "grid", placeItems: "center", background: "var(--surface)" }}>
                  <Icon name="pause" size={10}/>
                </button>
              </div>

              {/* Log lines */}
              <div className="mono" style={{
                flex: 1, overflow: "auto",
                padding: "10px 0",
                fontSize: 11, lineHeight: 1.55,
                background: "var(--surface-sunk)",
              }}>
                {LOG_LINES.map((line, i) => <LogLine key={i} {...line}/>)}

                {/* Live cursor */}
                <div style={{ padding: "4px 14px 4px 14px", display: "flex", alignItems: "center", gap: 6, color: "var(--ink-3)" }}>
                  <span style={{ width: 8, height: 14, background: "var(--accent)", animation: "blink 1s steps(1) infinite" }}/>
                  <span>worker_2 is editing services/payment.py…</span>
                </div>
              </div>

              {/* Inspector input */}
              <div style={{
                borderTop: "1px solid var(--border)",
                background: "var(--paper-2)",
                padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>$</span>
                <input
                  className="mono"
                  defaultValue="feedback worker_2 --kind=more_detail 'include stripe_id in error log'"
                  style={{
                    flex: 1, border: 0, background: "transparent",
                    fontSize: 12, color: "var(--ink)", outline: "none",
                    fontFamily: "var(--font-mono)",
                  }}/>
                <Kbd>⌘</Kbd><Kbd>↵</Kbd>
              </div>
            </div>

            {/* === CURRENT AGENT DETAIL === */}
            <div style={{
              borderLeft: "1px solid var(--border)",
              background: "var(--paper)",
              overflow: "auto",
              display: "flex", flexDirection: "column",
            }}>
              {/* Header */}
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar ai size={26}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>worker_2</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>claude_cli · claude-sonnet-4-6 · ceo_decides</div>
                  </div>
                  <RoleBadge role="WORKER"/>
                  <Pill tone="ok"><Dot tone="ok" size={5}/> RUNNING</Pill>
                </div>

                <div style={{ marginTop: 12, padding: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3 }}>
                  <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 4 }}>PERSONA · from team_local_full</div>
                  <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>
                    Implement payment.py changes per acceptance criteria. Output diff and brief change summary. Hand off to qa_1–3.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <Btn variant="outline" icon="pause" size="sm">Pause</Btn>
                  <Btn variant="outline" icon="x" size="sm">Stop</Btn>
                  <Btn variant="outline" icon="branch" size="sm">Branch worktree</Btn>
                  <span style={{flex:1}}/>
                  <Btn variant="solid" tone="accent" size="sm" icon="arrow">Send feedback</Btn>
                </div>
              </div>

              {/* Tabs */}
              <div className="mono" style={{
                display: "flex", borderBottom: "1px solid var(--border)",
                fontSize: 10, letterSpacing: "0.08em", color: "var(--ink-2)",
                background: "var(--paper-2)",
              }}>
                {["TURNS","FILE DIFFS (3)","PROMPT","REFERENCES","COST"].map((t, i) => (
                  <button key={t} style={{
                    padding: "10px 12px",
                    color: i === 0 ? "var(--ink)" : "var(--ink-3)",
                    borderBottom: i === 0 ? "2px solid var(--accent)" : "2px solid transparent",
                    marginBottom: -1,
                  }}>{t}</button>
                ))}
              </div>

              {/* Timeline / steps */}
              <div style={{ padding: "10px 0", flex: 1 }}>
                {[
                  { t: "+02:14", kind: "edit",   title: "services/payment.py", sub: "+18 / −7" , state: "now" },
                  { t: "+02:08", kind: "think",  title: "Reasoning about webhook signature path", sub: "Decision: verify before persisting receipt" },
                  { t: "+01:56", kind: "tool",   title: "read_file('services/payment.py')",  sub: "240 lines" },
                  { t: "+01:42", kind: "tool",   title: "read_file('tests/test_payment.py')",  sub: "118 lines" },
                  { t: "+01:24", kind: "edit",   title: "tests/test_payment.py", sub: "+42 / −12" },
                  { t: "+01:02", kind: "test",   title: "pytest -k payment",   sub: "6 / 8 passing", tone: "warn" },
                  { t: "+00:48", kind: "tool",   title: "list_directory('services')", sub: "12 entries" },
                  { t: "+00:32", kind: "think",  title: "Read acceptance_criteria from run.md", sub: "" },
                  { t: "+00:14", kind: "tool",   title: "read_file('run.md')", sub: "front-matter only" },
                  { t: "+00:00", kind: "start",  title: "turn_started", sub: "dispatched by manager" },
                ].map((s, i, a) => <TimelineStep key={i} step={s} last={i === a.length-1}/>)}
              </div>
            </div>
          </div>
        </main>
      </div>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

// State chip for agents
function StateChip({ state }) {
  const map = {
    running: { c: "var(--ok)",      l: "RUN" },
    waiting: { c: "var(--warn)",    l: "WAIT" },
    paused:  { c: "var(--ink-3)",   l: "PAUSE" },
    done:    { c: "var(--info)",    l: "DONE" },
    error:   { c: "var(--danger)",  l: "ERR" },
    queued:  { c: "var(--ink-4)",   l: "Q" },
    idle:    { c: "var(--ink-4)",   l: "IDLE" },
  };
  const s = map[state];
  return (
    <span className="mono" style={{
      width: 38, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: state === "running" ? s.c : "transparent",
      color: state === "running" ? "white" : s.c,
      border: state === "running" ? `1px solid ${s.c}` : `1px solid ${s.c}`,
      borderRadius: 2, fontSize: 9, fontWeight: 600, letterSpacing: "0.04em",
    }}>{s.l}</span>
  );
}

// One log line — gutter shows kind, monospace
function LogLine({ t, kind, agent, msg, indent = 0, tone }) {
  const kindColor = {
    RUN_STARTED:     "var(--info)",
    TURN_STARTED:    "var(--ink-3)",
    TURN_OUTPUT:     "var(--agent)",
    TURN_COMPLETED:  "var(--ok)",
    FILE_CHANGE:     "var(--accent)",
    GATE:            "var(--warn)",
    GATE_PASS:       "var(--ok)",
    ERROR:           "var(--danger)",
    CEO:             "var(--ink)",
    TOOL:            "var(--info)",
  }[kind] || "var(--ink-3)";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "70px 56px 130px 1fr",
      gap: 10,
      padding: `2px 14px 2px ${14 + indent*16}px`,
      alignItems: "baseline",
      borderLeft: indent > 0 ? "1px dotted var(--border-2)" : "none",
      marginLeft: indent > 0 ? indent*16 - 16 : 0,
      color: tone === "danger" ? "var(--danger)" : "var(--ink-2)",
    }}>
      <span style={{ color: "var(--ink-4)" }}>{t}</span>
      <span style={{
        color: kindColor,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}>{kind}</span>
      <span style={{ color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent}</span>
      <span style={{ color: tone === "danger" ? "var(--danger)" : "var(--ink)" }}>{msg}</span>
    </div>
  );
}

const LOG_LINES = [
  { t: "09:20:00", kind: "RUN_STARTED",    agent: "orchestrator", msg: <>req_20260520_1284 · dependency_graph · round 2/3 · worktree <span style={{color:"var(--accent-deep)"}}>ai/req_1284</span></> },
  { t: "09:20:01", kind: "CEO",            agent: "ceo",          msg: <>model decision · worker→<span style={{color:"var(--accent-deep)"}}>claude-sonnet-4-6</span>, qa→<span style={{color:"var(--accent-deep)"}}>codex</span>, qa_3→<span style={{color:"var(--accent-deep)"}}>gemini-pro</span></> },
  { t: "09:20:04", kind: "TURN_STARTED",   agent: "manager",      msg: <>round 2 · dispatching to worker_1, worker_2, worker_3</> },
  { t: "09:20:12", kind: "TURN_OUTPUT",    agent: "manager",      msg: <>‘break payment-flow into: <span className="mono">webhook handler, idempotency, error log’</span></>, indent: 1 },
  { t: "09:20:20", kind: "TURN_COMPLETED", agent: "manager",      msg: <>dispatched 3 sub-tasks · 1.4k tokens</> },
  { t: "09:21:02", kind: "TURN_STARTED",   agent: "worker_2",     msg: <>sub-task: webhook handler · acceptance_criteria.payment-success</> },
  { t: "09:21:18", kind: "TOOL",           agent: "worker_2",     msg: <>read_file(<span style={{color:"var(--accent-deep)"}}>"services/payment.py"</span>) → 240 lines</>, indent: 1 },
  { t: "09:21:32", kind: "TOOL",           agent: "worker_2",     msg: <>read_file(<span style={{color:"var(--accent-deep)"}}>"tests/test_payment.py"</span>) → 118 lines</>, indent: 1 },
  { t: "09:21:50", kind: "FILE_CHANGE",    agent: "worker_2",     msg: <>services/payment.py <span style={{color:"var(--git-add)"}}>+18</span> <span style={{color:"var(--git-del)"}}>−7</span> in ai/req_1284</> },
  { t: "09:22:14", kind: "FILE_CHANGE",    agent: "worker_2",     msg: <>tests/test_payment.py <span style={{color:"var(--git-add)"}}>+42</span> <span style={{color:"var(--git-del)"}}>−12</span></> },
  { t: "09:22:38", kind: "TOOL",           agent: "worker_2",     msg: <>run_shell(<span style={{color:"var(--accent-deep)"}}>"pytest -k payment"</span>)</>, indent: 1 },
  { t: "09:22:54", kind: "TURN_OUTPUT",    agent: "worker_2",     msg: <>6 / 8 passing · 2 failures: <span style={{color:"var(--accent-deep)"}}>test_webhook_signature</span></>, tone: "warn" },
  { t: "09:23:02", kind: "TURN_OUTPUT",    agent: "worker_2",     msg: <>‘Need to verify signature before persisting receipt — patching path order’</>, indent: 1 },
  { t: "09:23:18", kind: "FILE_CHANGE",    agent: "worker_2",     msg: <>services/payment.py <span style={{color:"var(--git-add)"}}>+8</span> <span style={{color:"var(--git-del)"}}>−2</span></> },
  { t: "09:23:34", kind: "TURN_COMPLETED", agent: "worker_2",     msg: <>8 / 8 passing ✓ · hand off to qa_1, qa_2, qa_3</> },
  { t: "09:24:00", kind: "TURN_STARTED",   agent: "qa_1",         msg: <>review worker_2 diff · read acceptance_criteria</> },
  { t: "09:24:18", kind: "GATE",           agent: "qa_2",         msg: <><span style={{color:"var(--warn)"}}>REWORK</span> · ‘test_payment covers happy-path only; add 4xx branches’</>, tone: "warn" },
  { t: "09:24:46", kind: "GATE_PASS",      agent: "qa_1",         msg: <><span style={{color:"var(--ok)"}}>PASS</span> · ‘matches acceptance_criteria.payment-success’</>, tone: "ok" },
  { t: "09:25:02", kind: "ERROR",          agent: "qa_3",         msg: <><span style={{color:"var(--danger)"}}>ESCALATE</span> · unclear AC: ‘what counts as “webhook received”?’ → issue#42</>, tone: "danger" },
];

// One step in the right-panel timeline
function TimelineStep({ step, last }) {
  const colors = {
    edit:   "var(--accent)",
    think:  "var(--agent)",
    tool:   "var(--info)",
    test:   "var(--ok)",
    start:  "var(--ink)",
    error:  "var(--danger)",
  };
  const icons = {
    edit:  "doc",
    think: "agent",
    tool:  "terminal",
    test:  "check",
    start: "play",
    error: "x",
  };
  const c = colors[step.kind];
  const isNow = step.state === "now";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "60px 24px 1fr", gap: 0, padding: "4px 14px 4px 14px" }}>
      <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", paddingTop: 4 }}>{step.t}</span>
      {/* rail + dot */}
      <div style={{ position: "relative", height: "100%" }}>
        {!last && <span style={{ position: "absolute", left: 11, top: 16, bottom: -4, width: 1, background: "var(--border-2)" }}/>}
        <span style={{
          position: "absolute", left: 4, top: 4,
          width: 16, height: 16, borderRadius: 2,
          background: isNow ? c : "var(--surface)",
          border: `1px solid ${c}`, color: isNow ? "white" : c,
          display: "grid", placeItems: "center",
        }}>
          <Icon name={icons[step.kind]} size={10}/>
        </span>
        {isNow && <span style={{ position: "absolute", left: 0, top: 0, width: 24, height: 24, borderRadius: 4, background: c, opacity: 0.18, animation: "pulse 1.6s ease-out infinite" }}/>}
      </div>
      <div style={{
        padding: "2px 0 8px",
        background: isNow ? "color-mix(in oklab, var(--accent-soft) 50%, transparent)" : "transparent",
        marginLeft: -4, paddingLeft: 4,
      }}>
        <div className="mono" style={{ fontSize: 12, color: "var(--ink)", fontWeight: isNow ? 600 : 400 }}>
          {step.title}
        </div>
        {step.sub && (
          <div style={{ fontSize: 11, color: step.tone === "warn" ? "var(--warn)" : "var(--ink-3)", marginTop: 2 }}>
            {step.sub}
          </div>
        )}
      </div>
    </div>
  );
}

window.Observatory = Observatory;

// ---------- Role badge ----------
function RoleBadge({ role }) {
  const map = {
    CEO:     { bg: "#14110D",   fg: "#F4EFE3" },
    MANAGER: { bg: "#2B5BBA",   fg: "white" },
    PMO:     { bg: "#5B3FD9",   fg: "white" },
    WORKER:  { bg: "#FF5B1F",   fg: "white" },
    QA:      { bg: "#1E7A4A",   fg: "white" },
    UI:      { bg: "#A14BC4",   fg: "white" },
    SYSTEM:  { bg: "#A56A0E",   fg: "white" },
    OPS:     { bg: "#8A857A",   fg: "white" },
  };
  const c = map[role] || map.WORKER;
  return (
    <span className="mono" style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "1px 5px",
      fontSize: 9, fontWeight: 600,
      letterSpacing: "0.08em",
      color: c.fg, background: c.bg,
      borderRadius: 2,
      lineHeight: 1.5,
    }}>{role}</span>
  );
}
window.RoleBadge = RoleBadge;
