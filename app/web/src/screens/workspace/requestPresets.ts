import type { RefineRequest, WorkflowMode } from "../../types";

export type RequestPresetId =
  | "improve_writing"
  | "organize_ideas"
  | "review"
  | "implementation"
  | "fix_code"
  | "custom";

export interface RequestPreset {
  id: RequestPresetId;
  label: string;
  description: string;
  workflowMode: WorkflowMode;
  defaultObjective: string;
  defaultInstruction: string;
  resultOptions: string[];
}

export const REQUEST_PRESETS: RequestPreset[] = [
  {
    id: "improve_writing",
    label: "文章をよくしたい",
    description: "文章を読みやすく、伝わりやすく整えます。",
    workflowMode: "writing",
    defaultObjective: "文章を読みやすく改善する",
    defaultInstruction: "読み手に伝わりやすい自然な日本語にしてください。",
    resultOptions: ["短くする", "丁寧にする", "説得力を上げる", "構成を直す"],
  },
  {
    id: "organize_ideas",
    label: "アイデアを整理したい",
    description: "散らばった考えを論点、順序、次の行動に整理します。",
    workflowMode: "writing",
    defaultObjective: "アイデアを整理して次に進める形にする",
    defaultInstruction: "論点、優先順位、次の行動がわかる形に整理してください。",
    resultOptions: ["箇条書きにする", "計画にする", "論点を分ける", "結論を出す"],
  },
  {
    id: "review",
    label: "レビューしてほしい",
    description: "文章、設計、実装方針の問題点と改善案を出します。",
    workflowMode: "writing",
    defaultObjective: "問題点と改善案をレビューする",
    defaultInstruction: "重大な問題、改善案、優先順位を分けてください。",
    resultOptions: ["問題点を出す", "改善案を出す", "リスクを見る", "優先順位を付ける"],
  },
  {
    id: "implementation",
    label: "実装方法を相談したい",
    description: "作りたい機能を実装できる手順に分解します。",
    workflowMode: "coding",
    defaultObjective: "実装方針と作業手順を作る",
    defaultInstruction: "実装方針、対象ファイル、テスト方針を具体化してください。",
    resultOptions: ["実装計画にする", "設計を見直す", "タスクに分ける", "テスト方針を出す"],
  },
  {
    id: "fix_code",
    label: "コードを直したい",
    description: "不具合や改善したいコードを調査し、修正方針を出します。",
    workflowMode: "coding",
    defaultObjective: "コードの問題を調査して修正案を出す",
    defaultInstruction: "原因、修正方針、確認方法を分けて説明してください。",
    resultOptions: ["原因を調べる", "修正案を出す", "テストを考える", "差分を確認する"],
  },
  {
    id: "custom",
    label: "自由に依頼する",
    description: "自由な相談内容を AI チームに依頼します。",
    workflowMode: "writing",
    defaultObjective: "",
    defaultInstruction: "",
    resultOptions: ["わかりやすくする", "整理する", "提案する", "レビューする"],
  },
];

export const getRequestPreset = (id: RequestPresetId): RequestPreset =>
  REQUEST_PRESETS.find((preset) => preset.id === id) ?? REQUEST_PRESETS[0];

export const applyPresetToRequest = (
  request: RefineRequest,
  preset: RequestPreset,
): Pick<RefineRequest, "workflow_mode" | "objective" | "global_instruction" | "code_context"> => ({
  workflow_mode: preset.workflowMode,
  objective: request.objective || preset.defaultObjective,
  global_instruction: request.global_instruction || preset.defaultInstruction,
  code_context: request.code_context,
});
