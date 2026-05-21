// STRAND — shared primitives ported from the design handoff (shared.jsx).
// Inline-style based to stay pixel-faithful to the prototype.
import type { CSSProperties, ReactNode } from "react";

export type Tone =
  | "neutral"
  | "accent"
  | "ok"
  | "warn"
  | "danger"
  | "info"
  | "agent"
  | "ink";

// ---------- Brand mark ----------
export function StrandMark({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6 C 7 6, 9 18, 13 18 S 19 12, 21 12"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="square"
        fill="none"
      />
      <path
        d="M3 12 C 7 12, 9 6, 13 6 S 19 18, 21 18"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="square"
        fill="none"
        opacity="0.55"
      />
      <circle cx="21" cy="12" r="1.6" fill={color} />
      <circle cx="3" cy="6" r="1.6" fill={color} />
    </svg>
  );
}

export function StrandWordmark({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--strand-font-mono)",
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "0.04em",
        color: "var(--ink)",
      }}
    >
      <StrandMark size={size + 4} />
      <span>AGENT</span>
      <span style={{ color: "var(--accent)" }}>—</span>
      <span>REFINEMENT</span>
      <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>v2</span>
    </span>
  );
}

// ---------- Icons (line, 16) ----------
export type IconName =
  | "search" | "bell" | "plus" | "cmd" | "repo" | "branch" | "pr" | "issue"
  | "issueDot" | "board" | "agent" | "play" | "pause" | "stop" | "check"
  | "x" | "dot" | "chev" | "chevDn" | "arrow" | "user" | "bolt" | "inbox"
  | "log" | "doc" | "star" | "gear" | "more" | "terminal" | "flame" | "eye" | "link";

const Ic: Record<IconName, ReactNode> = {
  search: <path d="M11 11l3 3M7 12.5A5.5 5.5 0 1 1 12.5 7 5.5 5.5 0 0 1 7 12.5z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />,
  bell: <path d="M5 11.5V9a3 3 0 0 1 6 0v2.5l1 1.5H4l1-1.5zM7 14h2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />,
  plus: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
  cmd: <path d="M5 5h6v6H5zM5 5a1.5 1.5 0 1 1-1.5 1.5h0V5zM5 11a1.5 1.5 0 1 1-1.5-1.5h0V11zM11 5a1.5 1.5 0 1 0 1.5 1.5h0V5zM11 11a1.5 1.5 0 1 0 1.5-1.5h0V11z" stroke="currentColor" strokeWidth="1.2" fill="none" />,
  repo: <path d="M3 3h8a1 1 0 0 1 1 1v9H4a1 1 0 0 1-1-1V3zM3 11.5h9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />,
  branch: <path d="M5 3v10M5 7c0 2 6 0 6 4v2M5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM11 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" stroke="currentColor" strokeWidth="1.4" fill="none" />,
  pr: <path d="M4 4v9M12 4v6M4 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM4 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 4a2 2 0 0 0-2-2H8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />,
  issue: <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" fill="none" />,
  issueDot: <g><circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" fill="none" /><circle cx="8" cy="8" r="1.6" fill="currentColor" /></g>,
  board: <path d="M3 3h4v10H3zM9 3h4v6H9z" stroke="currentColor" strokeWidth="1.4" fill="none" />,
  agent: <path d="M8 2L10 6 14 7 11 10 12 14 8 12 4 14 5 10 2 7 6 6z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />,
  play: <path d="M5 3l7 5-7 5z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" />,
  pause: <path d="M5 3h2v10H5zM9 3h2v10H9z" fill="currentColor" />,
  stop: <rect x="4" y="4" width="8" height="8" fill="currentColor" />,
  check: <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  x: <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
  dot: <circle cx="8" cy="8" r="3" fill="currentColor" />,
  chev: <path d="M5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  chevDn: <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  arrow: <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  user: <path d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.4" fill="none" />,
  bolt: <path d="M9 2L3 9h4l-1 5 6-7H8l1-5z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />,
  inbox: <path d="M3 3v7h3l1 2h2l1-2h3V3zM3 10h10" stroke="currentColor" strokeWidth="1.4" fill="none" />,
  log: <path d="M3 4h10M3 8h7M3 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
  doc: <path d="M4 2h6l2 2v10H4zM10 2v3h2" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />,
  star: <path d="M8 2l1.8 3.8L14 6.5l-3 2.9.7 4.2L8 11.8l-3.7 1.8L5 9.4 2 6.5l4.2-.7z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />,
  gear: <path d="M8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8 1v2M8 13v2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M1 8h2M13 8h2M3.5 12.5l1.5-1.5M11 5l1.5-1.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />,
  more: <g><circle cx="3.5" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="12.5" cy="8" r="1.2" fill="currentColor" /></g>,
  terminal: <path d="M2 3h12v10H2zM4 6l2 1.5L4 9M7 10h4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />,
  flame: <path d="M8 1c0 3 4 4 4 8a4 4 0 1 1-8 0c0-2 2-2 2-4 0 2 2 2 2-4z" stroke="currentColor" strokeWidth="1.3" fill="none" />,
  eye: <path d="M1 8s2.5-4 7-4 7 4 7 4-2.5 4-7 4S1 8 1 8z" stroke="currentColor" strokeWidth="1.3" fill="none" />,
  link: <path d="M7 9l2-2M6 5a3 3 0 0 1 0 6h-1M10 11a3 3 0 0 0 0-6h1" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />,
};

export function Icon({ name, size = 16, color }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ color }}>
      {Ic[name]}
    </svg>
  );
}

// ---------- Atoms ----------
export function Pill({
  children,
  tone = "neutral",
  filled = false,
  mono = true,
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  filled?: boolean;
  mono?: boolean;
  style?: CSSProperties;
}) {
  const tones: Record<Tone, { fg: string; bg: string; bd: string }> = {
    neutral: { fg: "var(--ink-2)", bg: "var(--surface-2)", bd: "var(--border)" },
    accent: { fg: "var(--accent-deep)", bg: "var(--accent-soft)", bd: "var(--accent)" },
    ok: { fg: "var(--ok)", bg: "var(--ok-bg)", bd: "var(--ok)" },
    warn: { fg: "var(--warn)", bg: "var(--warn-bg)", bd: "var(--warn)" },
    danger: { fg: "var(--danger)", bg: "var(--danger-bg)", bd: "var(--danger)" },
    info: { fg: "var(--info)", bg: "var(--info-bg)", bd: "var(--info)" },
    agent: { fg: "var(--agent-deep)", bg: "var(--agent-bg)", bd: "var(--agent)" },
    ink: { fg: "var(--paper)", bg: "var(--ink)", bd: "var(--ink)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      className={mono ? "mono" : ""}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 6px",
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: filled ? "white" : t.fg,
        background: filled ? t.bd : t.bg,
        border: `1px solid ${t.bd}`,
        borderRadius: 2,
        lineHeight: 1.5,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral", size = 7, style }: { tone?: Tone; size?: number; style?: CSSProperties }) {
  const c =
    {
      neutral: "var(--ink-3)",
      ok: "var(--ok)",
      warn: "var(--warn)",
      danger: "var(--danger)",
      info: "var(--info)",
      agent: "var(--agent)",
      accent: "var(--accent)",
      ink: "var(--ink)",
    }[tone] ?? "var(--ink-3)";
  return <span style={{ width: size, height: size, borderRadius: 99, background: c, display: "inline-block", ...style }} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 4px",
        fontSize: 10,
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderBottomWidth: 2,
        borderRadius: 3,
        color: "var(--ink-2)",
      }}
    >
      {children}
    </span>
  );
}

export function Btn({
  children,
  variant = "ghost",
  tone = "neutral",
  icon,
  size = "md",
  style,
  ...rest
}: {
  children?: ReactNode;
  variant?: "solid" | "outline" | "ghost";
  tone?: "neutral" | "accent";
  icon?: IconName;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes = {
    sm: { h: 24, px: 8, fs: 11 },
    md: { h: 30, px: 12, fs: 12 },
    lg: { h: 36, px: 14, fs: 13 },
  } as const;
  const s = sizes[size];
  const base: CSSProperties = {
    height: s.h,
    padding: `0 ${s.px}px`,
    fontSize: s.fs,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 3,
    fontWeight: 500,
    letterSpacing: "0.01em",
    transition: "background 0.1s, border-color 0.1s",
  };
  const variants: Record<string, CSSProperties> = {
    solid: {
      background: tone === "accent" ? "var(--accent)" : "var(--ink)",
      color: tone === "accent" ? "var(--accent-ink)" : "var(--paper)",
      border: `1px solid ${tone === "accent" ? "var(--accent)" : "var(--ink)"}`,
    },
    outline: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-2)" },
    ghost: { background: "transparent", color: "var(--ink-2)", border: "1px solid transparent" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </button>
  );
}

export function Avatar({
  name = "?",
  color = "var(--accent)",
  size = 22,
  ai = false,
}: {
  name?: string;
  color?: string;
  size?: number;
  ai?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: ai ? 3 : 99,
        background: ai ? "var(--agent)" : color,
        color: "white",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 600,
        fontFamily: "var(--strand-font-mono)",
        letterSpacing: 0,
        flexShrink: 0,
        position: "relative",
      }}
    >
      {ai ? <span style={{ fontSize: size * 0.5 }}>※</span> : initials}
    </span>
  );
}

// ---------- Panel / Stat / Hairline ----------
export function Panel({
  title,
  action,
  children,
  style,
  padded = true,
  mono = true,
  accent,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  padded?: boolean;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {title && (
        <header
          style={{
            height: 32,
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
            fontSize: 11,
            fontFamily: mono ? "var(--strand-font-mono)" : "inherit",
            letterSpacing: mono ? "0.04em" : 0,
            textTransform: mono ? "uppercase" : "none",
            color: "var(--ink-2)",
            fontWeight: 500,
          }}
        >
          {accent && <span style={{ width: 6, height: 6, background: accent, borderRadius: 1 }} />}
          {title}
          <span style={{ flex: 1 }} />
          {action}
        </header>
      )}
      <div style={{ padding: padded ? 14 : 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </section>
  );
}

export function Stat({ label, value, delta, mono = true }: { label: string; value: ReactNode; delta?: string | null; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 60 }}>
      <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 22, fontWeight: 500, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value}
      </span>
      {delta && (
        <span className="mono" style={{ fontSize: 10, color: delta.startsWith("+") ? "var(--ok)" : "var(--danger)" }}>
          {delta}
        </span>
      )}
    </div>
  );
}

// ---------- Agent state chip ----------
export type AgentState = "running" | "waiting" | "paused" | "done" | "error" | "queued" | "idle";

export function StateChip({ state }: { state: AgentState }) {
  const map: Record<AgentState, { c: string; l: string }> = {
    running: { c: "var(--ok)", l: "RUN" },
    waiting: { c: "var(--warn)", l: "WAIT" },
    paused: { c: "var(--ink-3)", l: "PAUSE" },
    done: { c: "var(--info)", l: "DONE" },
    error: { c: "var(--danger)", l: "ERR" },
    queued: { c: "var(--ink-4)", l: "Q" },
    idle: { c: "var(--ink-4)", l: "IDLE" },
  };
  const s = map[state] ?? map.idle;
  return (
    <span
      className="mono"
      style={{
        width: 38,
        height: 16,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: state === "running" ? s.c : "transparent",
        color: state === "running" ? "white" : s.c,
        border: `1px solid ${s.c}`,
        borderRadius: 2,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {s.l}
    </span>
  );
}

// ---------- Role badge ----------
export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    CEO: { bg: "#14110D", fg: "#F4EFE3" },
    MANAGER: { bg: "#2B5BBA", fg: "white" },
    PMO: { bg: "#5B3FD9", fg: "white" },
    WORKER: { bg: "#FF5B1F", fg: "white" },
    QA: { bg: "#1E7A4A", fg: "white" },
    UI: { bg: "#A14BC4", fg: "white" },
    SYSTEM: { bg: "#A56A0E", fg: "white" },
    OPS: { bg: "#8A857A", fg: "white" },
    OTHER: { bg: "#8A857A", fg: "white" },
  };
  const c = map[role.toUpperCase()] || map.WORKER;
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1px 5px",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: c.fg,
        background: c.bg,
        borderRadius: 2,
        lineHeight: 1.5,
      }}
    >
      {role.toUpperCase()}
    </span>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      style={{
        width: 34,
        height: 18,
        borderRadius: 99,
        background: on ? "var(--ok)" : "var(--border-2)",
        position: "relative",
        transition: "background 0.12s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: 99,
          background: "white",
          transition: "left 0.12s",
          boxShadow: "0 1px 2px rgba(0,0,0,.25)",
        }}
      />
    </button>
  );
}

export function Hairline({ label, n }: { label: string; n?: number }) {
  return (
    <div
      className="mono"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 10,
        color: "var(--ink-3)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "8px 0",
      }}
    >
      {n != null && <span style={{ color: "var(--ink-4)" }}>{String(n).padStart(2, "0")}</span>}
      <span>{label}</span>
      <span style={{ flex: 1, borderTop: "1px dashed var(--border-2)" }} />
    </div>
  );
}
