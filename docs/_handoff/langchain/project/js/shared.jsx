// STRAND — shared primitives, brand mark, chrome (sidebar, topbar)

// ---------- Brand mark ----------
function StrandMark({ size = 24, color = "currentColor" }) {
  // A woven strand: three interlocking arcs. Hand-traced.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6 C 7 6, 9 18, 13 18 S 19 12, 21 12"
            stroke={color} strokeWidth="2.2" strokeLinecap="square" fill="none"/>
      <path d="M3 12 C 7 12, 9 6, 13 6 S 19 18, 21 18"
            stroke={color} strokeWidth="2.2" strokeLinecap="square" fill="none" opacity="0.55"/>
      <circle cx="21" cy="12" r="1.6" fill={color}/>
      <circle cx="3" cy="6" r="1.6" fill={color}/>
    </svg>
  );
}

function StrandWordmark({ size = 18 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)",
                   fontWeight: 600, fontSize: size, letterSpacing: "0.04em", color: "var(--ink)" }}>
      <StrandMark size={size + 4}/>
      <span>AGENT</span>
      <span style={{ color: "var(--accent)" }}>—</span>
      <span>REFINEMENT</span>
      <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>v2</span>
    </span>
  );
}

// ---------- Icons (line, 16) ----------
const Ic = {
  search:  <path d="M11 11l3 3M7 12.5A5.5 5.5 0 1 1 12.5 7 5.5 5.5 0 0 1 7 12.5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
  bell:    <path d="M5 11.5V9a3 3 0 0 1 6 0v2.5l1 1.5H4l1-1.5zM7 14h2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  plus:    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>,
  cmd:     <path d="M5 5h6v6H5zM5 5a1.5 1.5 0 1 1-1.5 1.5h0V5zM5 11a1.5 1.5 0 1 1-1.5-1.5h0V11zM11 5a1.5 1.5 0 1 0 1.5 1.5h0V5zM11 11a1.5 1.5 0 1 0 1.5-1.5h0V11z" stroke="currentColor" strokeWidth="1.2" fill="none"/>,
  repo:    <path d="M3 3h8a1 1 0 0 1 1 1v9H4a1 1 0 0 1-1-1V3zM3 11.5h9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  branch:  <path d="M5 3v10M5 7c0 2 6 0 6 4v2M5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM11 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  pr:      <path d="M4 4v9M12 4v6M4 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM4 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 4a2 2 0 0 0-2-2H8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  issue:   <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  issueDot:<g><circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" fill="none"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></g>,
  board:   <path d="M3 3h4v10H3zM9 3h4v6H9z" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  agent:   <path d="M8 2L10 6 14 7 11 10 12 14 8 12 4 14 5 10 2 7 6 6z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  play:    <path d="M5 3l7 5-7 5z" stroke="currentColor" strokeWidth="1.4" fill="currentColor"/>,
  pause:   <path d="M5 3h2v10H5zM9 3h2v10H9z" fill="currentColor"/>,
  stop:    <rect x="4" y="4" width="8" height="8" fill="currentColor"/>,
  check:   <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  x:       <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>,
  dot:     <circle cx="8" cy="8" r="3" fill="currentColor"/>,
  chev:    <path d="M5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  chevDn:  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  arrow:   <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  user:    <path d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  bolt:    <path d="M9 2L3 9h4l-1 5 6-7H8l1-5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  inbox:   <path d="M3 3v7h3l1 2h2l1-2h3V3zM3 10h10" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
  log:     <path d="M3 4h10M3 8h7M3 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>,
  doc:     <path d="M4 2h6l2 2v10H4zM10 2v3h2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  star:    <path d="M8 2l1.8 3.8L14 6.5l-3 2.9.7 4.2L8 11.8l-3.7 1.8L5 9.4 2 6.5l4.2-.7z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  gear:    <path d="M8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8 1v2M8 13v2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M1 8h2M13 8h2M3.5 12.5l1.5-1.5M11 5l1.5-1.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/>,
  more:    <g><circle cx="3.5" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="12.5" cy="8" r="1.2" fill="currentColor"/></g>,
  terminal:<path d="M2 3h12v10H2zM4 6l2 1.5L4 9M7 10h4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>,
  flame:   <path d="M8 1c0 3 4 4 4 8a4 4 0 1 1-8 0c0-2 2-2 2-4 0 2 2 2 2-4z" stroke="currentColor" strokeWidth="1.3" fill="none"/>,
  eye:     <path d="M1 8s2.5-4 7-4 7 4 7 4-2.5 4-7 4S1 8 1 8z" stroke="currentColor" strokeWidth="1.3" fill="none"/>,
  link:    <path d="M7 9l2-2M6 5a3 3 0 0 1 0 6h-1M10 11a3 3 0 0 0 0-6h1" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
};
function Icon({ name, size = 16, color }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" style={{ color }}>{Ic[name]}</svg>;
}

// ---------- Atoms ----------
function Pill({ children, tone = "neutral", filled = false, mono = true, style }) {
  const tones = {
    neutral: { fg: "var(--ink-2)", bg: "var(--surface-2)", bd: "var(--border)" },
    accent:  { fg: "var(--accent-deep)", bg: "var(--accent-soft)", bd: "var(--accent)" },
    ok:      { fg: "var(--ok)", bg: "var(--ok-bg)", bd: "var(--ok)" },
    warn:    { fg: "var(--warn)", bg: "var(--warn-bg)", bd: "var(--warn)" },
    danger:  { fg: "var(--danger)", bg: "var(--danger-bg)", bd: "var(--danger)" },
    info:    { fg: "var(--info)", bg: "var(--info-bg)", bd: "var(--info)" },
    agent:   { fg: "var(--agent-deep)", bg: "var(--agent-bg)", bd: "var(--agent)" },
    ink:     { fg: "var(--paper)", bg: "var(--ink)", bd: "var(--ink)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span className={mono ? "mono" : ""} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 6px",
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: filled ? "white" : t.fg,
      background: filled ? t.bd : t.bg,
      border: `1px solid ${filled ? t.bd : t.bd}`,
      borderRadius: 2,
      lineHeight: 1.5,
      ...style,
    }}>{children}</span>
  );
}

function Dot({ tone = "neutral", size = 7, style }) {
  const c = { neutral: "var(--ink-3)", ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)",
              info: "var(--info)", agent: "var(--agent)", accent: "var(--accent)" }[tone];
  return <span style={{ width: size, height: size, borderRadius: 99, background: c, display: "inline-block", ...style }}/>;
}

function Kbd({ children }) {
  return <span className="mono" style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 18, height: 18, padding: "0 4px",
    fontSize: 10,
    background: "var(--surface)",
    border: "1px solid var(--border-2)",
    borderBottomWidth: 2,
    borderRadius: 3,
    color: "var(--ink-2)",
  }}>{children}</span>;
}

function Btn({ children, variant = "ghost", tone = "neutral", icon, size = "md", style, ...rest }) {
  const sizes = { sm: { h: 24, px: 8, fs: 11 }, md: { h: 30, px: 12, fs: 12 }, lg: { h: 36, px: 14, fs: 13 } };
  const s = sizes[size];
  const base = {
    height: s.h, padding: `0 ${s.px}px`, fontSize: s.fs,
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 3, fontWeight: 500, letterSpacing: "0.01em",
    transition: "background 0.1s, border-color 0.1s",
  };
  const variants = {
    solid:   { background: tone === "accent" ? "var(--accent)" : "var(--ink)",
               color: tone === "accent" ? "var(--accent-ink)" : "var(--paper)",
               border: `1px solid ${tone === "accent" ? "var(--accent)" : "var(--ink)"}` },
    outline: { background: "var(--surface)", color: "var(--ink)",
               border: "1px solid var(--border-2)" },
    ghost:   { background: "transparent", color: "var(--ink-2)", border: "1px solid transparent" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {icon && <Icon name={icon} size={12}/>}
      {children}
    </button>
  );
}

function Avatar({ name = "?", color = "var(--accent)", size = 22, ai = false, src }) {
  const initials = name.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase();
  return (
    <span style={{
      width: size, height: size, borderRadius: ai ? 3 : 99,
      background: ai ? "var(--agent)" : color,
      color: "white",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 600, fontFamily: "var(--font-mono)",
      letterSpacing: 0, flexShrink: 0, position: "relative",
    }}>
      {ai ? <span style={{fontSize: size*0.5}}>※</span> : initials}
    </span>
  );
}

// ---------- Chrome ----------
// Top bar across all screens
function TopBar({ breadcrumb, density, theme, onCmd }) {
  return (
    <div className="mono" style={{
      height: 40, display: "flex", alignItems: "center",
      borderBottom: "1px solid var(--border)",
      background: "var(--paper-2)",
      padding: "0 14px", gap: 14, fontSize: 11,
      position: "relative", zIndex: 5,
    }}>
      <StrandMark size={16}/>
      <span style={{ color: "var(--ink-3)" }}>|</span>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {breadcrumb.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: "var(--ink-4)" }}>/</span>}
            <span style={{
              color: i === breadcrumb.length - 1 ? "var(--ink)" : "var(--ink-2)",
              fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
            }}>{b}</span>
          </React.Fragment>
        ))}
      </div>
      {/* Spacer */}
      <div style={{ flex: 1 }}/>
      {/* Search */}
      <button style={{
        display: "flex", alignItems: "center", gap: 8,
        height: 24, padding: "0 8px",
        background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 3,
        color: "var(--ink-3)", fontSize: 11, minWidth: 260,
        fontFamily: "var(--font-mono)",
      }}>
        <Icon name="search" size={11}/>
        <span style={{ flex: 1, textAlign: "left" }}>Jump to…</span>
        <Kbd>⌘</Kbd><Kbd>K</Kbd>
      </button>
      {/* Status pills */}
      <span style={{ color: "var(--ink-3)" }}>density:{density}</span>
      <span style={{ color: "var(--ink-3)" }}>theme:{theme}</span>
      <span style={{ display:"flex", alignItems:"center", gap: 6 }}>
        <Dot tone="ok" size={6}/><span style={{ color: "var(--ink-2)" }}>agents:3 idle</span>
      </span>
      <Icon name="bell" size={14} color="var(--ink-2)"/>
      <Avatar name="Yuki Sato" color="#2A6FBA" size={20}/>
    </div>
  );
}

// Left navigation sidebar — supports "expanded" / "rail"
function SideBar({ active, mode = "expanded" }) {
  const sections = [
    { label: "OVERVIEW", items: [
      { id: "dashboard",  label: "Dashboard",       icon: "board",     badge: null },
      { id: "execution",  label: "Execution",       icon: "eye",       badge: <Dot tone="agent" size={6}/> },
      { id: "qa",         label: "QA Gate",         icon: "check",     badge: "3" },
    ]},
    { label: "DESIGN", items: [
      { id: "team",       label: "Team Composer",   icon: "user",      badge: null },
      { id: "agents",     label: "Agent Studio",    icon: "agent",     badge: "12" },
      { id: "workflow",   label: "Workflow Editor", icon: "branch",    badge: null },
    ]},
    { label: "AUDIT", items: [
      { id: "logs",       label: "Logs & Artifacts",icon: "log",       badge: null },
      { id: "settings",   label: "Settings",        icon: "gear",      badge: null },
    ]},
    { label: "RECENT RUNS", items: [
      { id: "r-1284", label: "req_…_1284 · payment-flow", icon: "play", monoLabel: true },
      { id: "r-1283", label: "req_…_1283 · observatory",  icon: "play", monoLabel: true },
      { id: "r-1280", label: "req_…_1280 · skill-picker", icon: "play", monoLabel: true },
    ]},
  ];

  const isRail = mode === "rail";
  const width = isRail ? 56 : 232;

  return (
    <aside style={{
      width, flexShrink: 0,
      borderRight: "1px solid var(--border)",
      background: "var(--paper)",
      display: "flex", flexDirection: "column",
      fontSize: 12,
    }}>
      {/* New… */}
      <div style={{ padding: isRail ? "10px 8px" : "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <button style={{
          width: "100%", height: 30, display: "flex", alignItems: "center",
          justifyContent: isRail ? "center" : "flex-start",
          gap: 8, padding: isRail ? 0 : "0 10px",
          border: "1px solid var(--border-2)",
          background: "var(--surface)",
          borderRadius: 3, color: "var(--ink)", fontWeight: 500,
        }}>
          <Icon name="plus" size={12}/>
          {!isRail && <><span>New…</span><span style={{flex:1}}/><Kbd>N</Kbd></>}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {sections.map(sec => (
          <div key={sec.label} style={{ marginBottom: 12 }}>
            {!isRail && (
              <div className="mono" style={{
                padding: "4px 14px",
                fontSize: 9, letterSpacing: "0.12em",
                color: "var(--ink-3)", fontWeight: 500,
              }}>{sec.label}</div>
            )}
            {isRail && <div style={{height: 8}}/>}
            {sec.items.map(it => {
              const isActive = it.id === active;
              return (
                <div key={it.id} style={{
                  display: "flex", alignItems: "center",
                  height: 28,
                  margin: isRail ? "1px 6px" : "0 6px",
                  padding: isRail ? 0 : "0 8px",
                  borderRadius: 3,
                  background: isActive ? "var(--ink)" : "transparent",
                  color: isActive ? "var(--paper)" : "var(--ink-2)",
                  justifyContent: isRail ? "center" : "flex-start",
                  gap: 8, position: "relative",
                }}>
                  <Icon name={it.icon} size={13}/>
                  {!isRail && (
                    <>
                      <span style={{
                        flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        fontFamily: it.monoLabel ? "var(--font-mono)" : "inherit",
                        fontSize: it.monoLabel ? 10 : 12,
                        letterSpacing: it.monoLabel ? 0 : "-0.005em",
                      }}>{it.label}</span>
                      {it.badge && (
                        typeof it.badge === "string" ? (
                          <span className="mono" style={{
                            fontSize: 9, color: isActive ? "var(--paper)" : "var(--ink-3)",
                            opacity: 0.8,
                          }}>{it.badge}</span>
                        ) : it.badge
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer: terminal hint */}
      {!isRail && (
        <div style={{
          borderTop: "1px solid var(--border)",
          padding: "10px 14px",
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--ink-3)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <Icon name="terminal" size={11}/>
          <span>local · 127.0.0.1:8000</span>
          <span style={{ flex: 1 }}/>
          <Dot tone="ok" size={5}/>
        </div>
      )}
    </aside>
  );
}

// ---------- Generic card / panel ----------
function Panel({ title, action, children, style, padded = true, mono = true, accent }) {
  return (
    <section style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 4,
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      ...style,
    }}>
      {title && (
        <header style={{
          height: 32, padding: "0 12px",
          display: "flex", alignItems: "center", gap: 8,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          fontSize: 11, fontFamily: mono ? "var(--font-mono)" : "inherit",
          letterSpacing: mono ? "0.04em" : 0,
          textTransform: mono ? "uppercase" : "none",
          color: "var(--ink-2)", fontWeight: 500,
        }}>
          {accent && <span style={{width:6, height:6, background:accent, borderRadius:1}}/>}
          {title}
          <span style={{ flex: 1 }}/>
          {action}
        </header>
      )}
      <div style={{ padding: padded ? 14 : 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </section>
  );
}

// Tiny inline stat
function Stat({ label, value, delta, mono = true }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 60 }}>
      <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{
        fontSize: 22, fontWeight: 500, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.02em",
      }}>{value}</span>
      {delta && <span className="mono" style={{ fontSize: 10, color: delta.startsWith("+") ? "var(--ok)" : "var(--danger)" }}>{delta}</span>}
    </div>
  );
}

// Used to label sections inside artboards with a row number
function Hairline({ label, n }) {
  return (
    <div className="mono" style={{
      display: "flex", alignItems: "center", gap: 10,
      fontSize: 10, color: "var(--ink-3)",
      letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "8px 0",
    }}>
      {n != null && <span style={{ color: "var(--ink-4)" }}>{String(n).padStart(2, "0")}</span>}
      <span>{label}</span>
      <span style={{ flex: 1, borderTop: "1px dashed var(--border-2)" }}/>
    </div>
  );
}

Object.assign(window, {
  StrandMark, StrandWordmark, Icon, Pill, Dot, Kbd, Btn, Avatar,
  TopBar, SideBar, Panel, Stat, Hairline,
});
