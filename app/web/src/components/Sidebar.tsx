import { useEffect, useState } from "react";
import {
  Bot,
  ChevronsLeft,
  ChevronsRight,
  Code2,
  Database,
  LayoutDashboard,
  Library,
  MessageSquareMore,
  PanelTop,
  Play,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { useApp } from "../state/store";
import type { ScreenId } from "../types";

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "work",
    label: "Work",
    items: [
      { id: "workspace", label: "Workspace", icon: PanelTop },
      { id: "coding", label: "Coding", icon: Code2 },
      { id: "dashboard", label: "Runs", icon: LayoutDashboard },
      { id: "chat", label: "相談チャット", icon: MessageSquareMore },
    ],
  },
  {
    id: "build",
    label: "Build",
    items: [
      { id: "team", label: "Teams", icon: Users },
      { id: "agents", label: "Agent Studio", icon: Bot },
      { id: "execution", label: "Advanced Run", icon: Play },
    ],
  },
  {
    id: "library",
    label: "Library",
    items: [
      { id: "skills", label: "スキル管理", icon: Library },
      { id: "knowledge", label: "Knowledge", icon: Database },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { id: "logs", label: "Logs", icon: ScrollText },
      { id: "qa", label: "QA Gate", icon: ShieldCheck },
      { id: "settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

const STORAGE_KEY = "agent-refinement.sidebarCollapsed";

export function Sidebar() {
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);
  const runStatus = useApp((s) => s.run.status);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <aside
      className={clsx(
        "flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-150",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={clsx(
          "flex items-center gap-2 border-b border-[var(--color-border)] py-3",
          collapsed ? "px-3 justify-center" : "px-4",
        )}
      >
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div
              className="font-semibold leading-tight text-[var(--color-fg)]"
              style={{ fontSize: "var(--text-sm)" }}
            >
              Agent Refinement
            </div>
            <div
              className="uppercase tracking-widest text-[var(--color-fg-subtle)]"
              style={{ fontSize: "var(--text-xs)" }}
            >
              V2 Platform
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            aria-label="サイドバーを折りたたむ"
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-1 py-2">
        {collapsed ? (
          <button
            type="button"
            aria-label="サイドバーを展開"
            onClick={() => setCollapsed(false)}
            className="mb-2 flex w-full justify-center rounded p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        ) : null}

        {NAV_GROUPS.map((group, index) => (
          <div key={group.id} className={clsx(index > 0 && "mt-3")}>
            {!collapsed && (
              <div
                className="flex items-center justify-between px-3 pb-1 pt-2 uppercase tracking-wider text-[var(--color-fg-subtle)]"
                style={{ fontSize: "var(--text-xs)" }}
              >
                <span>{group.label}</span>
                {group.id === "work" && runStatus === "running" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-status-running)]/20 px-1.5 py-0.5 text-[var(--color-status-running)]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-status-running)]" />
                    running
                  </span>
                )}
              </div>
            )}
            {group.items.map((it) => {
              const Icon = it.icon;
              const active = screen === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setScreen(it.id)}
                  title={collapsed ? it.label : undefined}
                  aria-label={collapsed ? it.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "group relative flex w-full items-center gap-3 rounded-md transition-colors",
                    collapsed ? "justify-center px-2 py-2" : "px-3 py-1.5",
                    active
                      ? "bg-[var(--color-surface-3)] text-[var(--color-fg)]"
                      : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]",
                  )}
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[var(--color-accent)]" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="flex-1 text-left">{it.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        className={clsx(
          "border-t border-[var(--color-border)] py-2 text-[var(--color-fg-subtle)]",
          collapsed ? "px-2 text-center" : "px-4",
        )}
        style={{ fontSize: "var(--text-xs)" }}
      >
        {collapsed ? "v2" : "Stage-Gate + PDCA · QA×3 強制"}
      </div>
    </aside>
  );
}
