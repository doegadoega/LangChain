// AGENT-REFINEMENT — Workflow Editor
// Node-based: start / end / slot / gate / loop / fork / join

function WorkflowEditor({ density, sidebarMode }) {
  return (
    <div className="strand" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar breadcrumb={["workspace", "workflow-editor", "wf_local_full"]} density={density} theme="light"/>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideBar active="workflow" mode={sidebarMode}/>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>

          {/* Header */}
          <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)",
                        display: "flex", alignItems: "center", gap: 14, background: "var(--paper-2)" }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>WORKFLOW EDITOR</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 }}>
                <h1 className="serif" style={{ fontSize: 24, fontStyle: "italic", letterSpacing: "-0.02em" }}>
                  wf_local_full
                </h1>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>15 nodes · 16 edges · saved 2 min ago</span>
              </div>
            </div>

            {/* Workflow selector */}
            <button className="mono" style={{
              height: 30, padding: "0 12px", display: "flex", alignItems: "center", gap: 8,
              border: "1px solid var(--border)", borderRadius: 3,
              background: "var(--surface)", fontSize: 12,
            }}>
              <Icon name="branch" size={12}/>
              wf_local_full
              <Icon name="chevDn" size={10}/>
            </button>

            <Btn variant="outline" icon="x">Delete</Btn>
            <Btn variant="outline" icon="check">Save</Btn>
            <Btn variant="solid" tone="accent" icon="play">Run with this flow</Btn>
          </div>

          {/* 3-pane workspace */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "200px 1fr 320px", minHeight: 0 }}>

            {/* PALETTE */}
            <aside style={{
              borderRight: "1px solid var(--border)",
              background: "var(--paper-2)",
              overflow: "auto",
            }}>
              <div className="mono" style={{
                padding: "10px 14px", borderBottom: "1px solid var(--border)",
                fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em",
              }}>PALETTE</div>
              {[
                { kind: "start", label: "Start",  desc: "Entry point",          shape: "circle",   color: "var(--ok)" },
                { kind: "end",   label: "End",    desc: "Terminal",             shape: "circle",   color: "var(--ink)" },
                { kind: "slot",  label: "Slot",   desc: "Agent execution",      shape: "rect",     color: "var(--accent)" },
                { kind: "gate",  label: "Gate",   desc: "QA judgment branch",   shape: "diamond",  color: "var(--warn)" },
                { kind: "loop",  label: "Loop",   desc: "Iterate N rounds",     shape: "rounded",  color: "var(--info)" },
                { kind: "fork",  label: "Fork",   desc: "Parallel split",       shape: "triUp",    color: "var(--agent)" },
                { kind: "join",  label: "Join",   desc: "Parallel merge",       shape: "triDn",    color: "var(--agent)" },
              ].map(n => (
                <div key={n.kind} draggable style={{
                  margin: "6px 8px", padding: "8px 10px",
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3,
                  display: "flex", alignItems: "center", gap: 10, cursor: "grab",
                }}>
                  <NodeGlyph shape={n.shape} color={n.color} size={20}/>
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{n.label}</div>
                    <div style={{ fontSize: 10, color: "var(--ink-3)" }}>{n.desc}</div>
                  </div>
                </div>
              ))}

              <div className="mono" style={{
                padding: "14px 14px 6px", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em",
                borderTop: "1px solid var(--border)", marginTop: 10,
              }}>BUILT-IN PRESETS</div>
              {[
                { name: "wf_sequential",      desc: "linear PDCA" },
                { name: "wf_role_based",      desc: "role-driven branching" },
                { name: "wf_dependency_graph",desc: "explicit deps" },
              ].map(p => (
                <div key={p.name} style={{
                  margin: "2px 8px", padding: "6px 10px",
                  fontSize: 11, color: "var(--ink-2)",
                  borderRadius: 3, cursor: "pointer",
                }}>
                  <div className="mono" style={{ fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-3)" }}>{p.desc}</div>
                </div>
              ))}
            </aside>

            {/* CANVAS */}
            <div style={{
              position: "relative",
              background: "var(--surface-2)",
              backgroundImage: "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--ink) 12%, transparent) 1px, transparent 0)",
              backgroundSize: "16px 16px",
              overflow: "hidden",
            }}>
              {/* Canvas toolbar */}
              <div style={{
                position: "absolute", top: 10, left: 12,
                display: "flex", gap: 6, alignItems: "center",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 3, padding: 4, zIndex: 2,
              }}>
                <button style={canvasBtn}><Icon name="plus" size={11}/></button>
                <button style={canvasBtn}><Icon name="x" size={11}/></button>
                <span style={{ width: 1, height: 16, background: "var(--border)" }}/>
                <button style={canvasBtn}><Icon name="branch" size={11}/></button>
                <span style={{ width: 1, height: 16, background: "var(--border)" }}/>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", padding: "0 8px" }}>100%</span>
              </div>
              <div style={{
                position: "absolute", top: 10, right: 12,
                display: "flex", gap: 6, alignItems: "center",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 3, padding: "4px 10px", zIndex: 2,
                fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-2)",
              }}>
                <Dot tone="ok" size={5}/>
                <span>autosave · 14:32</span>
              </div>

              <FlowSVG/>
            </div>

            {/* PROPERTIES */}
            <aside style={{
              borderLeft: "1px solid var(--border)",
              background: "var(--paper)",
              overflow: "auto",
            }}>
              <div className="mono" style={{
                padding: "10px 14px", borderBottom: "1px solid var(--border)",
                fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em",
                display: "flex", alignItems: "center",
              }}>
                <span>PROPERTIES</span>
                <span style={{flex:1}}/>
                <span style={{ color: "var(--ink-2)" }}>node selected</span>
              </div>

              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <NodeGlyph shape="diamond" color="var(--warn)" size={32}/>
                  <div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>gate_qa</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>kind: gate · id: node_07</div>
                  </div>
                </div>

                <Field2 label="Label"      type="text"  value="gate_qa"/>
                <Field2 label="Condition"  type="select" value="all_qa_pass" options={["all_qa_pass","majority","any_pass","ceo_override"]}/>
                <Field2 label="On REWORK"  type="select" value="loop_to → manager" options={["loop_to → manager","loop_to → worker","fail_run"]}/>
                <Field2 label="On ESCALATE" type="select" value="branch → ceo_node" options={["branch → ceo_node","fail_run"]}/>
                <Field2 label="On PASS"    type="select" value="continue → next" options={["continue → next","branch → custom"]}/>

                <div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>REQUIRED QA</div>
                  <div className="mono" style={{ fontSize: 11, padding: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3, color: "var(--ink-2)" }}>
                    qa_1, qa_2, qa_3 <span style={{ color: "var(--ink-3)" }}>· all 3 must PASS</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <Btn variant="outline" size="sm" icon="x">Delete node</Btn>
                  <span style={{ flex: 1 }}/>
                  <Btn variant="solid" size="sm" icon="check">Apply</Btn>
                </div>
              </div>

              {/* Connected edges */}
              <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 8 }}>EDGES · 4</div>
                {[
                  { from: "join_workers", to: "gate_qa",   label: "in"  },
                  { from: "gate_qa",      to: "end",       label: "PASS" },
                  { from: "gate_qa",      to: "manager",   label: "REWORK" },
                  { from: "gate_qa",      to: "ceo",       label: "ESCALATE" },
                ].map((e, i) => (
                  <div key={i} className="mono" style={{
                    fontSize: 11, padding: "6px 8px",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 3, marginBottom: 4,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span>{e.from}</span>
                    <Icon name="arrow" size={10} color="var(--ink-3)"/>
                    <span>{e.to}</span>
                    <span style={{flex:1}}/>
                    <span style={{
                      fontSize: 9, color: e.label === "PASS" ? "var(--ok)" : e.label === "REWORK" ? "var(--warn)" : e.label === "ESCALATE" ? "var(--danger)" : "var(--ink-3)",
                      letterSpacing: "0.08em",
                    }}>{e.label}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

const canvasBtn = {
  width: 24, height: 22, display: "grid", placeItems: "center",
  color: "var(--ink-2)", borderRadius: 2,
};

// ---------- Flow SVG ----------
function FlowSVG() {
  // Layout:  start → ceo → manager → fork → (worker_1 / worker_2 / worker_3) → join → gate_qa → (PASS→end / REWORK→manager / ESCALATE→ceo)
  // Plus loop edge for round iteration

  return (
    <svg viewBox="0 0 980 580" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      {/* Edges */}
      <g stroke="var(--ink-3)" strokeWidth="1.4" fill="none">
        {/* start → ceo */}
        <path d="M 75 280 L 145 280" markerEnd="url(#arrow)"/>
        {/* ceo → manager */}
        <path d="M 215 280 L 285 280" markerEnd="url(#arrow)"/>
        {/* manager → fork */}
        <path d="M 365 280 L 425 280" markerEnd="url(#arrow)"/>
        {/* fork → workers */}
        <path d="M 470 270 C 510 220, 510 170, 550 150" markerEnd="url(#arrow)"/>
        <path d="M 470 280 L 550 280" markerEnd="url(#arrow)"/>
        <path d="M 470 290 C 510 340, 510 390, 550 410" markerEnd="url(#arrow)"/>
        {/* workers → join */}
        <path d="M 630 150 C 680 170, 680 220, 720 270" markerEnd="url(#arrow)"/>
        <path d="M 630 280 L 720 280" markerEnd="url(#arrow)"/>
        <path d="M 630 410 C 680 390, 680 340, 720 290" markerEnd="url(#arrow)"/>
        {/* join → gate */}
        <path d="M 765 280 L 825 280" markerEnd="url(#arrow)"/>
      </g>

      {/* highlighted edges (PASS / REWORK / ESCALATE from gate) */}
      <g fill="none" strokeWidth="1.6">
        {/* PASS → end */}
        <path d="M 870 280 L 930 280" stroke="var(--ok)" markerEnd="url(#arrowOk)"/>
        {/* REWORK → manager (loop back) */}
        <path d="M 845 305 C 800 480, 400 480, 325 320" stroke="var(--warn)" strokeDasharray="3 3" markerEnd="url(#arrowWarn)"/>
        {/* ESCALATE → ceo */}
        <path d="M 845 260 C 700 90, 280 70, 180 250" stroke="var(--danger)" strokeDasharray="3 3" markerEnd="url(#arrowDanger)"/>
      </g>

      {/* Edge labels */}
      <g fontFamily="var(--font-mono)" fontSize="9" letterSpacing="0.08em">
        <text x="893" y="270" fill="var(--ok)">PASS</text>
        <text x="615" y="500" fill="var(--warn)">REWORK</text>
        <text x="495" y="80" fill="var(--danger)">ESCALATE</text>
        <text x="395" y="270" fill="var(--ink-3)">fork</text>
        <text x="670" y="270" fill="var(--ink-3)">join</text>
      </g>

      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-3)"/>
        </marker>
        <marker id="arrowOk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ok)"/>
        </marker>
        <marker id="arrowWarn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--warn)"/>
        </marker>
        <marker id="arrowDanger" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--danger)"/>
        </marker>
      </defs>

      {/* Nodes */}
      <FlowNode x={40}  y={260} kind="start"  label="start"          shape="circle"  color="var(--ok)"/>
      <FlowNode x={145} y={250} kind="slot"   label="ceo"            sub="CEO · codex"     shape="rect"    color="var(--ink)"     w={75}/>
      <FlowNode x={285} y={250} kind="slot"   label="manager"        sub="MGR · codex"     shape="rect"    color="var(--info)"    w={85}/>
      <FlowNode x={420} y={260} kind="fork"   label="fork"           shape="triUp"   color="var(--agent)"/>
      <FlowNode x={545} y={120} kind="slot"   label="worker_1"       sub="WK · claude"     shape="rect"    color="var(--accent)"  w={90}/>
      <FlowNode x={545} y={250} kind="slot"   label="worker_2"       sub="WK · claude"     shape="rect"    color="var(--accent)"  w={90}/>
      <FlowNode x={545} y={380} kind="slot"   label="worker_3"       sub="WK · claude"     shape="rect"    color="var(--accent)"  w={90}/>
      <FlowNode x={720} y={260} kind="join"   label="join"           shape="triDn"   color="var(--agent)"/>
      <FlowNode x={825} y={250} kind="gate"   label="gate_qa"        sub="all PASS"        shape="diamond" color="var(--warn)"    w={75} selected/>
      <FlowNode x={925} y={260} kind="end"    label="end"            shape="circle"  color="var(--ink)"/>
    </svg>
  );
}

function FlowNode({ x, y, kind, label, sub, shape, color, w = 60, selected }) {
  const h = sub ? 50 : 40;
  const labelStyle = { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, fill: "var(--ink)" };
  const subStyle = { fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--ink-3)" };

  if (shape === "circle") {
    return (
      <g transform={`translate(${x},${y})`}>
        <circle cx={17} cy={17} r={selected ? 17 : 15} fill="white" stroke={color} strokeWidth={selected ? 2 : 1.5}/>
        <text x={17} y={20} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fontWeight={600} fill={color}>{label === "start" ? "S" : "E"}</text>
      </g>
    );
  }
  if (shape === "diamond") {
    return (
      <g transform={`translate(${x},${y})`}>
        <path d={`M ${w/2} 0 L ${w} 30 L ${w/2} 60 L 0 30 Z`} fill="white" stroke={color} strokeWidth={selected ? 2.5 : 1.5}/>
        {selected && <path d={`M ${w/2} -4 L ${w+4} 30 L ${w/2} 64 L -4 30 Z`} fill="none" stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3"/>}
        <text x={w/2} y={28} textAnchor="middle" style={labelStyle}>{label}</text>
        {sub && <text x={w/2} y={42} textAnchor="middle" style={subStyle}>{sub}</text>}
      </g>
    );
  }
  if (shape === "triUp" || shape === "triDn") {
    const points = shape === "triUp"
      ? `0,${h/2} 50,0 50,${h}`
      : `50,${h/2} 0,0 0,${h}`;
    return (
      <g transform={`translate(${x},${y - 5})`}>
        <polygon points={points} fill="white" stroke={color} strokeWidth={1.5}/>
        <text x={shape === "triUp" ? 30 : 20} y={h/2 + 4} textAnchor="middle" style={{...labelStyle, fontSize: 9, fill: color}}>{label}</text>
      </g>
    );
  }
  // rect
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={w} height={h} rx={3} fill="white" stroke={color} strokeWidth={1.5}/>
      <rect x={0} y={0} width={4} height={h} fill={color}/>
      <text x={10} y={sub ? 20 : 24} style={labelStyle}>{label}</text>
      {sub && <text x={10} y={36} style={subStyle}>{sub}</text>}
    </g>
  );
}

function NodeGlyph({ shape, color, size = 18 }) {
  if (shape === "circle") return <svg width={size} height={size}><circle cx={size/2} cy={size/2} r={size/2 - 1} fill="white" stroke={color} strokeWidth={1.5}/></svg>;
  if (shape === "diamond") return <svg width={size} height={size}><path d={`M ${size/2} 1 L ${size-1} ${size/2} L ${size/2} ${size-1} L 1 ${size/2} Z`} fill="white" stroke={color} strokeWidth={1.5}/></svg>;
  if (shape === "triUp") return <svg width={size} height={size}><polygon points={`1,${size-1} ${size/2},1 ${size-1},${size-1}`} fill="white" stroke={color} strokeWidth={1.5}/></svg>;
  if (shape === "triDn") return <svg width={size} height={size}><polygon points={`1,1 ${size-1},1 ${size/2},${size-1}`} fill="white" stroke={color} strokeWidth={1.5}/></svg>;
  if (shape === "rounded") return <svg width={size} height={size}><rect x={1} y={3} width={size-2} height={size-6} rx={6} fill="white" stroke={color} strokeWidth={1.5}/></svg>;
  return <svg width={size} height={size}><rect x={1} y={3} width={size-2} height={size-6} rx={1} fill="white" stroke={color} strokeWidth={1.5}/><rect x={1} y={3} width={3} height={size-6} fill={color}/></svg>;
}

function Field2({ label, type, value, options }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
      {type === "text" && (
        <input defaultValue={value} className="mono" style={{
          width: "100%", height: 28, padding: "0 10px",
          border: "1px solid var(--border)", borderRadius: 3,
          background: "var(--surface)", color: "var(--ink)",
          fontSize: 12, fontFamily: "var(--font-mono)", outline: "none",
        }}/>
      )}
      {type === "select" && (
        <button className="mono" style={{
          width: "100%", height: 28, padding: "0 10px",
          border: "1px solid var(--border)", borderRadius: 3,
          background: "var(--surface)", color: "var(--ink)",
          fontSize: 12, fontFamily: "var(--font-mono)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>{value}</span>
          <Icon name="chevDn" size={10} color="var(--ink-3)"/>
        </button>
      )}
    </div>
  );
}

window.WorkflowEditor = WorkflowEditor;
