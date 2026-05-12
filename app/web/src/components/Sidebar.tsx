import {
  LayoutDashboard,
  Library,
  Database,
  Users,
  Bot,
  Play,
  PanelTop,
  Code2,
  ShieldCheck,
  ScrollText,
  Settings as SettingsIcon,
  Sparkles,
  MessageSquareMore,
} from "lucide-react";
import clsx from "clsx";
import { useApp } from "../state/store";
import type { ScreenId } from "../types";

const items: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }>; order: string }[] = [
  { id: "workspace", label: "Workspace", icon: PanelTop, order: "1" },
  { id: "coding", label: "Coding", icon: Code2, order: "2" },
  { id: "dashboard", label: "Runs", icon: LayoutDashboard, order: "3" },
  { id: "team", label: "Teams", icon: Users, order: "4" },
  { id: "agents", label: "Agent Studio", icon: Bot, order: "5" },
  { id: "skills", label: "スキル管理", icon: Library, order: "6" },
  { id: "knowledge", label: "Knowledge", icon: Database, order: "7" },
  { id: "settings", label: "Settings", icon: SettingsIcon, order: "8" },
  { id: "execution", label: "Advanced Run", icon: Play, order: "9" },
  { id: "logs", label: "Logs", icon: ScrollText, order: "10" },
  { id: "qa", label: "QA Gate", icon: ShieldCheck, order: "11" },
  { id: "chat", label: "相談チャット", icon: MessageSquareMore, order: "0" },
];

export function Sidebar() {
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-[var(--color-border)]">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">Agent Refinement</div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">V2 Platform</div>
        </div>
      </div>
      <nav className="flex-1 p-2">
        {items.map((it) => {
          const Icon = it.icon;
          const active = screen === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setScreen(it.id)}
              className={clsx(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[var(--color-surface-3)] text-[var(--color-fg)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[var(--color-accent)]" />
              )}
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{it.label}</span>
              <span className="text-[10px] tabular-nums text-[var(--color-fg-subtle)]">{it.order}</span>
            </button>
          );
        })}
      </nav>
      <div className="border-t border-[var(--color-border)] px-4 py-3 text-[10px] text-[var(--color-fg-subtle)]">
        Stage-Gate + PDCA · QA×3 強制
      </div>
    </aside>
  );
}
