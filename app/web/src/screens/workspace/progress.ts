import type { RunState } from "../../state/store";
import type { StreamEvent } from "../../types";

export type ProgressStepId =
  | "received"
  | "understanding"
  | "planning"
  | "investigating"
  | "reviewing"
  | "finalizing"
  | "completed";

export interface ProgressStep {
  id: ProgressStepId;
  label: string;
  state: "done" | "active" | "waiting" | "failed";
}

export const PROGRESS_STEPS: { id: ProgressStepId; label: string }[] = [
  { id: "received", label: "依頼を受け付けました" },
  { id: "understanding", label: "依頼内容を整理しています" },
  { id: "planning", label: "作業計画を立てています" },
  { id: "investigating", label: "調査しています" },
  { id: "reviewing", label: "レビューしています" },
  { id: "finalizing", label: "最終回答を作っています" },
  { id: "completed", label: "完了しました" },
];

const stepIndexForRun = (run: RunState): number => {
  if (run.status === "failed") return Math.max(0, PROGRESS_STEPS.length - 2);
  if (run.status === "completed") return PROGRESS_STEPS.length - 1;
  if (run.events.some((event) => event.type === "run_completed")) return PROGRESS_STEPS.length - 1;
  if (run.events.some((event) => event.type === "round_completed")) return 5;
  if (run.events.some((event) => event.type === "turn_completed")) return 4;
  if (run.events.some((event) => event.type === "turn_started")) return 3;
  if (run.events.some((event) => event.type === "round_started")) return 2;
  if (run.events.some((event) => event.type === "run_started")) return 1;
  return 0;
};

export const getProgressSteps = (run: RunState): ProgressStep[] => {
  const activeIndex = stepIndexForRun(run);
  return PROGRESS_STEPS.map((step, index) => ({
    ...step,
    state:
      run.status === "failed" && index === activeIndex
        ? "failed"
        : index < activeIndex
          ? "done"
          : index === activeIndex && run.status !== "idle"
            ? "active"
            : "waiting",
  }));
};

export const describeEvent = (event: StreamEvent): string => {
  switch (event.type) {
    case "run_started":
      return "AIチームが依頼を受け取りました。";
    case "round_started":
      return `ラウンド ${event.round_index} の作業を開始しました。`;
    case "turn_started":
      return `${event.agent_name} が作業を始めました。`;
    case "turn_completed":
      return `${event.turn.agent_name} が作業結果を返しました。`;
    case "round_completed":
      return `ラウンド ${event.round_index} の見直しが完了しました。`;
    case "run_completed":
      return "AIチームの最終回答が完成しました。";
    case "run_failed":
      return `実行中に問題が起きました: ${event.error}`;
  }
};

export const getLiveNotes = (run: RunState): string[] => {
  if (run.events.length === 0) return ["依頼内容を入力して、AIチームに依頼してください。"];
  return run.events.slice(-8).map(describeEvent);
};
