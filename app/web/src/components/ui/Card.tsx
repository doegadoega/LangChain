import { type HTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={clsx(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm",
        className,
      )}
    />
  );
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={clsx(
        "flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3",
        className,
      )}
    />
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={clsx("p-4", className)} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...rest} className={clsx("text-sm font-semibold tracking-tight", className)} />;
}
