import { useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  XCircle,
} from "lucide-react";

export type AlertKind = "info" | "warn" | "error" | "success";

interface Props {
  kind?: AlertKind;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  expandable?: { label?: string; detail: ReactNode };
  className?: string;
}

const ICONS: Record<AlertKind, ReactNode> = {
  info: <Info className="h-4 w-4" />,
  warn: <AlertTriangle className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
};

const TONE: Record<AlertKind, string> = {
  info: "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg)]",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  error: "border-red-500/40 bg-red-500/10 text-red-100",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
};

export function Alert({
  kind = "info",
  title,
  children,
  actions,
  expandable,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div
      role={kind === "error" || kind === "warn" ? "alert" : "status"}
      className={clsx("rounded-md border px-3 py-2", TONE[kind], className)}
      style={{ fontSize: "var(--text-sm)" }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0" aria-hidden>
          {ICONS[kind]}
        </span>
        <div className="min-w-0 flex-1">
          {title && <div className="font-semibold leading-snug">{title}</div>}
          {children && (
            <div
              className={clsx(title && "mt-1", "text-[var(--color-fg-muted)]")}
              style={{ fontSize: "var(--text-xs)" }}
            >
              {children}
            </div>
          )}
          {expandable && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              style={{ fontSize: "var(--text-xs)" }}
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expandable.label ?? "詳細"}
            </button>
          )}
          {expandable && open && (
            <pre
              className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[var(--color-fg)]"
              style={{ fontSize: "var(--text-code)" }}
            >
              {expandable.detail}
            </pre>
          )}
        </div>
        {actions && <div className="ml-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
