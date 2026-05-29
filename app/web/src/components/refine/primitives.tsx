// Shared presentational primitives for refinement screens (Workspace / Coding).
// Extracted verbatim; `required` and `spaced` props cover the per-screen variants.
import type { ReactNode } from "react";
import { fieldLabelStyle } from "../strand/formStyles";

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="mono" style={fieldLabelStyle}>
        {label}
        {required && <span style={{ color: "var(--accent-deep)", marginLeft: 4 }}>*</span>}
      </span>
      {children}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "24px 16px",
        textAlign: "center",
        border: "1px dashed var(--border-2)",
        borderRadius: 4,
        background: "var(--surface-2)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{title}</div>
      {description && <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{description}</div>}
    </div>
  );
}

export function InlineAlert({
  tone = "danger",
  spaced = false,
  children,
}: {
  tone?: "danger" | "info";
  spaced?: boolean;
  children: ReactNode;
}) {
  const palette =
    tone === "danger"
      ? { fg: "var(--danger)", bg: "var(--danger-bg)", bd: "var(--danger)" }
      : { fg: "var(--info)", bg: "var(--info-bg)", bd: "var(--info)" };
  return (
    <div
      style={{
        ...(spaced ? { marginTop: 8 } : null),
        borderRadius: 3,
        border: `1px solid ${palette.bd}`,
        background: palette.bg,
        color: palette.fg,
        padding: 8,
        fontSize: 11,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
      }}
    >
      {children}
    </div>
  );
}
