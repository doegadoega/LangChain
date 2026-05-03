import { X } from "lucide-react";
import clsx from "clsx";
import { useApp } from "../state/store";
import type { ReactNode } from "react";

export function Drawer({ title, children }: { title?: string; children?: ReactNode }) {
  const open = useApp((s) => s.drawerOpen);
  const setOpen = useApp((s) => s.setDrawerOpen);
  return (
    <aside
      className={clsx(
        "flex shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] transition-all overflow-hidden",
        open ? "w-96" : "w-0",
      )}
    >
      {open && (
        <>
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="text-sm font-semibold">{title ?? "詳細"}</div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </>
      )}
    </aside>
  );
}
