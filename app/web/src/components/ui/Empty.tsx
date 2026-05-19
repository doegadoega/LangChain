import type { ReactNode } from "react";
import clsx from "clsx";
import { Inbox } from "lucide-react";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  dense?: boolean;
}

export function Empty({ icon, title, description, action, className, dense = false }: Props) {
  return (
    <div
      role="status"
      className={clsx(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] text-center text-[var(--color-fg-muted)]",
        dense ? "px-3 py-4 gap-1" : "px-6 py-10 gap-2",
        className,
      )}
    >
      <div className="text-[var(--color-fg-subtle)]" aria-hidden>
        {icon ?? <Inbox className={dense ? "h-4 w-4" : "h-6 w-6"} />}
      </div>
      <div
        className="font-medium text-[var(--color-fg)]"
        style={{ fontSize: dense ? "var(--text-sm)" : "var(--text-body)" }}
      >
        {title}
      </div>
      {description && (
        <div
          className="max-w-md text-balance"
          style={{ fontSize: "var(--text-xs)" }}
        >
          {description}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
