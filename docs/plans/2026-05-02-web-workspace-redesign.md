# Web Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a beginner-friendly Workspace screen where users can describe a request in plain Japanese, see an AI team actively working, and inspect detailed logs only when needed.

**Architecture:** Add a new `Workspace` screen under `app/web/src/screens` and make it the default screen. Keep existing Zustand store actions (`startRun`, `stopRun`, `resetRun`) and backend payload shape, but add small UI mapping helpers so beginner-facing labels map to `RefineRequest` fields internally.

**Tech Stack:** React 19, TypeScript strict mode, Vite, Tailwind CSS v4, Zustand, lucide-react.

---

## File Structure

- Create: `app/web/src/screens/workspace/requestPresets.ts`
  - Owns beginner-facing request templates and maps them to internal request patches.
- Create: `app/web/src/screens/workspace/progress.ts`
  - Owns translation from `RunState` / `StreamEvent` to human-readable progress steps and live notes.
- Create: `app/web/src/screens/Workspace.tsx`
  - Owns the three-pane Workspace UI: Request, Run, Inspect.
- Modify: `app/web/src/types.ts`
  - Add `"workspace"` to `ScreenId`.
- Modify: `app/web/src/state/store.ts`
  - Set default screen to `"workspace"`.
- Modify: `app/web/src/App.tsx`
  - Render `Workspace`.
- Modify: `app/web/src/components/Sidebar.tsx`
  - Put Workspace first and reduce beginner-hostile navigation.
- Modify: `app/web/src/components/Header.tsx`
  - Keep project/status controls, remove the second primary run button from the global header.

## Task 1: Add Request Presets

**Files:**
- Create: `app/web/src/screens/workspace/requestPresets.ts`

- [ ] **Step 1: Create preset helper**

Add this file:

```ts
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
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
cd app/web
npm run build
```

Expected: build still fails only if this new file has a TypeScript issue. If it fails, fix the exact TypeScript error before continuing.

## Task 2: Add Human Progress Mapping

**Files:**
- Create: `app/web/src/screens/workspace/progress.ts`
- Reads types from: `app/web/src/state/store.ts`, `app/web/src/types.ts`

- [ ] **Step 1: Create progress helper**

Add this file:

```ts
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
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
cd app/web
npm run build
```

Expected: TypeScript compiles, or reports only errors introduced by this file. Fix any introduced errors.

## Task 3: Build Workspace Screen

**Files:**
- Create: `app/web/src/screens/Workspace.tsx`
- Uses: `app/web/src/screens/workspace/requestPresets.ts`
- Uses: `app/web/src/screens/workspace/progress.ts`

- [ ] **Step 1: Create the Workspace component**

Add `app/web/src/screens/Workspace.tsx`:

```tsx
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Activity, ChevronDown, ClipboardList, FileDiff, Play, RefreshCcw, Square, Users } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
import { formatDuration } from "../lib/format";
import { useApp } from "../state/store";
import { applyPresetToRequest, getRequestPreset, REQUEST_PRESETS, type RequestPresetId } from "./workspace/requestPresets";
import { getLiveNotes, getProgressSteps } from "./workspace/progress";

export function Workspace() {
  const request = useApp((state) => state.request);
  const updateRequest = useApp((state) => state.updateRequest);
  const run = useApp((state) => state.run);
  const startRun = useApp((state) => state.startRun);
  const stopRun = useApp((state) => state.stopRun);
  const resetRun = useApp((state) => state.resetRun);
  const [presetId, setPresetId] = useState<RequestPresetId>("review");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"summary" | "events" | "payload">("summary");

  const preset = getRequestPreset(presetId);
  const enabledAgents = request.agents.filter((agent) => agent.enabled !== false);
  const progressSteps = getProgressSteps(run);
  const liveNotes = getLiveNotes(run);
  const canStart = request.source_text.trim().length > 0 && enabledAgents.length > 0;
  const missingReason = !request.source_text.trim()
    ? "依頼内容を入力してください"
    : enabledAgents.length === 0
      ? "AIチームが選ばれていません"
      : "";

  const requestPreview = useMemo(() => {
    const lines = [
      `依頼の種類: ${preset.label}`,
      request.objective ? `ほしい結果: ${request.objective}` : "",
      request.global_instruction ? `追加指示: ${request.global_instruction}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }, [preset.label, request.global_instruction, request.objective]);

  const selectPreset = (nextId: RequestPresetId) => {
    const nextPreset = getRequestPreset(nextId);
    setPresetId(nextId);
    updateRequest(applyPresetToRequest(request, nextPreset));
  };

  return (
    <div className="grid h-full grid-cols-[340px_minmax(0,1fr)_360px] gap-4 overflow-hidden p-4">
      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>あなたの依頼</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">専門用語なしで、AIチームに頼みたいことを書いてください。</p>
          </div>
          <ClipboardList className="h-4 w-4 text-[var(--color-fg-muted)]" />
        </CardHeader>
        <CardBody className="flex-1 space-y-4 overflow-y-auto">
          <div>
            <Label>1. 何をしたいですか？</Label>
            <div className="grid gap-2">
              {REQUEST_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectPreset(item.id)}
                  className={clsx(
                    "rounded-md border p-3 text-left transition-colors",
                    presetId === item.id
                      ? "border-[var(--color-accent)] bg-[var(--color-surface-3)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]",
                  )}
                >
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="mt-1 text-xs text-[var(--color-fg-muted)]">{item.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>2. 元になる内容を貼ってください</Label>
            <Textarea
              rows={8}
              value={request.source_text}
              placeholder="文章、相談内容、要件、エラー内容、コードの説明などを貼ってください。"
              className="font-sans"
              onChange={(event) => updateRequest({ source_text: event.target.value })}
            />
          </div>

          <div>
            <Label>3. どんな結果がほしいですか？</Label>
            <Select value={request.objective || preset.defaultObjective} onChange={(event) => updateRequest({ objective: event.target.value })}>
              <option value={preset.defaultObjective}>{preset.defaultObjective || "AIチームに任せる"}</option>
              {preset.resultOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>4. 誰に向けた内容ですか？</Label>
            <Input
              value={request.global_instruction}
              placeholder="例: 初心者向け、開発者向け、顧客向け"
              onChange={(event) => updateRequest({ global_instruction: event.target.value })}
            />
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            追加で伝えたいこと
            <ChevronDown className={clsx("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} />
          </button>
          {detailsOpen && (
            <div className="space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <Label>AIチームへの追加指示</Label>
              <Textarea
                rows={4}
                value={request.global_instruction}
                placeholder="口調、制約、必ず見てほしい観点など"
                className="font-sans"
                onChange={(event) => updateRequest({ global_instruction: event.target.value })}
              />
            </div>
          )}

          <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
            {run.status === "running" ? (
              <Button variant="danger" size="lg" className="w-full" onClick={stopRun}>
                <Square className="h-4 w-4" />
                停止する
              </Button>
            ) : (
              <Button variant="primary" size="lg" className="w-full" disabled={!canStart} onClick={startRun}>
                <Play className="h-4 w-4" />
                この内容でAIチームに依頼する
              </Button>
            )}
            {!canStart && <div className="text-xs text-amber-300">{missingReason}</div>}
            <Button variant="ghost" className="w-full" onClick={resetRun}>
              <RefreshCcw className="h-4 w-4" />
              実行結果をリセット
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>AIチームの作業</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">{enabledAgents.length}人のAIチーム · {formatDuration(run.startedAt, run.endedAt)}</p>
          </div>
          <Activity className="h-4 w-4 text-[var(--color-fg-muted)]" />
        </CardHeader>
        <CardBody className="flex-1 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {progressSteps.map((step) => (
              <div
                key={step.id}
                className={clsx(
                  "rounded-md border px-3 py-2 text-sm",
                  step.state === "done" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
                  step.state === "active" && "border-sky-500/40 bg-sky-500/10 text-sky-200",
                  step.state === "failed" && "border-red-500/40 bg-red-500/10 text-red-200",
                  step.state === "waiting" && "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]",
                )}
              >
                {step.label}
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">ライブメモ</h3>
            <div className="space-y-2">
              {liveNotes.map((note, index) => (
                <div key={`${note}-${index}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-fg-muted)]">
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <h3 className="mb-2 text-sm font-semibold">最終回答</h3>
            {run.finalText ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--color-fg)]">{run.finalText}</pre>
            ) : (
              <div className="text-sm text-[var(--color-fg-muted)]">実行が完了すると、ここに最終回答が表示されます。</div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>あとで解析</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">詳しく見たい人向けの情報です。</p>
          </div>
          <Users className="h-4 w-4 text-[var(--color-fg-muted)]" />
        </CardHeader>
        <CardBody className="flex-1 overflow-hidden">
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-md bg-[var(--color-surface-2)] p-1 text-xs">
            {(["summary", "events", "payload"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setInspectorTab(tab)}
                className={clsx("rounded px-2 py-1.5", inspectorTab === tab ? "bg-[var(--color-surface-3)] text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]")}
              >
                {tab === "summary" ? "概要" : tab === "events" ? "ログ" : "JSON"}
              </button>
            ))}
          </div>
          <div className="h-full overflow-y-auto text-sm">
            {inspectorTab === "summary" && (
              <div className="space-y-3">
                <Info label="依頼内容" value={requestPreview || "未設定"} />
                <Info label="AIチーム" value={`${enabledAgents.length}人が有効`} />
                <Info label="ターン数" value={`${run.turns.length}件`} />
                {run.diff && <Info label="変更点" value={run.diff} icon={<FileDiff className="h-3.5 w-3.5" />} />}
                {run.error && <Info label="エラー" value={run.error} />}
              </div>
            )}
            {inspectorTab === "events" && (
              <pre className="whitespace-pre-wrap rounded-md bg-[var(--color-surface-2)] p-3 font-mono text-xs text-[var(--color-fg-muted)]">
                {run.events.length ? JSON.stringify(run.events, null, 2) : "ログはまだありません。"}
              </pre>
            )}
            {inspectorTab === "payload" && (
              <pre className="whitespace-pre-wrap rounded-md bg-[var(--color-surface-2)] p-3 font-mono text-xs text-[var(--color-fg-muted)]">
                {JSON.stringify(request, null, 2)}
              </pre>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
        {icon}
        {label}
      </div>
      <div className="whitespace-pre-wrap text-sm text-[var(--color-fg)]">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
cd app/web
npm run build
```

Expected: TypeScript may report `React` namespace usage in `Info`. If so, add `import type { ReactNode } from "react";` and change `React.ReactNode` to `ReactNode`.

## Task 4: Wire Workspace Into The App

**Files:**
- Modify: `app/web/src/types.ts`
- Modify: `app/web/src/state/store.ts`
- Modify: `app/web/src/App.tsx`
- Modify: `app/web/src/components/Sidebar.tsx`

- [ ] **Step 1: Add screen type**

In `app/web/src/types.ts`, change `ScreenId` to include `workspace`:

```ts
export type ScreenId =
  | "workspace"
  | "dashboard"
  | "team"
  | "agents"
  | "execution"
  | "qa"
  | "logs"
  | "settings";
```

- [ ] **Step 2: Make Workspace default**

In `app/web/src/state/store.ts`, change:

```ts
screen: "execution",
```

to:

```ts
screen: "workspace",
```

- [ ] **Step 3: Render Workspace**

In `app/web/src/App.tsx`, add:

```ts
import { Workspace } from "./screens/Workspace";
```

Then add this before the existing screen branches:

```tsx
{screen === "workspace" && <Workspace />}
```

- [ ] **Step 4: Simplify sidebar order**

In `app/web/src/components/Sidebar.tsx`, import `PanelTop` from `lucide-react` and replace `items` with:

```ts
const items: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }>; order: string }[] = [
  { id: "workspace", label: "Workspace", icon: PanelTop, order: "1" },
  { id: "dashboard", label: "Runs", icon: LayoutDashboard, order: "2" },
  { id: "team", label: "Teams", icon: Users, order: "3" },
  { id: "agents", label: "Agent Studio", icon: Bot, order: "4" },
  { id: "settings", label: "Settings", icon: SettingsIcon, order: "5" },
  { id: "execution", label: "Advanced Run", icon: Play, order: "6" },
  { id: "logs", label: "Logs", icon: ScrollText, order: "7" },
  { id: "qa", label: "QA Gate", icon: ShieldCheck, order: "8" },
];
```

Keep `Advanced Run`, `Logs`, and `QA Gate` for now so no existing screen disappears during the first slice.

- [ ] **Step 5: Run build**

Run:

```bash
cd app/web
npm run build
```

Expected: build passes. If unused import errors appear in `Sidebar.tsx`, remove unused icons.

## Task 5: Remove Header Run Button Duplication

**Files:**
- Modify: `app/web/src/components/Header.tsx`

- [ ] **Step 1: Remove global run controls**

In `Header.tsx`, remove `Play`, `Square`, `Button`, `startRun`, and `stopRun` usage. Keep status and environment badges.

The right side should end as:

```tsx
<div className="flex items-center gap-2">
  <EnvBadge env="local" />
  <StatusBadge status={status as never} />
</div>
```

- [ ] **Step 2: Run build**

Run:

```bash
cd app/web
npm run build
```

Expected: build passes and no unused import errors remain.

## Task 6: Visual And Runtime Verification

**Files:**
- No required source edits unless verification finds defects.

- [ ] **Step 1: Build production assets**

Run:

```bash
cd app/web
npm run build
```

Expected: Vite writes assets to `app/static`.

- [ ] **Step 2: Verify backend serves the new app**

If backend is not running:

```bash
.venv/bin/uvicorn app.main:app --port 8000
```

Then verify:

```bash
curl -s http://127.0.0.1:8000/ | head
```

Expected: HTML includes `/static/assets/` links.

- [ ] **Step 3: Browser check**

Open:

```text
http://127.0.0.1:8000
```

Check:

- Workspace is the first screen.
- Left pane uses beginner-facing Japanese labels.
- Run button is disabled until source material is entered.
- Header no longer has a second primary run button.
- Right pane contains logs and JSON behind tabs.
- No obvious overlap at desktop width.

- [ ] **Step 4: Commit if requested**

Only commit if the user asks for it because this repo currently has many unrelated local changes.

Use:

```bash
git add app/web/src/screens/workspace/requestPresets.ts app/web/src/screens/workspace/progress.ts app/web/src/screens/Workspace.tsx app/web/src/types.ts app/web/src/state/store.ts app/web/src/App.tsx app/web/src/components/Sidebar.tsx app/web/src/components/Header.tsx docs/superpowers/specs/2026-05-02-web-workspace-redesign-design.md docs/superpowers/plans/2026-05-02-web-workspace-redesign.md .gitignore
git commit -m "feat: add beginner workspace web UI"
```

Expected: commit includes only the Workspace redesign files and docs.

## Self-Review

- Spec coverage: The plan covers beginner input, active-work progress, secondary analysis, Workspace default navigation, duplicate run controls, and build/browser verification.
- Placeholder scan: No `TBD` or `TODO` placeholders are used as plan content.
- Type consistency: New helpers use existing `RefineRequest`, `WorkflowMode`, `RunState`, and `StreamEvent` types. The plan keeps backend payload shape unchanged.
