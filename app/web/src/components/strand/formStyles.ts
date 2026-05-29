// Shared STRAND form input styles.
// Extracted from Workspace / Coding / Execution so every screen renders inputs
// identically. All return a fresh object per call (no shared mutable state).
import type { CSSProperties } from "react";

export const inputStyle = (disabled = false): CSSProperties => ({
  width: "100%",
  height: 30,
  padding: "0 10px",
  border: "1px solid var(--border)",
  borderRadius: 3,
  background: disabled ? "var(--surface-2)" : "var(--surface)",
  color: disabled ? "var(--ink-3)" : "var(--ink)",
  fontSize: 12,
  outline: "none",
});

export const textareaStyle = (disabled = false): CSSProperties => ({
  width: "100%",
  padding: 10,
  border: "1px solid var(--border)",
  borderRadius: 3,
  background: disabled ? "var(--surface-2)" : "var(--surface)",
  color: disabled ? "var(--ink-3)" : "var(--ink)",
  fontSize: 12,
  fontFamily: "var(--strand-font-sans)",
  lineHeight: 1.5,
  resize: "vertical",
  outline: "none",
});

export const selectStyle = (disabled = false): CSSProperties => ({
  width: "100%",
  height: 30,
  padding: "0 8px",
  border: "1px solid var(--border)",
  borderRadius: 3,
  background: disabled ? "var(--surface-2)" : "var(--surface)",
  color: disabled ? "var(--ink-3)" : "var(--ink)",
  fontSize: 12,
  outline: "none",
});

export const fieldLabelStyle: CSSProperties = {
  fontSize: 9,
  color: "var(--ink-3)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 6,
  display: "block",
};
