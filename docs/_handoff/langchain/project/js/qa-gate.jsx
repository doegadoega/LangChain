// AGENT-REFINEMENT — QA Gate
// 3-person QA judgment lanes. PASS/REWORK/ESCALATE.

function QAGate({ density, sidebarMode }) {
  return (
    <div className="strand" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar breadcrumb={["workspace", "qa-gate", "req_20260520_1283 · v2"]} density={density} theme="light"/>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideBar active="qa" mode={sidebarMode}/>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>

          {/* Header */}
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Pill tone="info"><Dot tone="info" size={5}/> AWAITING DECISION</Pill>
              <Pill tone="agent">3 QA · 2 PASS · 1 PENDING</Pill>
              <Pill tone="neutral">round 2/3</Pill>
              <span style={{flex:1}}/>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>req_20260520_1283 · workspace v2 · 14 min</span>
            </div>
            <h1 className="serif" style={{
              fontSize: 28, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 10,
              display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
            }}>
              refine: observatory scroll overflow
              <span className="mono" style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "normal" }}>
                <Icon name="branch" size={11}/>&nbsp;worktree ai/req_1283 · 3 files · <span style={{ color: "var(--git-add)" }}>+62</span> <span style={{ color: "var(--git-del)" }}>−18</span>
              </span>
            </h1>

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 18, fontSize: 12, color: "var(--ink-2)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Avatar ai size={20}/>
                <span className="mono"><span style={{ color: "var(--agent-deep)", fontWeight: 600 }}>worker_2</span> · claude_cli / claude-sonnet-4-6</span>
              </span>
              <span style={{ color: "var(--ink-4)" }}>·</span>
              <span className="mono">2 / 3 PASS required to proceed · all PASS to merge worktree</span>
              <span style={{ flex: 1 }}/>
              <Btn variant="outline" icon="branch" size="sm">View diff</Btn>
              <Btn variant="outline" icon="eye" size="sm">Replay turns</Btn>
              <Btn variant="solid" tone="accent" icon="check" size="md">Commit verdict</Btn>
            </div>
          </div>

          {/* Aggregate verdict strip */}
          <div style={{
            display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
            borderBottom: "1px solid var(--border)",
            background: "var(--paper-2)",
          }}>
            <VerdictCell label="GATE STATUS"   value="2 PASS · 1 PENDING"  tone="warn"   icon="check"/>
            <VerdictCell label="UNCLEAR SPECS" value="0 escalation"        tone="ok"     icon="issue"/>
            <VerdictCell label="REWORK ITEMS"  value="0"                   tone="ok"     icon="x"/>
            <VerdictCell label="NEXT STAGE"    value="Act → CEO sign-off"  tone="info"   icon="arrow"/>
          </div>

          {/* 3 QA lanes */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", minHeight: 0 }}>
            <QALane
              name="qa_1" model="codex_cli · ceo_decides" verdict="PASS"
              rationale="Tests cover acceptance_criteria.payment-success. Worktree diff is minimal and targeted. Receipt log includes stripe_id."
              files={[
                { name: "src/observatory/Stream.tsx", note: "Scroll container correctly virtualized. ✓" },
                { name: "src/observatory/Filter.tsx", note: "Filter chips preserve focus on rerender. ✓" },
                { name: "tests/observatory.test.ts",  note: "+18 LOC. Covers 3 of 3 new branches." },
              ]}
              tests={{pass: 16, total: 16}}
            />
            <QALane
              name="qa_2" model="codex_cli · ceo_decides" verdict="PASS"
              rationale="No regressions in adjacent screens. Style tokens kept. Memoization is correct under inspection."
              files={[
                { name: "src/observatory/Stream.tsx", note: "Reads tokens.css var. ✓" },
                { name: "src/observatory/Filter.tsx", note: "Aria attrs preserved." },
                { name: "tests/observatory.test.ts",  note: "Coverage delta +4%." },
              ]}
              tests={{pass: 16, total: 16}}
            />
            <QALane
              name="qa_3" model="gemini_cli · ceo_decides" verdict="PENDING"
              rationale="Pending: needs to confirm a11y label remains for the new scroll-to-bottom button."
              files={[
                { name: "src/observatory/Stream.tsx", note: "Scroll button visible — confirming aria-live region behavior under VoiceOver." },
              ]}
              tests={{pass: 16, total: 16}}
              running
            />
          </div>

          {/* Unclear specs panel + CEO escalation */}
          <div style={{
            borderTop: "1px solid var(--border)",
            background: "var(--paper-2)",
            padding: "10px 18px",
            display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em" }}>UNCLEAR-SPEC ISSUES</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>0 open · last escalation: 3 days ago</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="outline" icon="plus" size="md">Open issue</Btn>
              <Btn variant="solid" tone="accent" icon="arrow" size="md">Escalate to CEO</Btn>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function VerdictCell({ label, value, tone, icon }) {
  const c = `var(--${tone}${tone === "agent" ? "-deep" : ""})`;
  return (
    <div style={{
      padding: "12px 18px",
      borderRight: "1px solid var(--border)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{
        width: 28, height: 28, display: "grid", placeItems: "center",
        background: `var(--${tone}-bg)`, color: c, borderRadius: 3,
      }}>
        <Icon name={icon} size={14}/>
      </span>
      <div>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{label}</div>
        <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function QALane({ name, model, verdict, rationale, files, tests, running }) {
  const tone = verdict === "PASS" ? "ok" : verdict === "REWORK" ? "warn" : verdict === "ESCALATE" ? "danger" : "info";
  return (
    <div style={{
      borderRight: "1px solid var(--border)",
      background: "var(--paper)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Lane header */}
      <header style={{
        padding: "14px 16px",
        borderBottom: `2px solid var(--${tone})`,
        background: `color-mix(in oklab, var(--${tone}-bg) 35%, var(--surface))`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar ai size={26}/>
          <div style={{ flex: 1 }}>
            <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{model}</div>
          </div>
          <RoleBadge role="QA"/>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <VerdictStamp verdict={verdict} running={running}/>
          <span style={{flex:1}}/>
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
            tests {tests.pass}/{tests.total}{running && " · running"}
          </span>
        </div>
      </header>

      {/* Rationale */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>RATIONALE</div>
        <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.55 }}>{rationale}</div>
      </div>

      {/* Files annotated */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>FILES REVIEWED · {files.length}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 3,
              padding: "8px 10px",
            }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600 }}>
                <Icon name="doc" size={11}/>&nbsp;{f.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>{f.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sample diff / quote */}
      <div className="mono" style={{ flex: 1, padding: "12px 16px", overflow: "auto", fontSize: 11, lineHeight: 1.6, background: "var(--surface-sunk)" }}>
        <div style={{ color: "var(--ink-3)", marginBottom: 6, fontSize: 9, letterSpacing: "0.12em" }}>HUNK · src/observatory/Stream.tsx:48</div>
        <div style={{ background: "color-mix(in oklab, var(--danger-bg) 55%, transparent)", padding: "0 8px" }}>
          <span style={{ color: "var(--git-del)" }}>−</span> &nbsp;&lt;div className="log" onScroll={"{onScroll}"}/&gt;
        </div>
        <div style={{ background: "color-mix(in oklab, var(--ok-bg) 55%, transparent)", padding: "0 8px" }}>
          <span style={{ color: "var(--git-add)" }}>+</span> &nbsp;&lt;Virtualized rows={"{rows}"} onTail={"{stickToBottom}"}/&gt;
        </div>
      </div>

      {/* Actions */}
      <div style={{
        padding: "10px 14px",
        borderTop: "1px solid var(--border)",
        background: "var(--paper-2)",
        display: "flex", gap: 6,
      }}>
        <Btn variant={verdict === "PASS" ? "solid" : "outline"} tone={verdict === "PASS" ? "neutral" : "neutral"} size="sm" icon="check"
             style={verdict === "PASS" ? { background: "var(--ok)", borderColor: "var(--ok)", color: "white" } : {}}>
          PASS
        </Btn>
        <Btn variant="outline" size="sm" icon="x">REWORK</Btn>
        <Btn variant="outline" size="sm" icon="bolt">ESCALATE</Btn>
        <span style={{flex:1}}/>
        <button style={{ width: 24, height: 24, display: "grid", placeItems: "center", border: "1px solid var(--border)", borderRadius: 3, color: "var(--ink-3)" }}>
          <Icon name="more" size={11}/>
        </button>
      </div>
    </div>
  );
}

function VerdictStamp({ verdict, running }) {
  const map = {
    PASS:     { c: "var(--ok)",     bg: "var(--ok-bg)" },
    REWORK:   { c: "var(--warn)",   bg: "var(--warn-bg)" },
    ESCALATE: { c: "var(--danger)", bg: "var(--danger-bg)" },
    PENDING:  { c: "var(--info)",   bg: "var(--info-bg)" },
  };
  const m = map[verdict] || map.PENDING;
  return (
    <div className="mono" style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "4px 10px",
      background: m.bg,
      border: `1px solid ${m.c}`,
      borderRadius: 3,
      color: m.c,
      fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
      position: "relative",
    }}>
      {running && (
        <span style={{
          width: 8, height: 8, borderRadius: 99, background: m.c,
          animation: "pulse 1.6s ease-out infinite",
        }}/>
      )}
      {verdict}
    </div>
  );
}

window.QAGate = QAGate;
