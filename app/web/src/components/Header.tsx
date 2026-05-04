import { Cloud, Server } from "lucide-react";
import { useApp } from "../state/store";
import { StatusBadge } from "./ui/StatusBadge";
import clsx from "clsx";

export function Header() {
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
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <EnvBadge env="local" />
        <StatusBadge status={status as never} />
      </div>
    </header>
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
