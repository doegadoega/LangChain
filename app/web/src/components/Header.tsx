import { ChevronDown, Cloud, Server } from "lucide-react";
import { useApp } from "../state/store";
import { StatusBadge } from "./ui/StatusBadge";
import clsx from "clsx";

export function Header() {
  const projects = useApp((s) => s.projects);
  const selectedProjectId = useApp((s) => s.selectedProjectId);
  const selectProject = useApp((s) => s.selectProject);
  const run = useApp((s) => s.run);

  const status =
    run.status === "running"
      ? "RUNNING"
      : run.status === "completed"
      ? "PASS"
      : run.status === "failed"
      ? "ESCALATE"
      : "IDLE";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      <div className="flex items-center gap-2">
        <ProjectPicker
          value={selectedProjectId}
          onChange={selectProject}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
        <span className="text-[var(--color-fg-subtle)]">/</span>
        <RunPicker />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <EnvBadge env="local" />
        <StatusBadge status={status as never} />
      </div>
    </header>
  );
}

function ProjectPicker({
  value,
  onChange,
  options,
}: {
  value?: string;
  onChange: (v?: string) => void;
  options: { value: string; label: string }[];
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="appearance-none rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] pl-3 pr-8 h-8 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
      >
        <option value="">{current?.label ?? "プロジェクト未選択"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-muted)]" />
    </div>
  );
}

function RunPicker() {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 h-8 text-xs text-[var(--color-fg-muted)]">
      <span className="font-mono">run-current</span>
      <ChevronDown className="h-3 w-3" />
    </div>
  );
}

function EnvBadge({ env }: { env: "local" | "aws" | "gcp" }) {
  const Icon = env === "local" ? Server : Cloud;
  const label = env.toUpperCase();
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-2 h-7 text-[10px] font-semibold tracking-widest uppercase",
        env === "local" && "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
        env === "aws" && "border-amber-500/40 text-amber-300 bg-amber-500/10",
        env === "gcp" && "border-sky-500/40 text-sky-300 bg-sky-500/10",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
