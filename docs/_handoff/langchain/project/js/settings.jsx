// AGENT-REFINEMENT — Settings
// Providers, defaults, skill catalog, audit policy, system info.

function Settings({ density, sidebarMode }) {
  return (
    <div className="strand" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar breadcrumb={["workspace", "settings"]} density={density} theme="light"/>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideBar active="settings" mode={sidebarMode}/>
        <main style={{ flex: 1, display: "flex", overflow: "hidden", background: "var(--paper)" }}>

          {/* Settings sub-nav */}
          <aside style={{
            width: 220, borderRight: "1px solid var(--border)",
            background: "var(--paper-2)",
            display: "flex", flexDirection: "column",
            padding: "16px 0",
          }}>
            <div className="mono" style={{ padding: "0 16px 8px", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em" }}>SETTINGS</div>
            {[
              { id: "providers",  label: "Providers",        n: "01", on: true },
              { id: "defaults",   label: "Defaults",         n: "02" },
              { id: "skills",     label: "Skill catalog",    n: "03" },
              { id: "audit",      label: "Audit & retention", n: "04" },
              { id: "appearance", label: "Appearance",       n: "05" },
              { id: "shortcuts",  label: "Keyboard",         n: "06" },
              { id: "system",     label: "System info",      n: "07" },
            ].map(s => (
              <div key={s.id} style={{
                padding: "8px 16px",
                background: s.on ? "var(--ink)" : "transparent",
                color: s.on ? "var(--paper)" : "var(--ink-2)",
                margin: "0 8px",
                borderRadius: 3,
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 12, cursor: "pointer",
              }}>
                <span className="mono" style={{ fontSize: 9, color: s.on ? "var(--ink-4)" : "var(--ink-4)" }}>{s.n}</span>
                <span style={{ fontWeight: s.on ? 600 : 400 }}>{s.label}</span>
              </div>
            ))}
          </aside>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>SETTINGS · 01 · PROVIDERS</div>
            <h1 className="serif" style={{ fontSize: 32, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 4 }}>
              Provider connections
            </h1>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, maxWidth: 720, lineHeight: 1.55 }}>
              Local CLI tools that agents call out to. Each provider runs as a subprocess on this machine; configure paths,
              models, and timeouts here. CEO model decisions resolve against the providers enabled below.
            </div>

            {/* Providers */}
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <ProviderCard
                id="codex_cli" name="Codex CLI" model="codex-1.4"
                path="/usr/local/bin/codex" defaultFor={["CEO","Manager","PMO"]}
                latency="142 ms" calls24h={1284} status="ok"
              />
              <ProviderCard
                id="claude_cli" name="Claude CLI" model="claude-sonnet-4-6"
                path="/usr/local/bin/claude" defaultFor={["Worker","UI Designer"]}
                latency="284 ms" calls24h={642} status="ok"
              />
              <ProviderCard
                id="gemini_cli" name="Gemini CLI" model="gemini-2.5-pro"
                path="/usr/local/bin/gemini" defaultFor={["QA"]}
                latency="312 ms" calls24h={184} status="ok"
              />
              <ProviderCard
                id="custom_cli" name="Custom CLI" model="—"
                path="(not configured)" defaultFor={[]}
                latency="—" calls24h={0} status="disabled"
              />
            </div>

            {/* Audit & retention preview */}
            <h2 className="serif" style={{ fontSize: 22, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 36 }}>
              Quick actions
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
              <ActionCard
                title="Default template" subtitle="team_local_full"
                meta="last edited 2 days ago" icon="user"
              />
              <ActionCard
                title="Skill catalog" subtitle="12 installed · 4 candidates"
                meta="3 updates available" icon="agent" badge="3"
              />
              <ActionCard
                title="Run retention" subtitle="Keep 90 days · auto-prune"
                meta="18.4 GB used of 50 GB" icon="log"
              />
            </div>

            {/* About */}
            <h2 className="serif" style={{ fontSize: 22, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 36 }}>
              About this installation
            </h2>
            <div style={{
              marginTop: 14, padding: 16,
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3,
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18,
            }}>
              {[
                ["VERSION",      "agent-refinement 2.0.4"],
                ["BACKEND",      "fastapi @ 127.0.0.1:8000"],
                ["DATA",         "~/.agent-refinement/"],
                ["UPTIME",       "4d 12h"],
                ["MCP",          "configured · 2 servers"],
                ["WORKTREES",    "3 active · 14 archived"],
                ["LICENSE",      "BSL · 1.1"],
                ["UPDATE CHANNEL","stable"],
              ].map(([l, v]) => (
                <div key={l}>
                  <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{l}</div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink)", marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
              <Btn variant="outline" icon="log">Open data directory</Btn>
              <Btn variant="outline" icon="terminal">Restart backend</Btn>
              <span style={{flex:1}}/>
              <Btn variant="ghost" icon="x">Sign out</Btn>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function ProviderCard({ id, name, model, path, defaultFor, latency, calls24h, status }) {
  const isOk = status === "ok";
  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${isOk ? "var(--border)" : "var(--border-2)"}`,
      borderLeft: `3px solid ${isOk ? "var(--ok)" : "var(--ink-4)"}`,
      borderRadius: 3,
      padding: 18,
      opacity: isOk ? 1 : 0.7,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, display: "grid", placeItems: "center",
          background: "var(--paper-2)", border: "1px solid var(--border)", borderRadius: 3,
          fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "var(--ink)",
        }}>{id === "custom_cli" ? "?" : id.slice(0,1).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{name}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{id}</span>
            <Pill tone={isOk ? "ok" : "neutral"}>{status === "ok" ? "CONNECTED" : "DISABLED"}</Pill>
            {isOk && <Pill tone="agent">{model}</Pill>}
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>
            {path}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant="outline" size="sm" icon="terminal">Test</Btn>
          <Btn variant="outline" size="sm" icon="gear">Edit</Btn>
          <Toggle on={isOk}/>
        </div>
      </div>

      {isOk && (
        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18,
        }}>
          <div>
            <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>DEFAULT FOR</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {defaultFor.map(r => (
                <span key={r} className="mono" style={{
                  fontSize: 10, padding: "1px 6px",
                  background: "var(--surface-2)", color: "var(--ink-2)",
                  border: "1px solid var(--border-2)", borderRadius: 2,
                }}>{r}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>P50 LATENCY</div>
            <div className="mono" style={{ fontSize: 13, color: "var(--ink)", marginTop: 4 }}>{latency}</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>CALLS · 24H</div>
            <div className="mono" style={{ fontSize: 13, color: "var(--ink)", marginTop: 4 }}>{calls24h.toLocaleString()}</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>HEALTH</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Dot tone="ok" size={6}/>
              <span className="mono" style={{ fontSize: 13, color: "var(--ok)" }}>healthy</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionCard({ title, subtitle, meta, icon, badge }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 3,
      padding: 16,
      cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 6,
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name={icon} size={14} color="var(--ink-2)"/>
        <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{title}</span>
        <span style={{flex:1}}/>
        {badge && <Pill tone="accent">{badge}</Pill>}
        <Icon name="chev" size={11} color="var(--ink-3)"/>
      </div>
      <div style={{ fontSize: 16, color: "var(--ink)", fontWeight: 500 }}>{subtitle}</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{meta}</div>
    </div>
  );
}

window.Settings = Settings;
