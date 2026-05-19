import type { PointerEvent as ReactPointerEvent } from "react";
import clsx from "clsx";

interface Props {
  axis: "x" | "y";
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /**
   * Called when the user presses Arrow keys with the handle focused. delta is
   * the signed pixel adjustment (positive = move handle right / down).
   */
  onAdjust?: (deltaPx: number) => void;
  step?: number;
}

export function ResizeHandle({ axis, label, onPointerDown, onAdjust, step = 8 }: Props) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onAdjust) return;
    const multiplier = event.shiftKey ? 4 : 1;
    if (axis === "x") {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onAdjust(-step * multiplier);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onAdjust(step * multiplier);
      }
    } else {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        onAdjust(-step * multiplier);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        onAdjust(step * multiplier);
      }
    }
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      tabIndex={onAdjust ? 0 : -1}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      className={clsx(
        "group relative z-10 shrink-0 transition-colors focus:outline-none",
        axis === "x"
          ? "w-1.5 cursor-col-resize hover:bg-[var(--color-accent)]/30 focus-visible:bg-[var(--color-accent)]/40"
          : "h-1.5 cursor-row-resize hover:bg-[var(--color-accent)]/30 focus-visible:bg-[var(--color-accent)]/40",
      )}
    >
      {/* Hairline */}
      <span
        aria-hidden
        className={clsx(
          "absolute bg-[var(--color-border)] group-hover:bg-[var(--color-border-strong)] transition-colors",
          axis === "x"
            ? "left-1/2 top-0 h-full w-px -translate-x-1/2"
            : "top-1/2 left-0 h-px w-full -translate-y-1/2",
        )}
      />
      {/* Grip indicator (visible on hover/focus) */}
      <span
        aria-hidden
        className={clsx(
          "absolute rounded-full bg-[var(--color-accent)] opacity-0 transition-opacity group-hover:opacity-80 group-focus-visible:opacity-100",
          axis === "x"
            ? "left-1/2 top-1/2 h-10 w-0.5 -translate-x-1/2 -translate-y-1/2"
            : "left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 -translate-y-1/2",
        )}
      />
    </div>
  );
}
