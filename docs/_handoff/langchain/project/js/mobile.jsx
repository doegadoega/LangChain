// STRAND — Mobile screens

function MobileDashboard({ density }) {
  return (
    <PhoneShell title="AGENT—REFINEMENT" subtitle="Dashboard">
      {/* Greeting */}
      <div style={{ padding: "14px 16px 10px" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em" }}>WED · MAY 20</div>
        <div className="serif" style={{ fontSize: 22, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 2 }}>
          Morning, Yuki.
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
          3 runs active · 2 awaiting CEO · 1 escalation
        </div>
      </div>

      {/* Stat row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        margin: "0 12px", border: "1px solid var(--border)",
        borderRadius: 3, background: "var(--surface)",
      }}>
        {[
          ["ACTIVE",  "3 runs", "var(--ok)"],
          ["PASS",    "86.4%",  null],
          ["REWORK",  "4",      "var(--warn)"],
        ].map(([l, v, c], i) => (
          <div key={l} style={{ padding: "10px 12px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div className="mono" style={{ fontSize: 8, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{l}</div>
            <div className="mono" style={{ fontSize: 16, color: c || "var(--ink)", fontWeight: 500, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Resume session */}
      <div style={{ padding: "14px 12px 4px" }}>
        <Hairline label="Active runs" n={1}/>
      </div>

      {/* Session cards */}
      <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { id: "req_…_1284", title: "payment-flow webhook",      mode: "coding",  state: "running", msg: "worker_2 editing payment.py", time: "2m" },
          { id: "req_…_1283", title: "observatory scroll overflow", mode: "coding",  state: "waiting", msg: "QA gate · 2/3 PASS, 1 pending", time: "12m" },
          { id: "req_…_1280", title: "skill-picker UX brief",      mode: "writing", state: "paused",  msg: "paused by CEO · confirm scope",  time: "1h" },
        ].map((s, i) => (
          <div key={i} style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderLeft: `3px solid ${s.state === "running" ? "var(--ok)" : s.state === "waiting" ? "var(--warn)" : "var(--ink-3)"}`,
            borderRadius: 3, padding: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.id}</span>
              <span style={{flex:1}}/>
              <Pill tone={s.mode === "coding" ? "accent" : "neutral"}>{s.mode}</Pill>
              <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>{s.time}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4, fontWeight: 500 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
              <span className="mono" style={{color:"var(--ink-3)"}}>↳ </span>{s.msg}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {s.state === "running"
                ? <Btn variant="outline" size="sm" icon="pause">Pause</Btn>
                : <Btn variant="solid" tone="accent" size="sm" icon="play">Resume</Btn>}
              <Btn variant="outline" size="sm" icon="eye">Watch</Btn>
            </div>
          </div>
        ))}
      </div>

      {/* Decision queue */}
      <div style={{ padding: "14px 12px 4px" }}>
        <Hairline label="Decision queue" n={2}/>
      </div>
      <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { kind: "ESCALATE", title: "Unclear AC in payment-flow",      by: "qa_3 · AI",       urgent: true,  ai: true,  tone: "danger" },
          { kind: "REWORK",   title: "Tests cover happy-path only",     by: "qa_2 · AI",       urgent: false, ai: true,  tone: "warn" },
        ].map((n, i) => (
          <div key={i} style={{
            background: n.urgent ? "color-mix(in oklab, var(--danger-bg) 35%, var(--surface))" : "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 3, padding: 10,
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              <Pill tone={n.tone}>{n.kind}</Pill>
              {n.ai && <Pill tone="agent">AI</Pill>}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 6 }}>{n.title}</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>by {n.by}</div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <PhoneTabBar active="home"/>
    </PhoneShell>
  );
}

function MobileObservatory({ density }) {
  return (
    <PhoneShell title="AGENT—REFINEMENT" subtitle="Execution · req_…_1284">
      {/* Live header */}
      <div style={{
        padding: "12px 16px",
        background: "var(--ink)", color: "var(--paper)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--ok)", boxShadow: "0 0 8px var(--ok)" }}/>
          <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em" }}>LIVE · 142/min</span>
          <span style={{flex:1}}/>
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>3/8 running</span>
        </div>
        <div className="serif" style={{ fontSize: 22, fontStyle: "italic", marginTop: 4 }}>
          payment-flow webhook
        </div>
      </div>

      {/* Agent strip */}
      <div style={{
        display: "flex", overflowX: "auto", gap: 8, padding: "12px",
        borderBottom: "1px solid var(--border)",
        scrollbarWidth: "none",
      }}>
        {[
          { name: "manager",   role: "MANAGER", state: "running", task: "Dispatching tasks" },
          { name: "worker_2",  role: "WORKER",  state: "running", task: "Editing payment.py" },
          { name: "qa_1",      role: "QA",      state: "waiting", task: "Awaiting output" },
          { name: "qa_3",      role: "QA",      state: "error",   task: "ESCALATE · AC" },
        ].map(a => (
          <div key={a.name} style={{
            flex: "0 0 160px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderTop: `3px solid ${a.state === "running" ? "var(--ok)" : a.state === "error" ? "var(--danger)" : a.state === "waiting" ? "var(--warn)" : "var(--ink-3)"}`,
            borderRadius: 3, padding: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="mono" style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {a.name}
              </span>
              <RoleBadge role={a.role}/>
            </div>
            <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 2, letterSpacing: "0.06em" }}>
              {a.state.toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.task}
            </div>
          </div>
        ))}
      </div>

      {/* Log filter */}
      <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: "1px solid var(--border)", overflow: "hidden" }}>
        {[
          { l: "ALL", n: 142, on: true },
          { l: "TURN", n: 12 },
          { l: "DIFF", n: 24 },
          { l: "GATE", n: 4 },
        ].map(f => (
          <span key={f.l} className="mono" style={{
            fontSize: 10, padding: "3px 8px", borderRadius: 2,
            background: f.on ? "var(--ink)" : "transparent",
            color: f.on ? "var(--paper)" : "var(--ink-2)",
            border: f.on ? "1px solid var(--ink)" : "1px solid var(--border)",
            display: "inline-flex", gap: 4,
          }}>{f.l}<span style={{ opacity: 0.6 }}>{f.n}</span></span>
        ))}
      </div>

      {/* Log stream */}
      <div className="mono" style={{
        flex: 1, overflow: "auto",
        padding: "8px 0",
        background: "var(--surface-sunk)",
        fontSize: 10.5, lineHeight: 1.5,
      }}>
        {[
          { t: "09:23:34", k: "DONE",   c: "var(--ok)",     m: "worker_2 turn_completed · 8/8 ✓" },
          { t: "09:23:18", k: "DIFF",   c: "var(--accent)", m: "payment.py +8 −2" },
          { t: "09:22:54", k: "OUT",    c: "var(--agent)",  m: "verifying signature before persisting" },
          { t: "09:22:38", k: "TOOL",   c: "var(--info)",   m: "pytest -k payment" },
          { t: "09:22:14", k: "DIFF",   c: "var(--accent)", m: "test_payment.py +42 −12" },
          { t: "09:21:50", k: "DIFF",   c: "var(--accent)", m: "payment.py +18 −7" },
          { t: "09:21:32", k: "TOOL",   c: "var(--info)",   m: "read tests/test_payment.py" },
          { t: "09:21:18", k: "TOOL",   c: "var(--info)",   m: "read services/payment.py" },
          { t: "09:21:02", k: "START",  c: "var(--ink-3)",  m: "worker_2 turn_started" },
          { t: "09:20:20", k: "DONE",   c: "var(--ok)",     m: "manager dispatched 3 sub-tasks" },
          { t: "09:20:04", k: "START",  c: "var(--ink-3)",  m: "manager turn_started · round 2" },
          { t: "09:20:01", k: "CEO",    c: "var(--ink)",    m: "model decision → sonnet/codex" },
          { t: "09:20:00", k: "RUN",    c: "var(--info)",   m: "run_started · dependency_graph" },
        ].map((l, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "62px 48px 1fr",
            gap: 8, padding: "3px 12px",
            color: "var(--ink-2)",
          }}>
            <span style={{ color: "var(--ink-4)" }}>{l.t}</span>
            <span style={{ color: l.c, fontWeight: 600 }}>{l.k}</span>
            <span style={{ color: "var(--ink)" }}>{l.m}</span>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 12px",
        background: "var(--paper-2)",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span className="mono" style={{ color: "var(--accent)" }}>$</span>
        <input
          placeholder="feedback worker_2 …"
          className="mono"
          style={{
            flex: 1, height: 28, padding: "0 8px",
            border: "1px solid var(--border)", borderRadius: 3,
            background: "var(--surface)", fontSize: 11,
            fontFamily: "var(--font-mono)", color: "var(--ink)",
            outline: "none",
          }}/>
        <button style={{ width: 28, height: 28, display: "grid", placeItems: "center", background: "var(--ink)", color: "var(--paper)", borderRadius: 3 }}>
          <Icon name="arrow" size={12}/>
        </button>
      </div>

      <PhoneTabBar active="obs"/>
    </PhoneShell>
  );
}

// ---------- Phone shell ----------
function PhoneShell({ title, subtitle, children }) {
  return (
    <div className="strand" style={{
      display: "flex", flexDirection: "column",
      background: "var(--paper)",
      overflow: "hidden",
    }}>
      {/* Status bar */}
      <div className="mono" style={{
        display: "flex", alignItems: "center", padding: "8px 16px",
        fontSize: 11, fontWeight: 600,
        background: "var(--paper)",
      }}>
        <span>9:42</span>
        <span style={{ flex: 1 }}/>
        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <span style={{ width: 14, height: 8, border: "1px solid var(--ink)", borderRadius: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 1, top: 1, bottom: 1, width: "70%", background: "var(--ink)" }}/>
          </span>
        </span>
      </div>

      {/* App bar */}
      <div style={{
        padding: "6px 16px 10px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <StrandMark size={20}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>{title}</div>
          <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{subtitle}</div>
        </div>
        <Icon name="search" size={16} color="var(--ink-2)"/>
        <Icon name="bell" size={16} color="var(--ink-2)"/>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

function PhoneTabBar({ active }) {
  const tabs = [
    { id: "home",  l: "Home",     icon: "board" },
    { id: "obs",   l: "Live",     icon: "eye" },
    { id: "qa",    l: "QA",       icon: "check", badge: "3" },
    { id: "team",  l: "Team",     icon: "user" },
    { id: "me",    l: "Me",       icon: "gear" },
  ];
  return (
    <nav style={{
      borderTop: "1px solid var(--border)",
      background: "var(--paper-2)",
      display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
      padding: "8px 4px 14px",
    }}>
      {tabs.map(t => (
        <button key={t.id} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          color: t.id === active ? "var(--ink)" : "var(--ink-3)",
          fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
          fontWeight: t.id === active ? 600 : 400,
          position: "relative",
        }}>
          <Icon name={t.icon} size={18}/>
          <span>{t.l.toUpperCase()}</span>
          {t.badge && (
            <span className="mono" style={{
              position: "absolute", top: -2, right: "calc(50% - 18px)",
              background: "var(--accent)", color: "white",
              fontSize: 8, fontWeight: 600,
              padding: "1px 4px", borderRadius: 6, lineHeight: 1,
            }}>{t.badge}</span>
          )}
          {t.id === active && <span style={{ position: "absolute", bottom: -8, width: 16, height: 2, background: "var(--accent)" }}/>}
        </button>
      ))}
    </nav>
  );
}

Object.assign(window, { MobileDashboard, MobileObservatory });
