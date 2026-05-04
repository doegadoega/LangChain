import type { OrgRole, ProviderKind } from "../types";

export const ROLE_LABEL: Record<OrgRole, string> = {
  ceo: "CEO",
  manager: "Manager",
  worker: "Worker",
  pmo: "PMO",
  qa: "QA",
  ui_designer: "UI Designer",
  system_designer: "System Designer",
  ops_designer: "Ops Designer",
  other: "Other",
};

export const PROVIDER_LABEL: Record<ProviderKind, string> = {
  codex_cli: "Codex CLI",
  claude_cli: "Claude CLI",
  openai_api: "ChatGPT / OpenAI API",
  anthropic_api: "Claude API",
  gemini_cli: "Gemini CLI",
  ollama: "Ollama",
  lm_studio: "LM Studio",
  custom_cli: "Custom CLI",
};

export const ROLE_ACCENT: Record<OrgRole, string> = {
  ceo: "from-amber-500/20 to-amber-500/5 border-amber-500/40 text-amber-300",
  manager: "from-violet-500/20 to-violet-500/5 border-violet-500/40 text-violet-300",
  pmo: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/40 text-cyan-300",
  worker: "from-sky-500/20 to-sky-500/5 border-sky-500/40 text-sky-300",
  qa: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40 text-emerald-300",
  ui_designer: "from-pink-500/20 to-pink-500/5 border-pink-500/40 text-pink-300",
  system_designer: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/40 text-indigo-300",
  ops_designer: "from-orange-500/20 to-orange-500/5 border-orange-500/40 text-orange-300",
  other: "from-slate-500/20 to-slate-500/5 border-slate-500/40 text-slate-300",
};

export const formatTime = (ts?: number) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("ja-JP", { hour12: false });
};

export const formatDuration = (start?: number, end?: number) => {
  if (!start) return "—";
  const e = end ?? Date.now();
  const sec = Math.floor((e - start) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
};
