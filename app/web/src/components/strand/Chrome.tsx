// STRAND — app chrome (TopBar + SideBar) wired to the real navigation store.
import type { ReactNode } from "react";
import { useApp } from "../../state/store";
import type { ScreenId } from "../../types";
import { Avatar, Dot, Icon, Kbd, StrandMark, type IconName } from "./primitives";

interface NavItem {
  id: ScreenId;
  label: string;
  icon: IconName;
  badge?: ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "board" },
      { id: "coding", label: "Execution", icon: "eye", badge: <Dot tone="agent" size={6} /> },
      { id: "qa", label: "QA Gate", icon: "check" },
    ],
  },
  {
    label: "WORK",
    items: [
      { id: "workspace", label: "Workspace", icon: "doc" },
      { id: "chat", label: "相談チャット", icon: "terminal" },
    ],
  },
  {
    label: "DESIGN",
    items: [
      { id: "team", label: "Team Composer", icon: "user" },
      { id: "agents", label: "Agent Studio", icon: "agent" },
      { id: "execution", label: "Advanced Run", icon: "branch" },
    ],
  },
  {
    label: "LIBRARY",
    items: [
      { id: "skills", label: "スキル管理", icon: "star" },
      { id: "knowledge", label: "Knowledge", icon: "inbox" },
    ],
  },
  {
    label: "AUDIT",
    items: [
      { id: "logs", label: "Logs & Artifacts", icon: "log" },
      { id: "settings", label: "Settings", icon: "gear" },
    ],
  },
];

/**
 * Shared STRAND app frame: TopBar + SideBar + a <main> region.
 * Screens render only their content; pass `mainStyle` to control the main
 * region (e.g. scroll vs flex column). Defaults to a scrolling paper surface.
 */
export function StrandShell({
  breadcrumb,
  children,
  mainStyle,
}: {
  breadcrumb: string[];
  children: ReactNode;
  mainStyle?: React.CSSProperties;
}) {
  return (
    <div className="strand" style={{ display: "flex", flexDirection: "column" }}>
      <TopBar breadcrumb={breadcrumb} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <SideBar />
        <main style={{ flex: 1, overflow: "auto", background: "var(--paper)", ...mainStyle }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function TopBar({ breadcrumb }: { breadcrumb: string[] }) {
  const theme = typeof document !== "undefined" ? document.documentElement.dataset.theme ?? "light" : "light";
  const density = typeof document !== "undefined" ? document.documentElement.dataset.density ?? "normal" : "normal";
  const runStatus = useApp((s) => s.run.status);
  return (
    <div
      className="mono"
      style={{
        height: 40,
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
        background: "var(--paper-2)",
        padding: "0 14px",
        gap: 14,
        fontSize: 11,
        position: "relative",
        zIndex: 5,
      }}
    >
      <StrandMark size={16} />
      <span style={{ color: "var(--ink-3)" }}>|</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {breadcrumb.map((b, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span style={{ color: "var(--ink-4)" }}>/</span>}
            <span
              style={{
                color: i === breadcrumb.length - 1 ? "var(--ink)" : "var(--ink-2)",
                fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
              }}
            >
              {b}
            </span>
          </span>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 24,
          padding: "0 8px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          color: "var(--ink-3)",
          fontSize: 11,
          minWidth: 260,
          fontFamily: "var(--strand-font-mono)",
        }}
      >
        <Icon name="search" size={11} />
        <span style={{ flex: 1, textAlign: "left" }}>Jump to…</span>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </button>
      <span style={{ color: "var(--ink-3)" }}>density:{density}</span>
      <span style={{ color: "var(--ink-3)" }}>theme:{theme}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Dot tone={runStatus === "running" ? "ok" : "neutral"} size={6} />
        <span style={{ color: "var(--ink-2)" }}>{runStatus === "running" ? "run active" : "idle"}</span>
      </span>
      <Icon name="bell" size={14} color="var(--ink-2)" />
      <Avatar name="Yuki Sato" color="#2A6FBA" size={20} />
    </div>
  );
}

export function SideBar({ mode = "expanded" }: { mode?: "expanded" | "rail" }) {
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);
  const isRail = mode === "rail";
  const width = isRail ? 56 : 232;

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--paper)",
        display: "flex",
        flexDirection: "column",
        fontSize: 12,
      }}
    >
      <div style={{ padding: isRail ? "10px 8px" : "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <button
          onClick={() => setScreen("coding")}
          style={{
            width: "100%",
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: isRail ? "center" : "flex-start",
            gap: 8,
            padding: isRail ? 0 : "0 10px",
            border: "1px solid var(--border-2)",
            background: "var(--surface)",
            borderRadius: 3,
            color: "var(--ink)",
            fontWeight: 500,
          }}
        >
          <Icon name="plus" size={12} />
          {!isRail && (
            <>
              <span>New…</span>
              <span style={{ flex: 1 }} />
              <Kbd>N</Kbd>
            </>
          )}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {SECTIONS.map((sec) => (
          <div key={sec.label} style={{ marginBottom: 12 }}>
            {!isRail ? (
              <div
                className="mono"
                style={{ padding: "4px 14px", fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-3)", fontWeight: 500 }}
              >
                {sec.label}
              </div>
            ) : (
              <div style={{ height: 8 }} />
            )}
            {sec.items.map((it) => {
              const isActive = it.id === screen;
              return (
                <button
                  key={it.id}
                  onClick={() => setScreen(it.id)}
                  title={isRail ? it.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: isRail ? "auto" : "calc(100% - 12px)",
                    height: 28,
                    margin: isRail ? "1px 6px" : "0 6px",
                    padding: isRail ? 0 : "0 8px",
                    borderRadius: 3,
                    background: isActive ? "var(--ink)" : "transparent",
                    color: isActive ? "var(--paper)" : "var(--ink-2)",
                    justifyContent: isRail ? "center" : "flex-start",
                    gap: 8,
                    position: "relative",
                  }}
                >
                  <Icon name={it.icon} size={13} />
                  {!isRail && (
                    <>
                      <span
                        style={{
                          flex: 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          textAlign: "left",
                          fontSize: 12,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        {it.label}
                      </span>
                      {it.badge}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!isRail && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "10px 14px",
            fontFamily: "var(--strand-font-mono)",
            fontSize: 10,
            color: "var(--ink-3)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="terminal" size={11} />
          <span>local · 127.0.0.1:8000</span>
          <span style={{ flex: 1 }} />
          <Dot tone="ok" size={5} />
        </div>
      )}
    </aside>
  );
}
