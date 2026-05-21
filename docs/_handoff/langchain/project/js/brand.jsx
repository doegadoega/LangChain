// STRAND — Brand identity artboard

function BrandArtboard() {
  return (
    <div className="strand strand-grid" style={{ padding: 40, overflow: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 48, height: "100%" }}>

        {/* LEFT: hero wordmark + manifesto */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.18em", display: "flex", gap: 16 }}>
            <span>AGENT—REFINEMENT / IDENTITY</span>
            <span>v2.0</span>
            <span style={{flex:1}}/>
            <span>2026—05—20</span>
          </div>

          {/* Big wordmark */}
          <div style={{ marginTop: 8 }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontWeight: 600,
              fontSize: 96, lineHeight: 0.9, letterSpacing: "-0.04em",
              color: "var(--ink)",
            }}>
              agent<span style={{ color: "var(--accent)" }}>—</span>refinement<span style={{ color: "var(--accent)" }}>_</span>
            </div>
            <div className="serif" style={{
              fontSize: 28, lineHeight: 1.2, color: "var(--ink-2)",
              fontStyle: "italic", marginTop: 16, maxWidth: 620,
              letterSpacing: "-0.01em",
            }}>
              A control surface for an organisation of agents: <span style={{ color: "var(--ink)" }}>plan, do, check, act</span>—observable, every turn.
            </div>
          </div>

          {/* Manifesto */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginTop: 32, maxWidth: 720 }}>
            {[
              { n: "01", t: "OBSERVABLE",  d: "Every turn (turn_started → turn_completed) and every file diff is a log line you can replay." },
              { n: "02", t: "CONTINUOUS",  d: "Coding is a session of versions, not a single request. Worktree-isolated, resumeable." },
              { n: "03", t: "GATED",       d: "PASS · REWORK · ESCALATE — three QA must agree before the next stage." },
            ].map(p => (
              <div key={p.n} style={{ borderTop: "1px solid var(--ink)", paddingTop: 10 }}>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em" }}>{p.n}</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 600, marginTop: 4, letterSpacing: "0.02em" }}>{p.t}</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>{p.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: tokens */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Mark variants */}
          <div>
            <Hairline label="Mark" n={1}/>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ aspectRatio: "1", display: "grid", placeItems: "center", background: "var(--surface)", borderRight: "1px solid var(--border)" }}><StrandMark size={36} color="var(--ink)"/></div>
              <div style={{ aspectRatio: "1", display: "grid", placeItems: "center", background: "var(--ink)", borderRight: "1px solid var(--border)" }}><StrandMark size={36} color="var(--paper)"/></div>
              <div style={{ aspectRatio: "1", display: "grid", placeItems: "center", background: "var(--accent)", borderRight: "1px solid var(--border)" }}><StrandMark size={36} color="white"/></div>
              <div style={{ aspectRatio: "1", display: "grid", placeItems: "center", background: "var(--paper-2)" }}>
                <span className="mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em" }}>$_</span>
              </div>
            </div>
          </div>

          {/* Color */}
          <div>
            <Hairline label="Color" n={2}/>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["Paper",   "var(--paper)",   "#F4EFE3", "var(--ink)"],
                ["Ink",     "var(--ink)",     "#14110D", "var(--paper)"],
                ["Tangerine","var(--accent)", "#FF5B1F", "white"],
                ["Agent",   "var(--agent)",   "#5B3FD9", "white"],
                ["Ok",      "var(--ok)",      "#1E7A4A", "white"],
                ["Warn",    "var(--warn)",    "#A56A0E", "white"],
              ].map(([n, v, hex, fg]) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 0, height: 32, border: "1px solid var(--border)" }}>
                  <div style={{ width: 60, height: "100%", background: v, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600 }}>{n}</div>
                  <div className="mono" style={{ flex: 1, padding: "0 12px", fontSize: 11, color: "var(--ink-2)" }}>{hex}</div>
                  <div className="mono" style={{ padding: "0 12px", fontSize: 10, color: "var(--ink-3)" }}>--{n.toLowerCase()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <Hairline label="Type" n={3}/>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>JETBRAINS MONO · UI + CODE</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>turn_completed(qa_2)</div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>GEIST · BODY</div>
                <div style={{ fontSize: 18, marginTop: 2 }}>3 QA reviewers passed. Worktree merged. v3 archived.</div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>INSTRUMENT SERIF · EDITORIAL</div>
                <div className="serif" style={{ fontSize: 24, fontStyle: "italic", marginTop: 2 }}>Plan, do, check, act.</div>
              </div>
            </div>
          </div>

          {/* Component samples */}
          <div>
            <Hairline label="Components" n={4}/>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", padding: 14 }}>
              <Pill tone="ok">PASS</Pill>
              <Pill tone="warn">REWORK</Pill>
              <Pill tone="danger">ESCALATE</Pill>
              <Pill tone="info">RUNNING</Pill>
              <Pill tone="agent">CEO</Pill>
              <Pill tone="agent">MANAGER</Pill>
              <Pill tone="agent">WORKER · 3</Pill>
              <Pill tone="agent">QA · 3</Pill>
              <Btn variant="solid" tone="accent" icon="play">Run refinement</Btn>
              <Btn variant="outline" icon="branch">worktree</Btn>
              <Btn variant="ghost" icon="more">More</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.BrandArtboard = BrandArtboard;
