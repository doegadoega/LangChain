// AGENT-REFINEMENT — Team Composer
// Pick roles, configure agents, model_decision toggle, save as Template.

function TeamComposer({ density, sidebarMode }) {
  return (
    <div className="strand" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar breadcrumb={["workspace", "team-composer", "team_local_full"]} density={density} theme="light"/>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideBar active="team" mode={sidebarMode}/>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>

          {/* Header */}
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "var(--paper-2)",
                        display: "flex", alignItems: "flex-end", gap: 18 }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                TEAM COMPOSER · TEMPLATE
              </div>
              <h1 className="serif" style={{ fontSize: 28, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 2 }}>
                team_local_full
              </h1>
              <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
                CEO + Manager + PMO + Worker x3 + QA x3 · standard full team
              </div>
            </div>
            <Btn variant="outline" icon="doc">Export team.md</Btn>
            <Btn variant="outline" icon="more">Duplicate</Btn>
            <Btn variant="solid" tone="accent" icon="check">Save template</Btn>
          </div>

          {/* Configuration strip */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            borderBottom: "1px solid var(--border)", background: "var(--surface)",
          }}>
            <ConfigCell label="WORKFLOW MODE" value="coding"            options={["writing", "coding"]} active="coding"/>
            <ConfigCell label="ORCHESTRATION" value="dependency_graph"  options={["sequential", "role_based", "dependency_graph"]} active="dependency_graph"/>
            <ConfigCell label="ROUNDS"        value="3"                 options={["1","2","3","4","5"]} active="3"/>
            <ConfigCell label="MEMBERS"       value="9 enabled · 1 disabled" options={null}/>
          </div>

          {/* Two-column: roster + detail */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.3fr 1fr", minHeight: 0 }}>

            {/* ROSTER */}
            <div style={{ overflow: "auto", padding: 18, borderRight: "1px solid var(--border)" }}>
              {ROLE_SECTIONS.map(sec => (
                <div key={sec.label} style={{ marginBottom: 22 }}>
                  <Hairline label={`${sec.label} · ${sec.count}`} n={sec.n}/>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {sec.agents.map(a => <AgentSlot key={a.id} a={a}/>)}
                  </div>
                </div>
              ))}
            </div>

            {/* DETAIL */}
            <div style={{ overflow: "auto", background: "var(--paper-2)" }}>
              {/* Selected agent edit form */}
              <div style={{ padding: 18 }}>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>EDITING · worker_2</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <Avatar ai size={28}/>
                  <h2 className="mono" style={{ fontSize: 20, fontWeight: 600 }}>worker_2</h2>
                  <RoleBadge role="WORKER"/>
                  <span style={{flex:1}}/>
                  <Pill tone="ok">ENABLED</Pill>
                </div>

                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                  <Field label="Provider"        type="radio"  options={["codex_cli","claude_cli","gemini_cli","custom_cli"]} value="claude_cli"/>
                  <Field label="Model decision"  type="radio"  options={["fixed","ceo_decides"]} value="ceo_decides"
                         help="When ceo_decides, the CEO picks model right before run starts."/>
                  <Field label="Model (override)" type="text"  value="claude-sonnet-4-6" disabled
                         help="Disabled because model_decision=ceo_decides."/>
                  <Field label="Persona"         type="textarea" value="Implement payment.py changes per acceptance criteria. Output diff and brief change summary. Hand off to qa_1–3." rows={3}/>
                  <Field label="Depends on"      type="chips"  value={["manager"]}/>

                  {/* Skill refs */}
                  <div>
                    <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>SKILL REFS · 2</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <SkillRef id="python-fastapi" version="exact: 1.2.0" enabled mismatch={null}/>
                      <SkillRef id="swiftui-implementation" version="latest" enabled mismatch="provider"/>
                      <button style={{
                        height: 28, border: "1px dashed var(--border-2)", borderRadius: 3,
                        color: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)",
                        background: "transparent", textAlign: "left", padding: "0 10px",
                      }}>+ add from library…</button>
                    </div>
                  </div>

                  {/* MCP */}
                  <div>
                    <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>MCP · ON</div>
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3, padding: 10, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>
                      <div>config_path: ~/.config/mcp/config.json</div>
                      <div>servers: [playwright, context7]</div>
                      <div style={{ color: "var(--ink-3)" }}>instruction: 必要なときだけ呼び出すこと</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const ROLE_SECTIONS = [
  { n: 1, label: "Decision · 1", count: 1, agents: [
    { id: "ceo", name: "ceo", role: "CEO", provider: "codex_cli", model: "—", decision: "fixed", enabled: true, persona: "最終意思決定、優先順位付け、モデル選定" },
  ]},
  { n: 2, label: "Coordination · 2", count: 2, agents: [
    { id: "manager", name: "manager", role: "MANAGER", provider: "codex_cli", model: "—", decision: "fixed", enabled: true, persona: "タスク分解、作業指示、進行管理" },
    { id: "pmo",     name: "pmo",     role: "PMO",     provider: "codex_cli", model: "—", decision: "ceo_decides", enabled: true, persona: "計画整合性、進捗/リスク監視" },
  ]},
  { n: 3, label: "Implementation · 3", count: 3, agents: [
    { id: "worker_1", name: "worker_1", role: "WORKER", provider: "claude_cli", model: "claude-sonnet-4-6", decision: "ceo_decides", enabled: true, persona: "設計・実装・修正" },
    { id: "worker_2", name: "worker_2", role: "WORKER", provider: "claude_cli", model: "claude-sonnet-4-6", decision: "ceo_decides", enabled: true, persona: "設計・実装・修正", selected: true },
    { id: "worker_3", name: "worker_3", role: "WORKER", provider: "claude_cli", model: "claude-sonnet-4-6", decision: "ceo_decides", enabled: true, persona: "設計・実装・修正" },
  ]},
  { n: 4, label: "Quality · 3", count: 3, agents: [
    { id: "qa_1", name: "qa_1", role: "QA", provider: "codex_cli",  model: "—", decision: "ceo_decides", enabled: true, persona: "仕様/設計/コード検証、テストコード作成" },
    { id: "qa_2", name: "qa_2", role: "QA", provider: "codex_cli",  model: "—", decision: "ceo_decides", enabled: true, persona: "受入条件への網羅性を見る" },
    { id: "qa_3", name: "qa_3", role: "QA", provider: "gemini_cli", model: "—", decision: "ceo_decides", enabled: true, persona: "境界条件・障害系の網羅性を見る" },
  ]},
  { n: 5, label: "Optional · 3", count: 3, agents: [
    { id: "ui_designer",     name: "ui_designer",     role: "UI",     provider: "claude_cli", model: "—", decision: "ceo_decides", enabled: false, persona: "画面デザイン、情報設計、UI仕様化" },
    { id: "system_designer", name: "system_designer", role: "SYSTEM", provider: "codex_cli",  model: "—", decision: "ceo_decides", enabled: false, persona: "システム構成、モジュール分割、境界設計" },
    { id: "ops_designer",    name: "ops_designer",    role: "OPS",    provider: "codex_cli",  model: "—", decision: "ceo_decides", enabled: false, persona: "運用設計、監視設計、障害運用設計" },
  ]},
];

function AgentSlot({ a }) {
  return (
    <div style={{
      background: a.enabled ? "var(--surface)" : "var(--surface-2)",
      border: "1px solid var(--border)",
      borderLeft: a.selected ? "3px solid var(--accent)" : `1px solid var(--border)`,
      borderRadius: 3,
      padding: 12,
      opacity: a.enabled ? 1 : 0.5,
      display: "flex", flexDirection: "column", gap: 8,
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Avatar ai size={22}/>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
        <span style={{flex:1}}/>
        <RoleBadge role={a.role}/>
      </div>

      <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", display: "flex", gap: 6 }}>
        <span>{a.provider}</span>
        <span style={{ color: "var(--ink-4)" }}>·</span>
        <span style={{ color: a.decision === "ceo_decides" ? "var(--agent-deep)" : "var(--ink-2)" }}>
          {a.decision === "ceo_decides" ? "ceo decides" : `model:${a.model}`}
        </span>
      </div>

      <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.4 }}>
        {a.persona}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
        <Toggle on={a.enabled}/>
        <span className="mono" style={{ fontSize: 10, color: a.enabled ? "var(--ok)" : "var(--ink-3)" }}>
          {a.enabled ? "ENABLED" : "DISABLED"}
        </span>
        <span style={{flex:1}}/>
        <button style={{ width: 22, height: 22, display: "grid", placeItems: "center", border: "1px solid var(--border)", borderRadius: 3, color: "var(--ink-3)" }}>
          <Icon name="more" size={11}/>
        </button>
      </div>
    </div>
  );
}

function Field({ label, type, options, value, disabled, help, rows = 1 }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      {type === "radio" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 0, border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)", width: "fit-content" }}>
          {options.map((o, i) => (
            <button key={o} className="mono" style={{
              padding: "6px 12px", fontSize: 11,
              background: o === value ? "var(--ink)" : "transparent",
              color: o === value ? "var(--paper)" : "var(--ink-2)",
              borderRight: i < options.length-1 ? "1px solid var(--border)" : "none",
            }}>{o}</button>
          ))}
        </div>
      )}
      {type === "text" && (
        <input value={value} disabled={disabled} className="mono" style={{
          width: "100%", height: 30, padding: "0 10px",
          border: "1px solid var(--border)", borderRadius: 3,
          background: disabled ? "var(--surface-2)" : "var(--surface)",
          color: disabled ? "var(--ink-3)" : "var(--ink)",
          fontSize: 12, fontFamily: "var(--font-mono)", outline: "none",
        }} readOnly/>
      )}
      {type === "textarea" && (
        <textarea defaultValue={value} rows={rows} className="mono" style={{
          width: "100%", padding: 10,
          border: "1px solid var(--border)", borderRadius: 3,
          background: "var(--surface)", color: "var(--ink)",
          fontSize: 12, fontFamily: "var(--font-sans)", resize: "vertical",
          outline: "none", lineHeight: 1.4,
        }}/>
      )}
      {type === "chips" && (
        <div style={{ display: "flex", gap: 6 }}>
          {value.map(v => (
            <span key={v} className="mono" style={{
              padding: "3px 8px", fontSize: 11,
              background: "var(--agent-bg)", color: "var(--agent-deep)",
              border: "1px solid var(--agent)", borderRadius: 2,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>{v} <button style={{ color: "var(--agent-deep)", opacity: 0.6 }}>×</button></span>
          ))}
          <button className="mono" style={{
            padding: "3px 8px", fontSize: 11, color: "var(--ink-3)",
            border: "1px dashed var(--border-2)", borderRadius: 2,
          }}>+ add</button>
        </div>
      )}
      {help && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{help}</div>}
    </div>
  );
}

function SkillRef({ id, version, enabled, mismatch }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto auto auto",
      alignItems: "center", gap: 10,
      padding: "8px 10px",
      background: "var(--surface)",
      border: `1px solid ${mismatch ? "var(--warn)" : "var(--border)"}`,
      borderRadius: 3,
    }}>
      <div>
        <div className="mono" style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          {mismatch && <Icon name="bolt" size={11} color="var(--warn)"/>}
          {id}
        </div>
        {mismatch && (
          <div style={{ fontSize: 10, color: "var(--warn)", marginTop: 2 }}>
            ⚠ {mismatch === "provider" ? "providers: [claude_cli] but skill is for swift_cli" : "role mismatch"}
          </div>
        )}
      </div>
      <span className="mono" style={{ fontSize: 10, padding: "2px 6px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 2 }}>{version}</span>
      <Toggle on={enabled}/>
      <button style={{ width: 22, height: 22, color: "var(--ink-3)" }}><Icon name="x" size={11}/></button>
    </div>
  );
}

function Toggle({ on }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      width: 28, height: 16,
      background: on ? "var(--ok)" : "var(--ink-4)",
      borderRadius: 99, padding: 2, position: "relative",
    }}>
      <span style={{
        width: 12, height: 12, background: "white", borderRadius: 99,
        transform: on ? "translateX(12px)" : "translateX(0)",
        transition: "transform 0.15s",
      }}/>
    </span>
  );
}

function ConfigCell({ label, value, options, active }) {
  return (
    <div style={{ padding: "14px 18px", borderRight: "1px solid var(--border)" }}>
      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{label}</div>
      {options ? (
        <div style={{ display: "flex", gap: 0, marginTop: 6, border: "1px solid var(--border)", borderRadius: 3, width: "fit-content", overflow: "hidden" }}>
          {options.map((o, i) => (
            <span key={o} className="mono" style={{
              padding: "4px 10px", fontSize: 11,
              background: o === active ? "var(--ink)" : "var(--surface)",
              color: o === active ? "var(--paper)" : "var(--ink-2)",
              borderRight: i < options.length-1 ? "1px solid var(--border)" : "none",
            }}>{o}</span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4 }}>{value}</div>
      )}
    </div>
  );
}

window.TeamComposer = TeamComposer;
