// Shared pure helpers for refinement screens (Workspace / Coding and successors).
// All functions here are side-effect free except downloadTextFile (browser download).
import type { ManagedRequestStatus, Template } from "../types";

export const statusTone = (
  status: ManagedRequestStatus,
): "neutral" | "ok" | "info" | "warn" =>
  status === "completed"
    ? "ok"
    : status === "running"
      ? "info"
      : status === "paused"
        ? "warn"
        : "neutral";

export const teamLabel = (template: Template) =>
  `${template.locked || template.is_builtin ? "Built-in" : "Custom"} · ${template.name}`;

export const codeContextToText = (items: string[]) => items.join("\n");

export const textToCodeContextItems = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

export const truncateText = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}\n...` : value;

export const sanitizeFileNamePart = (value: string) =>
  (value || "untitled")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "untitled";

export const markdownBlock = (value?: string, lang = "") => {
  const text = (value ?? "").trim();
  if (!text) return "_なし_";
  return `\`\`\`${lang}\n${text.replace(/```/g, "``\\`")}\n\`\`\``;
};

export const downloadTextFile = (fileName: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
