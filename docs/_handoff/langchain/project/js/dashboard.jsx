// STRAND — Dashboard / Home

function Dashboard({ density, sidebarMode }) {
  return (
    <div className="strand" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar breadcrumb={["workspace", "dashboard"]} density={density} theme="light"/>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideBar active="dashboard" mode={sidebarMode}/>
        <main style={{ flex: 1, overflow: "auto", padding: 24, background: "var(--paper)" }}>
          {/* Greeting row */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                WED · MAY 20 · 09:42 JST
              </div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 16 }}>
                <h1 className="serif" style={{ fontSize: 38, fontStyle: "italic", letterSpacing: "-0.02em" }}>
                  Good morning, Yuki.
                </h1>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  ↳ 3 runs active · 2 awaiting CEO · 1 escalation
                </span>
              </div>
            </div>
            <Btn variant="solid" tone="accent" icon="play" size="lg">Resume run</Btn>
            <Btn variant="outline" icon="terminal" size="lg">orchestrate</Btn>
          </div>

          {/* Stat strip */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
            gap: 0, marginBottom: 24,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            borderRadius: 4,
          }}>
            {[
              { label: "ACTIVE RUNS",   value: "3",      delta: "−1 vs yesterday" },
              { label: "PASS RATE",     value: "86.4%",  delta: "+2.1" },
              { label: "REWORK",        value: "4",      delta: "−2" },
              { label: "ESCALATED",     value: "1",      delta: null },
              { label: "TURNS · 24H",   value: "284",    delta: "+18%" },
              { label: "SPEND · WEEK",  value: "$48.20", delta: null },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "14px 16px",
                borderRight: i < 5 ? "1px solid var(--border)" : "none",
              }}>
                <Stat label={s.label} value={s.value} delta={s.delta}/>
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>

            {/* LEFT col */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Active runs */}
              <Panel title="Active runs" accent="var(--agent)"
                     action={<span className="mono" style={{fontSize:10,color:"var(--ink-3)"}}>3 running · dependency_graph</span>}
                     padded={false}>
                {[
                  { id: "req_20260520_1284", title: "feature: payment-flow webhook",      mode: "coding",  agent: "worker_2 / claude_cli", state: "running", action: "turn_started · editing services/payment.py",   turn: "3 / 6", time: "02:14" },
                  { id: "req_20260520_1283", title: "refine: observatory scroll overflow", mode: "coding",  agent: "qa_1 / codex_cli",      state: "waiting", action: "awaiting QA gate · 2/3 PASS, 1 pending",         turn: "5 / 6", time: "12:03" },
                  { id: "req_20260520_1280", title: "writing: skill-picker UX brief",      mode: "writing", agent: "manager / codex_cli",   state: "paused",  action: "paused by CEO · ‘confirm scope before continuing’", turn: "2 / 4", time: "1:12:00" },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto auto",
                    alignItems: "center",
                    gap: 14, padding: "12px 14px",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{ width: 4, alignSelf: "stretch",
                                  background: s.state === "running" ? "var(--ok)" : s.state === "waiting" ? "var(--warn)" : "var(--ink-3)" }}/>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.id}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{s.title}</span>
                        <Pill tone={s.mode === "coding" ? "accent" : "neutral"}>{s.mode.toUpperCase()}</Pill>
                        {s.state === "running" && <Pill tone="ok"><Dot tone="ok" size={5}/> RUNNING</Pill>}
                        {s.state === "waiting" && <Pill tone="warn">WAITING QA</Pill>}
                        {s.state === "paused"  && <Pill tone="neutral">PAUSED</Pill>}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-2)", display: "flex", gap: 10, alignItems: "center" }}>
                        <span className="mono" style={{ color: "var(--agent-deep)" }}>{s.agent}</span>
                        <span style={{ color: "var(--ink-4)" }}>·</span>
                        <span><span className="mono" style={{ color: "var(--ink-3)" }}>↳ </span>{s.action}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{s.turn}</div>
                      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em" }}>TURNS</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{s.time}</div>
                      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em" }}>UP</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={iconBtnStyle}><Icon name={s.state === "running" ? "pause" : "play"} size={11}/></button>
                      <button style={iconBtnStyle}><Icon name="eye" size={11}/></button>
                      <button style={iconBtnStyle}><Icon name="more" size={11}/></button>
                    </div>
                  </div>
                ))}
              </Panel>

              {/* Activity timeline (live log style) */}
              <Panel title="Live activity" accent="var(--accent)"
                     action={
                       <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                         <Pill tone="neutral">ALL</Pill>
                         <Pill tone="agent">TURN</Pill>
                         <Pill tone="info">RUN</Pill>
                         <Pill tone="warn">GATE</Pill>
                         <Pill tone="neutral">CEO</Pill>
                         <span style={{width:1,height:14,background:"var(--border)"}}/>
                         <Dot tone="ok" size={6}/>
                         <span className="mono" style={{fontSize:10,color:"var(--ink-3)"}}>STREAMING</span>
                       </div>
                     }
                     padded={false}>
                {[
                  { t: "09:42:14", kind: "TURN",  who: "worker_2",     repo: "req_…_1284",   msg: <>turn_completed · <a style={prLink}>edited services/payment.py (+18 / −7)</a></>, tone: "agent" },
                  { t: "09:41:02", kind: "GATE",  who: "qa_1",         repo: "req_…_1283",   msg: <>QA <span style={{color:"var(--ok)"}}>PASS</span> · “tests pass; receipt log includes stripe_id”</>, tone: "ok" },
                  { t: "09:38:55", kind: "CEO",   who: "yuki",         repo: "req_…_1280",   msg: <>paused run · “confirm scope before continuing”</>, tone: "neutral" },
                  { t: "09:34:31", kind: "TURN",  who: "manager",      repo: "req_…_1284",   msg: <>turn_completed · dispatched 3 sub-tasks to <span className="mono">worker_1–3</span></>, tone: "agent" },
                  { t: "09:31:09", kind: "DIFF",  who: "worker_2",     repo: "req_…_1284",   msg: <>worktree <span className="mono">ai/req_1284</span> · <span style={{color:"var(--git-add)"}}>+42</span> <span style={{color:"var(--git-del)"}}>−12</span> across 2 files</>, tone: "agent" },
                  { t: "09:27:42", kind: "PLAN",  who: "ceo",          repo: "req_…_1284",   msg: <>model decision · worker→<span className="mono">claude-sonnet-4-6</span>, qa→<span className="mono">codex</span></>, tone: "agent" },
                  { t: "09:24:18", kind: "GATE",  who: "qa_2",         repo: "req_…_1283",   msg: <>QA <span style={{color:"var(--warn)"}}>REWORK</span> · “test_payment covers happy-path only”</>, tone: "warn" },
                  { t: "09:20:00", kind: "RUN",   who: "orchestrator", repo: "req_…_1284",   msg: <>run_started · dependency_graph · 7 agents enabled</>, tone: "info" },
                ].map((e, i) => (
                  <div key={i} className="mono" style={{
                    display: "grid",
                    gridTemplateColumns: "70px 56px 110px 110px 1fr",
                    alignItems: "center", gap: 10,
                    padding: "6px 14px",
                    fontSize: 11,
                    borderTop: i > 0 ? "1px dotted var(--border)" : "none",
                    color: "var(--ink-2)",
                  }}>
                    <span style={{ color: "var(--ink-3)" }}>{e.t}</span>
                    <Pill tone={e.kind === "TURN" ? "agent" : e.kind === "GATE" ? (e.tone === "warn" ? "warn" : "ok") : e.kind === "CEO" ? "neutral" : e.kind === "RUN" ? "info" : "agent"} style={{justifyContent:"center"}}>{e.kind}</Pill>
                    <span style={{ color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.who}</span>
                    <span style={{ color: "var(--ink-3)" }}>{e.repo}</span>
                    <span style={{ fontFamily: "var(--font-sans)", color: "var(--ink)" }}>{e.msg}</span>
                  </div>
                ))}
              </Panel>
            </div>

            {/* RIGHT col */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Needs you */}
              <Panel title="Decision queue · CEO" accent="var(--accent)" padded={false}>
                {[
                  { kind: "ESCALATE", title: "Unclear acceptance criterion in payment-flow",  repo: "req_…_1284", who: "qa_3",            ai: true, urgent: true,  tone: "danger" },
                  { kind: "APPROVE",  title: "Confirm model selection for QA roles",          repo: "req_…_1283", who: "manager + ceo",    ai: false, urgent: false, tone: "accent" },
                  { kind: "REWORK",   title: "Tests cover happy-path only",                   repo: "req_…_1283", who: "qa_2",            ai: true,  urgent: false, tone: "warn" },
                ].map((n, i) => (
                  <div key={i} style={{
                    padding: "12px 14px",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    display: "flex", flexDirection: "column", gap: 6,
                    background: n.urgent ? "color-mix(in oklab, var(--danger-bg) 35%, transparent)" : "transparent",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Pill tone={n.tone}>{n.kind}</Pill>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{n.repo}</span>
                      <span style={{ flex: 1 }}/>
                      {n.ai && <Pill tone="agent">AI</Pill>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink)" }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>by {n.who}</div>
                  </div>
                ))}
              </Panel>

              {/* Cost meter */}
              <Panel title="Agent budget · this week" accent="var(--agent)">
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span className="mono" style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em" }}>$48.20</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>/ $120 · 40%</span>
                </div>
                <div style={{ height: 8, background: "var(--surface-sunk)", marginTop: 10, borderRadius: 2, overflow: "hidden", display: "flex" }}>
                  <div style={{ width: "32%", background: "var(--agent)" }}/>
                  <div style={{ width: "8%", background: "var(--accent)" }}/>
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
                  <span><Dot tone="agent" size={5}/> claude_cli $38.40</span>
                  <span><Dot tone="accent" size={5}/> codex_cli $9.80</span>
                </div>
                {/* Sparkline */}
                <svg viewBox="0 0 200 36" style={{ width: "100%", height: 36, marginTop: 14 }}>
                  {[6,9,7,12,8,14,18].map((v, i, a) => {
                    const x = i * 30, h = v * 2;
                    return <rect key={i} x={x} y={36-h} width={22} height={h} fill={i === a.length-1 ? "var(--accent)" : "var(--ink)"} opacity={i === a.length-1 ? 1 : 0.85}/>;
                  })}
                </svg>
                <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--ink-3)", marginTop: 4 }}>
                  {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d => <span key={d}>{d}</span>)}
                </div>
              </Panel>

              {/* Pinned */}
              <Panel title="Recent templates" padded={false}>
                {[
                  { name: "team_local_full",   desc: "CEO + Manager + Worker x3 + QA x3 + PMO", mode: "role_based",        rounds: 1, agents: 8 },
                  { name: "team_writing_pmo", desc: "CEO + Manager + Worker x2 + QA x3",        mode: "sequential",        rounds: 2, agents: 6 },
                  { name: "team_solo_coding", desc: "CEO + Worker + QA · fast loop",             mode: "dependency_graph",  rounds: 1, agents: 3 },
                ].map((r, i) => (
                  <div key={i} style={{
                    padding: "12px 14px",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    display: "flex", flexDirection: "column", gap: 4,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="user" size={12} color="var(--ink-2)"/>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</span>
                      <span style={{ flex: 1 }}/>
                      <Pill tone="agent">{r.agents} agents</Pill>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-2)" }}>{r.desc}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", display: "flex", gap: 12, marginTop: 2 }}>
                      <span><Dot tone="accent" size={5}/> {r.mode}</span>
                      <span>rounds: {r.rounds}</span>
                    </div>
                  </div>
                ))}
              </Panel>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  width: 24, height: 24, display: "grid", placeItems: "center",
  border: "1px solid var(--border)", background: "var(--surface)",
  borderRadius: 3, color: "var(--ink-2)",
};
const prLink = { color: "var(--accent-deep)", borderBottom: "1px solid var(--accent)", cursor: "pointer" };

window.Dashboard = Dashboard;
