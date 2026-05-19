import clsx from "clsx";

type Variant = "text" | "card" | "list";

interface Props {
  variant?: Variant;
  lines?: number;
  className?: string;
}

export function Skeleton({ variant = "text", lines = 3, className }: Props) {
  if (variant === "card") {
    return (
      <div
        className={clsx(
          "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3",
          className,
        )}
        aria-busy="true"
        aria-live="polite"
      >
        <Bar widthClass="w-1/3" heightClass="h-3" />
        <div className="mt-2 space-y-1.5">
          {Array.from({ length: lines }).map((_, i) => (
            <Bar
              key={i}
              widthClass={i === lines - 1 ? "w-2/3" : "w-full"}
              heightClass="h-2.5"
            />
          ))}
        </div>
      </div>
    );
  }
  if (variant === "list") {
    return (
      <div className={clsx("space-y-1.5", className)} aria-busy="true" aria-live="polite">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5"
          >
            <Bar widthClass="w-2" heightClass="h-2" rounded />
            <Bar widthClass="w-1/2" heightClass="h-2.5" />
            <Bar widthClass="w-12" heightClass="h-2.5" className="ml-auto" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={clsx("space-y-1.5", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }).map((_, i) => (
        <Bar
          key={i}
          widthClass={i === lines - 1 ? "w-3/4" : "w-full"}
          heightClass="h-2.5"
        />
      ))}
    </div>
  );
}

function Bar({
  widthClass,
  heightClass,
  className,
  rounded = false,
}: {
  widthClass: string;
  heightClass: string;
  className?: string;
  rounded?: boolean;
}) {
  return (
    <div
      className={clsx(
        widthClass,
        heightClass,
        rounded ? "rounded-full" : "rounded",
        "animate-pulse bg-[var(--color-surface-3)]",
        className,
      )}
    />
  );
}
