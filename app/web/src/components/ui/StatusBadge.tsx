import clsx from "clsx";

export type Status = "PASS" | "REWORK" | "ESCALATE" | "RUNNING" | "IDLE";

const map: Record<Status, string> = {
  PASS: "bg-[color-mix(in_srgb,var(--color-status-pass)_18%,transparent)] text-[var(--color-status-pass)] border-[var(--color-status-pass)]/40",
  REWORK: "bg-[color-mix(in_srgb,var(--color-status-rework)_18%,transparent)] text-[var(--color-status-rework)] border-[var(--color-status-rework)]/40",
  ESCALATE: "bg-[color-mix(in_srgb,var(--color-status-escalate)_18%,transparent)] text-[var(--color-status-escalate)] border-[var(--color-status-escalate)]/40",
  RUNNING: "bg-[color-mix(in_srgb,var(--color-status-running)_18%,transparent)] text-[var(--color-status-running)] border-[var(--color-status-running)]/40",
  IDLE: "bg-[color-mix(in_srgb,var(--color-status-idle)_18%,transparent)] text-[var(--color-fg-muted)] border-[var(--color-border)]",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        map[status],
        className,
      )}
    >
      {status === "RUNNING" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {status}
    </span>
  );
}
