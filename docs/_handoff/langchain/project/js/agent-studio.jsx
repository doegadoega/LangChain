// AGENT-REFINEMENT — Agent Studio
// Master catalog of agents + skill_refs editor (per the brief).

function AgentStudio({ density, sidebarMode }) {
  return (
    <div className="strand" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar breadcrumb={["workspace", "agent-studio"]} density={density} theme="light"/>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideBar active="agents" mode={sidebarMode}/>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--paper)" }}>

          {/* Header */}
          <div style={{
            padding: "14px 22px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "flex-end", gap: 18, background: "var(--paper-2)",
          }}>
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                AGENT STUDIO · MASTER CATALOG
              </div>
              <h1 className="serif" style={{ fontSize: 28, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 2 }}>
                Master agents · 12
              </h1>
            </div>
            <Btn variant="outline" icon="doc" size="md">Import</Btn>
            <Btn variant="outline" icon="more" size="md">Duplicate</Btn>
            <Btn variant="solid" tone="accent" icon="plus" size="md">New agent</Btn>
          </div>

          {/* Toolbar */}
          <div style={{
            padding: "8px 22px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--paper)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              height: 28, padding: "0 10px",
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3,
              minWidth: 280,
            }}>
              <Icon name="search" size={12} color="var(--ink-3)"/>
              <input placeholder="search by name / persona / skill…" className="mono" style={{
                flex: 1, border: 0, background: "transparent", outline: "none",
                fontSize: 11, color: "var(--ink)", fontFamily: "var(--font-mono)",
              }}/>
              <Kbd>⌘</Kbd><Kbd>F</Kbd>
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>role:</span>
            <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)", overflow: "hidden" }}>
              {["ALL","CEO","MANAGER","WORKER","QA","PMO","DESIGNER"].map((r, i) => (
                <button key={r} className="mono" style={{
                  padding: "4px 8px", fontSize: 10,
                  background: i === 3 ? "var(--ink)" : "transparent",
                  color: i === 3 ? "var(--paper)" : "var(--ink-2)",
                  letterSpacing: "0.06em",
                  borderRight: i < 6 ? "1px solid var(--border)" : "none",
                }}>{r}</button>
              ))}
            </div>
            <span style={{ flex: 1 }}/>
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>showing 4 of 12 · role=WORKER</span>
          </div>

          {/* Two-panel: table + detail */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.2fr", minHeight: 0 }}>

            {/* TABLE */}
            <div style={{ overflow: "auto", borderRight: "1px solid var(--border)" }}>
              {/* Table header */}
              <div className="mono" style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 0.8fr 1fr 0.7fr 0.7fr 0.5fr",
                padding: "8px 14px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
                fontSize: 9, letterSpacing: "0.1em",
                color: "var(--ink-3)",
              }}>
                <span>NAME</span>
                <span>ROLE</span>
                <span>PROVIDER</span>
                <span>SKILLS</span>
                <span>UPDATED</span>
                <span></span>
              </div>

              {[
                { id: "worker_2", name: "worker_2", role: "WORKER",  provider: "claude_cli", decision: "ceo_decides", skills: ["python-fastapi", "swiftui-implementation"], updated: "2m", builtin: false, selected: true },
                { id: "worker_1", name: "worker_1", role: "WORKER",  provider: "claude_cli", decision: "ceo_decides", skills: ["python-fastapi"],                       updated: "1h",  builtin: false },
                { id: "worker_3", name: "worker_3", role: "WORKER",  provider: "claude_cli", decision: "ceo_decides", skills: ["typescript-react"],                     updated: "2h",  builtin: false },
                { id: "worker_perf", name: "worker_perf", role: "WORKER", provider: "claude_cli", decision: "fixed",    skills: ["performance-audit", "python-fastapi"],updated: "3d",   builtin: false },
                { id: "manager",  name: "manager",  role: "MANAGER", provider: "codex_cli",  decision: "fixed",       skills: ["decomposition","planning"],            updated: "1w",   builtin: true },
                { id: "ceo",      name: "ceo",      role: "CEO",     provider: "codex_cli",  decision: "fixed",       skills: ["decision","prioritization"],           updated: "1w",   builtin: true },
                { id: "pmo",      name: "pmo",      role: "PMO",     provider: "codex_cli",  decision: "ceo_decides", skills: ["plan-audit"],                          updated: "5d",   builtin: false },
                { id: "qa_1",     name: "qa_1",     role: "QA",      provider: "codex_cli",  decision: "ceo_decides", skills: ["test-writing","review"],               updated: "5d",   builtin: false },
                { id: "qa_2",     name: "qa_2",     role: "QA",      provider: "codex_cli",  decision: "ceo_decides", skills: ["coverage-audit"],                      updated: "5d",   builtin: false },
                { id: "qa_3",     name: "qa_3",     role: "QA",      provider: "gemini_cli", decision: "ceo_decides", skills: ["edge-case","escalation"],              updated: "5d",   builtin: false },
                { id: "ui_designer", name: "ui_designer", role: "UI",  provider: "claude_cli", decision: "ceo_decides", skills: ["swiftui-implementation","figma-bridge"], updated: "2w", builtin: false },
                { id: "system_designer", name: "system_designer", role: "SYSTEM", provider: "codex_cli", decision: "ceo_decides", skills: ["architecture"], updated: "2w", builtin: false },
              ].map(a => (
                <div key={a.id} style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 0.8fr 1fr 0.7fr 0.7fr 0.5fr",
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  background: a.selected ? "var(--surface)" : "transparent",
                  borderLeft: a.selected ? "2px solid var(--accent)" : "2px solid transparent",
                  fontSize: 11, alignItems: "center", cursor: "pointer",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar ai size={20}/>
                    <span className="mono" style={{ fontSize: 12, fontWeight: a.selected ? 600 : 500 }}>{a.name}</span>
                    {a.builtin && <Pill tone="neutral">BUILT-IN</Pill>}
                  </span>
                  <span><RoleBadge role={a.role}/></span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-2)" }}>
                    {a.provider}
                    <span style={{ color: a.decision === "ceo_decides" ? "var(--agent-deep)" : "var(--ink-3)", marginLeft: 6 }}>
                      · {a.decision === "ceo_decides" ? "ceo" : "fixed"}
                    </span>
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-2)" }}>{a.skills.length}</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{a.updated}</span>
                  <span style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button style={{ width: 22, height: 22, color: "var(--ink-3)", borderRadius: 3 }}><Icon name="more" size={11}/></button>
                  </span>
                </div>
              ))}
            </div>

            {/* DETAIL */}
            <div style={{ overflow: "auto", background: "var(--paper-2)" }}>
              <AgentDetail/>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function AgentDetail() {
  return (
    <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar ai size={36}/>
        <div style={{ flex: 1 }}>
          <h2 className="mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>worker_2</h2>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
            claude_cli · claude-sonnet-4-6 · ceo_decides · updated 2 min ago
          </div>
        </div>
        <RoleBadge role="WORKER"/>
        <Btn variant="outline" size="sm" icon="more">Duplicate</Btn>
        <Btn variant="solid" tone="accent" size="sm" icon="check">Save</Btn>
      </div>

      {/* Tabs */}
      <div className="mono" style={{
        display: "flex", borderBottom: "1px solid var(--border)",
        fontSize: 10, letterSpacing: "0.06em",
      }}>
        {["GENERAL","SKILLS","MCP","DEPENDENCIES","HISTORY"].map((t, i) => (
          <button key={t} style={{
            padding: "8px 14px",
            color: i === 1 ? "var(--ink)" : "var(--ink-3)",
            borderBottom: i === 1 ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1, fontWeight: i === 1 ? 600 : 400,
          }}>{t}</button>
        ))}
      </div>

      {/* Legacy skills (free-form tags) */}
      <div>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>
          LEGACY TAGS · free-form · skills: string[]
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {["python","backend","stripe-integration"].map(t => (
            <span key={t} className="mono" style={{
              padding: "3px 8px", fontSize: 11,
              background: "var(--surface)", color: "var(--ink-2)",
              border: "1px solid var(--border-2)", borderRadius: 2,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {t} <button style={{ color: "var(--ink-3)", opacity: 0.6 }}>×</button>
            </span>
          ))}
          <button className="mono" style={{
            padding: "3px 8px", fontSize: 11, color: "var(--ink-3)",
            border: "1px dashed var(--border-2)", borderRadius: 2,
          }}>+ tag</button>
        </div>
      </div>

      {/* === SKILL_REFS EDITOR === */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 3,
      }}>
        <div style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--paper-2)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>
            インストール済みスキル
          </span>
          <Pill tone="agent">skill_refs · 3</Pill>
          <span style={{ flex: 1 }}/>
          <Btn variant="outline" size="sm" icon="plus">スキルを追加</Btn>
        </div>

        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <SkillRefRow
            id="python-fastapi"
            description="FastAPI patterns: routing, dependency injection, testing"
            providers={["claude_cli","codex_cli"]}
            roles={["worker"]}
            installed="1.2.0"
            versionMode="exact"
            versionValue="1.2.0"
            enabled
            installedVersions={["1.0.0","1.1.0","1.2.0"]}
          />
          <SkillRefRow
            id="swiftui-implementation"
            description="SwiftUI views, AppKit bridge, NSOpenPanel patterns"
            providers={["custom_cli"]}
            roles={["worker","ui_designer"]}
            installed="1.3.0"
            versionMode="latest"
            versionValue="latest"
            enabled
            mismatch={{ kind: "provider", current: "claude_cli", expected: ["custom_cli"] }}
            installedVersions={["1.0.0","1.2.1","1.3.0"]}
          />
          <SkillRefRow
            id="stripe-webhook-verification"
            description="HMAC signature verification + idempotency"
            providers={[]}
            roles={[]}
            installed="0.4.2"
            versionMode="latest_compatible"
            versionValue="latest_compatible"
            enabled={false}
            installedVersions={["0.3.0","0.4.0","0.4.2"]}
          />

          <button style={{
            height: 32, border: "1px dashed var(--border-2)", borderRadius: 3,
            color: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-mono)",
            background: "transparent", textAlign: "left", padding: "0 12px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="plus" size={11}/>
            Library から選択… (12 installed)
          </button>
        </div>
      </div>

      {/* Persona */}
      <div>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>PERSONA</div>
        <textarea defaultValue={"設計・実装・修正。受入条件を満たすか自己レビューしてから qa_1–3 にハンドオフする。Stripe API のシグネチャ検証は必ず実装する。"}
          rows={3} style={{
          width: "100%", padding: 10,
          border: "1px solid var(--border)", borderRadius: 3,
          background: "var(--surface)", color: "var(--ink)",
          fontSize: 12, fontFamily: "var(--font-sans)", lineHeight: 1.5,
          resize: "vertical", outline: "none",
        }}/>
      </div>

      {/* Source preview */}
      <div>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6,
                                       display: "flex", alignItems: "center", gap: 8 }}>
          <span>RENDERED PROMPT · preview</span>
          <span style={{flex:1}}/>
          <button style={{ fontSize: 10, color: "var(--ink-2)" }}>copy</button>
        </div>
        <pre className="mono" style={{
          background: "var(--ink)", color: "var(--paper)",
          padding: 14, borderRadius: 3,
          fontSize: 11, lineHeight: 1.55,
          whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 200,
        }}>
{`# Agent: worker_2  (WORKER)
# Provider: claude_cli  Model: ceo_decides → claude-sonnet-4-6

You are a worker. Implement payment.py changes per acceptance
criteria. Output diff and brief change summary. Hand off to qa_1–3.

## Skills loaded
- python-fastapi@1.2.0
- swiftui-implementation@1.3.0  ⚠ provider mismatch
- stripe-webhook-verification@0.4.2  (disabled)

## Legacy tags
python, backend, stripe-integration

## Tools
read_file, write_file, run_shell, list_directory, search`}
        </pre>
      </div>
    </div>
  );
}

function SkillRefRow({ id, description, providers, roles, installed, versionMode, versionValue, enabled, mismatch, installedVersions }) {
  return (
    <div style={{
      border: `1px solid ${mismatch ? "var(--warn)" : "var(--border)"}`,
      borderRadius: 3,
      background: enabled ? "var(--paper)" : "var(--surface-2)",
      opacity: enabled ? 1 : 0.6,
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        alignItems: "center", gap: 12,
        padding: "10px 12px",
      }}>
        <div>
          <div className="mono" style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            {mismatch && <Icon name="bolt" size={12} color="var(--warn)"/>}
            {id}
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400 }}>
              · installed: {installed}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>{description}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em" }}>PROVIDERS</span>
            {providers.length === 0 ? (
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>* all</span>
            ) : providers.map(p => (
              <span key={p} className="mono" style={{
                fontSize: 10, padding: "1px 6px",
                background: "var(--surface)", color: "var(--ink-2)",
                border: "1px solid var(--border-2)", borderRadius: 2,
              }}>{p}</span>
            ))}
            <span style={{ width: 1, height: 12, background: "var(--border)" }}/>
            <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em" }}>ROLES</span>
            {roles.length === 0 ? (
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>* all</span>
            ) : roles.map(r => (
              <span key={r} className="mono" style={{
                fontSize: 10, padding: "1px 6px",
                background: "var(--agent-bg)", color: "var(--agent-deep)",
                border: "1px solid var(--agent)", borderRadius: 2,
              }}>{r}</span>
            ))}
          </div>
          {mismatch && (
            <div style={{
              marginTop: 8, padding: "6px 10px",
              background: "var(--warn-bg)", color: "var(--warn)",
              border: "1px solid var(--warn)", borderRadius: 2,
              fontSize: 11, display: "flex", alignItems: "center", gap: 6,
            }}>
              <Icon name="bolt" size={11}/>
              <span>
                provider mismatch — agent uses <b>{mismatch.current}</b> but skill targets {mismatch.expected.map(e => <code key={e} style={{ fontFamily: "var(--font-mono)", padding: "0 4px", background: "var(--surface)", borderRadius: 2 }}>{e}</code>)}
              </span>
            </div>
          )}
        </div>

        {/* Version */}
        <div>
          <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.08em", marginBottom: 4 }}>VERSION</div>
          <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)" }}>
            {[
              { v: "latest", l: "latest" },
              { v: "latest_compatible", l: "compat" },
              { v: "exact", l: "exact" },
            ].map((o, i) => (
              <button key={o.v} className="mono" style={{
                padding: "4px 8px", fontSize: 10,
                background: o.v === versionMode ? "var(--ink)" : "transparent",
                color: o.v === versionMode ? "var(--paper)" : "var(--ink-2)",
                borderRight: i < 2 ? "1px solid var(--border)" : "none",
              }}>{o.l}</button>
            ))}
          </div>
          {versionMode === "exact" && (
            <select className="mono" defaultValue={versionValue} style={{
              marginTop: 4, padding: "3px 8px",
              border: "1px solid var(--border)", borderRadius: 2,
              background: "var(--surface)", fontSize: 11,
              fontFamily: "var(--font-mono)", color: "var(--ink)",
            }}>
              {installedVersions.map(v => <option key={v}>{v}</option>)}
            </select>
          )}
        </div>

        {/* Enabled toggle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.08em" }}>ENABLED</div>
          <Toggle on={enabled}/>
        </div>

        {/* Delete */}
        <button style={{
          width: 28, height: 28, display: "grid", placeItems: "center",
          color: "var(--ink-3)", border: "1px solid var(--border)", borderRadius: 3,
          alignSelf: "flex-start",
        }}><Icon name="x" size={12}/></button>
      </div>
    </div>
  );
}

window.AgentStudio = AgentStudio;
