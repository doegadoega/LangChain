import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  ClipboardList,
  FileDiff,
  Loader2,
  MessageSquareText,
  Play,
  RefreshCcw,
  Square,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
import { formatDuration } from "../lib/format";
import { api } from "../api/client";
import { useApp } from "../state/store";
import type {
  AgentConfig,
  ManagedRequest,
  ManagedRequestStatus,
  TurnResult,
  VerificationFeedback,
} from "../types";
import type { StreamEvent } from "../types";
import {
  REQUEST_PRESETS,
  applyPresetToRequest,
  getRequestPreset,
  type RequestPresetId,
} from "./workspace/requestPresets";
import { getLiveNotes, getProgressSteps } from "./workspace/progress";

const STATUS_LABEL: Record<ManagedRequestStatus, string> = {
  draft: "下書き",
  running: "実行中",
  completed: "完了",
  paused: "保留",
};

const FEEDBACK_LABEL: Record<VerificationFeedback["kind"], string> = {
  more_detail: "もっと詳しく",
  change_direction: "方向を変えたい",
  fix_request: "修正してほしい",
  approved: "これでOK",
};

export function Workspace() {
  const request = useApp((state) => state.request);
  const updateRequest = useApp((state) => state.updateRequest);
  const run = useApp((state) => state.run);
  const startRun = useApp((state) => state.startRun);
  const stopRun = useApp((state) => state.stopRun);
  const resetRun = useApp((state) => state.resetRun);
  const [presetId, setPresetId] = useState<RequestPresetId>("review");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inspectorTab, setInspectorTab] =
    useState<"summary" | "conversation" | "events" | "payload">("summary");
  const [managedRequests, setManagedRequests] = useState<ManagedRequest[]>([]);
  const [selectedManagedRequestId, setSelectedManagedRequestId] = useState<string | undefined>();
  const [requestTitle, setRequestTitle] = useState("");
  const [requestStatus, setRequestStatus] = useState<ManagedRequestStatus>("draft");
  const [saveMessage, setSaveMessage] = useState("");
  const [feedbackKind, setFeedbackKind] =
    useState<VerificationFeedback["kind"]>("fix_request");
  const [feedbackText, setFeedbackText] = useState("");
  const [verificationFeedback, setVerificationFeedback] = useState<VerificationFeedback[]>([]);

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

  useEffect(() => {
    void api.listRequests().then(setManagedRequests).catch(() => setManagedRequests([]));
  }, []);

  const selectPreset = (nextId: RequestPresetId) => {
    const nextPreset = getRequestPreset(nextId);
    setPresetId(nextId);
    updateRequest(applyPresetToRequest(request, nextPreset));
  };

  const resetManagedRequest = () => {
    setSelectedManagedRequestId(undefined);
    setRequestTitle("");
    setRequestStatus("draft");
    setSaveMessage("新しい依頼を作成中です。");
  };

  const saveManagedRequest = async () => {
    const now = new Date().toISOString();
    const fallbackTitle = request.source_text.trim().split("\n")[0]?.slice(0, 40) || preset.label;
    const existing = managedRequests.find((item) => item.id === selectedManagedRequestId);
    const record: ManagedRequest = {
      id: existing?.id ?? `req_${Date.now().toString(36)}`,
      title: requestTitle.trim() || fallbackTitle,
      status: run.status === "running" ? "running" : run.status === "completed" ? "completed" : requestStatus,
      request,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      last_run_at: run.startedAt ? new Date(run.startedAt).toISOString() : existing?.last_run_at,
      run_started_at: run.startedAt ? new Date(run.startedAt).toISOString() : existing?.run_started_at,
      run_ended_at: run.endedAt ? new Date(run.endedAt).toISOString() : existing?.run_ended_at,
      final_text: run.finalText ?? existing?.final_text,
      diff: run.diff ?? existing?.diff,
      file_changes: run.fileChanges ?? existing?.file_changes,
      agent_turns: run.turns.length > 0 ? run.turns : existing?.agent_turns,
      stream_events: run.events.length > 0 ? run.events : existing?.stream_events,
      verification_feedback: verificationFeedback.length > 0
        ? verificationFeedback
        : existing?.verification_feedback,
    };
    const saved = existing
      ? await api.updateRequest(record.id, record)
      : await api.createRequest(record);
    setSelectedManagedRequestId(saved.id);
    setRequestTitle(saved.title);
    setRequestStatus(saved.status);
    setManagedRequests((items) => {
      const others = items.filter((item) => item.id !== saved.id);
      return [saved, ...others].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    });
    setSaveMessage("依頼を保存しました。");
  };

  const loadManagedRequest = (item: ManagedRequest) => {
    setSelectedManagedRequestId(item.id);
    setRequestTitle(item.title);
    setRequestStatus(item.status);
    setVerificationFeedback(item.verification_feedback ?? []);
    setFeedbackText("");
    updateRequest(item.request);
    setSaveMessage("保存済みの依頼を読み込みました。");
  };

  const addVerificationFeedback = async () => {
    const comment = feedbackText.trim();
    if (!comment) {
      setSaveMessage("フィードバック内容を入力してください。");
      return undefined;
    }
    const nextFeedback: VerificationFeedback = {
      id: `fb_${Date.now().toString(36)}`,
      kind: feedbackKind,
      comment,
      created_at: new Date().toISOString(),
    };
    const nextFeedbackList = [nextFeedback, ...verificationFeedback];
    setVerificationFeedback(nextFeedbackList);
    setFeedbackText("");
    setSaveMessage("フィードバックを追加しました。保存すると依頼に残ります。");
    return { feedback: nextFeedback, feedbackList: nextFeedbackList };
  };

  const restartDiscussionWithFeedback = async () => {
    if (run.status === "running") {
      setSaveMessage("実行中です。停止してからフィードバックを反映してください。");
      return;
    }
    const result = await addVerificationFeedback();
    if (!result) return;

    const nextRequest = {
      ...request,
      objective:
        "追加フィードバックを反映し、AIチームでもう一度議論して改善案を出す。",
      source_text: buildFeedbackContinuationSource({
        originalSource: request.source_text,
        finalText: run.finalText,
        feedback: result.feedback,
      }),
    };
    updateRequest(nextRequest);
    setSaveMessage("フィードバックを反映して、AIチームの議論を再開します。");
    await startRun();
  };

  return (
    <div className="grid h-full grid-cols-[minmax(300px,340px)_minmax(360px,1fr)_minmax(300px,360px)] gap-4 overflow-hidden p-4">
      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>あなたの依頼</CardTitle>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-fg-muted)]">
              専門用語なしで、AIチームに頼みたいことを書いてください。
            </p>
          </div>
          <ClipboardList className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
        </CardHeader>
        <CardBody className="flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">依頼管理</div>
                <div className="text-xs text-[var(--color-fg-muted)]">
                  依頼を保存して、あとから開けます。
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={resetManagedRequest}>
                新規
              </Button>
            </div>
            <div>
              <Label>依頼タイトル</Label>
              <Input
                value={requestTitle}
                placeholder="例: ログイン画面のレビュー"
                onChange={(event) => setRequestTitle(event.target.value)}
              />
            </div>
            <div>
              <Label>状態</Label>
              <Select
                value={requestStatus}
                onChange={(event) => setRequestStatus(event.target.value as ManagedRequestStatus)}
              >
                <option value="draft">下書き</option>
                <option value="running">実行中</option>
                <option value="completed">完了</option>
                <option value="paused">保留</option>
              </Select>
            </div>
            <Button variant="primary" className="w-full" onClick={() => void saveManagedRequest()}>
              保存する
            </Button>
            {saveMessage && <div className="text-xs text-[var(--color-fg-muted)]">{saveMessage}</div>}
            <div className="max-h-44 space-y-2 overflow-y-auto border-t border-[var(--color-border)] pt-3">
              {managedRequests.length === 0 && (
                <div className="text-xs text-[var(--color-fg-subtle)]">保存済み依頼はありません。</div>
              )}
              {managedRequests.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadManagedRequest(item)}
                  className={clsx(
                    "w-full rounded-md border p-2 text-left transition-colors",
                    selectedManagedRequestId === item.id
                      ? "border-[var(--color-accent)] bg-[var(--color-surface-3)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]",
                  )}
                >
                  <div className="truncate text-xs font-semibold">{item.title}</div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--color-fg-subtle)]">
                    <span>{STATUS_LABEL[item.status] ?? item.status}</span>
                    <span>{new Date(item.updated_at).toLocaleDateString("ja-JP")}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

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
                  <div className="mt-1 text-xs leading-relaxed text-[var(--color-fg-muted)]">
                    {item.description}
                  </div>
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
            <Select
              value={request.objective || preset.defaultObjective}
              onChange={(event) => updateRequest({ objective: event.target.value })}
            >
              <option value={preset.defaultObjective}>
                {preset.defaultObjective || "AIチームに任せる"}
              </option>
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
            <ChevronDown
              className={clsx("h-4 w-4 transition-transform", detailsOpen && "rotate-180")}
            />
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
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={!canStart}
                onClick={startRun}
              >
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
          <div className="min-w-0">
            <CardTitle>AIチームの作業</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              {enabledAgents.length}人のAIチーム · {formatDuration(run.startedAt, run.endedAt)}
            </p>
          </div>
          <Activity className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
        </CardHeader>
        <CardBody className="flex-1 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {progressSteps.map((step) => (
              <div
                key={step.id}
                className={clsx(
                  "flex min-h-10 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm",
                  step.state === "done" &&
                    "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
                  step.state === "active" &&
                    "border-sky-500/40 bg-sky-500/10 text-sky-200",
                  step.state === "failed" && "border-red-500/40 bg-red-500/10 text-red-200",
                  step.state === "waiting" &&
                    "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]",
                )}
              >
                <span className="min-w-0 truncate">{step.label}</span>
                {step.state === "active" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-200" />
                )}
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">ライブメモ</h3>
            <div className="space-y-2">
              {liveNotes.map((note, index) => (
                <div
                  key={`${note}-${index}`}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm leading-relaxed text-[var(--color-fg-muted)]"
                >
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">AIチームの会話</h3>
            <Conversation agents={enabledAgents} turns={run.turns} events={run.events} compact />
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <h3 className="mb-2 text-sm font-semibold">最終回答</h3>
            {run.finalText ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--color-fg)]">
                {run.finalText}
              </pre>
            ) : (
              <div className="text-sm text-[var(--color-fg-muted)]">
                実行が完了すると、ここに最終回答が表示されます。
              </div>
            )}
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <h3 className="mb-2 text-sm font-semibold">検証内容へのフィードバック</h3>
            <p className="mb-3 text-xs leading-relaxed text-[var(--color-fg-muted)]">
              QAや検証結果を見て、もっとこうしてほしい点を残せます。依頼を保存すると一緒にバックエンドへ保存されます。
            </p>
            <div className="grid gap-3">
              <div>
                <Label>フィードバック種別</Label>
                <Select
                  value={feedbackKind}
                  onChange={(event) =>
                    setFeedbackKind(event.target.value as VerificationFeedback["kind"])
                  }
                >
                  <option value="fix_request">修正してほしい</option>
                  <option value="more_detail">もっと詳しく</option>
                  <option value="change_direction">方向を変えたい</option>
                  <option value="approved">これでOK</option>
                </Select>
              </div>
              <div>
                <Label>内容</Label>
                <Textarea
                  rows={4}
                  className="font-sans"
                  value={feedbackText}
                  placeholder="例: 検証観点にセキュリティも追加してほしい / もっと初心者向けに説明してほしい"
                  onChange={(event) => setFeedbackText(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  disabled={run.status === "running"}
                  onClick={() => void restartDiscussionWithFeedback()}
                >
                  追加して議論を再開
                </Button>
                <Button variant="primary" onClick={() => void addVerificationFeedback()}>
                  メモだけ追加
                </Button>
                <Button variant="outline" onClick={() => void saveManagedRequest()}>
                  依頼に保存
                </Button>
              </div>
              <FeedbackList items={verificationFeedback} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>あとで解析</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              詳しく見たい人向けの情報です。
            </p>
          </div>
          <Users className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
        </CardHeader>
        <CardBody className="flex-1 overflow-hidden">
          <div className="mb-3 grid grid-cols-4 gap-1 rounded-md bg-[var(--color-surface-2)] p-1 text-xs">
            {(["summary", "conversation", "events", "payload"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setInspectorTab(tab)}
                className={clsx(
                  "rounded px-2 py-1.5",
                  inspectorTab === tab
                    ? "bg-[var(--color-surface-3)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg-muted)]",
                )}
              >
                {tab === "summary"
                  ? "概要"
                  : tab === "conversation"
                    ? "会話"
                    : tab === "events"
                      ? "ログ"
                      : "JSON"}
              </button>
            ))}
          </div>
          <div className="h-full overflow-y-auto pb-10 text-sm">
            {inspectorTab === "summary" && (
              <div className="space-y-3">
                <Info label="依頼内容" value={requestPreview || "未設定"} />
                <Info label="AIチーム" value={`${enabledAgents.length}人が有効`} />
                <Info label="ターン数" value={`${run.turns.length}件`} />
                {run.diff && (
                  <Info
                    label="変更点"
                    value={run.diff}
                    icon={<FileDiff className="h-3.5 w-3.5" />}
                  />
                )}
                {run.error && <Info label="エラー" value={run.error} />}
              </div>
            )}
            {inspectorTab === "conversation" && (
              <Conversation agents={enabledAgents} turns={run.turns} events={run.events} />
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

function Conversation({
  agents,
  turns,
  events,
  compact = false,
}: {
  agents: AgentConfig[];
  turns: TurnResult[];
  events: StreamEvent[];
  compact?: boolean;
}) {
  if (agents.length === 0) {
    return (
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-fg-muted)]">
        AIチームが選ばれていません。
      </div>
    );
  }

  const groupedTurns = agents.map((agent) => ({
    agentId: agent.id,
    agentName: agent.name,
    orgRole: agent.org_role,
    turns: turns.filter((turn) => turn.agent_id === agent.id),
    status: getAgentStatus(agent.id, turns, events),
  }));

  return (
    <div className={clsx("grid gap-3", compact ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1")}>
      {groupedTurns.map((group) => (
        <div
          key={group.agentId}
          className={clsx(
            "rounded-lg border border-[var(--color-border)] p-3",
            compact ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-2)]",
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquareText className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--color-fg)]">
                  {group.agentName}
                </div>
                <div className="text-[10px] text-[var(--color-fg-subtle)]">
                  {group.turns.length > 0 ? `${group.turns.length} messages` : "待機中"}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
              {group.orgRole}
            </div>
          </div>
          <div className="mb-3">
            <AgentStatusBadge status={group.status} />
          </div>
          <div className="space-y-3">
            {group.turns.length === 0 && (
              <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-fg-subtle)]">
                このエージェントの出力はまだありません。
              </div>
            )}
            {group.turns.map((turn, index) => (
              <div
                key={`${turn.agent_id}-${index}`}
                className={clsx(
                  "rounded-md border border-[var(--color-border)] p-3",
                  compact ? "bg-[var(--color-surface-2)]" : "bg-[var(--color-surface)]",
                )}
              >
                <div className="mb-2 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  message {index + 1}
                </div>
                {turn.error && (
                  <div className="mb-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
                    {turn.error}
                  </div>
                )}
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--color-fg-muted)]">
                  {turn.output || "出力はありません。"}
                </pre>
                {turn.file_changes && (
                  <details className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
                    <summary className="cursor-pointer text-xs text-[var(--color-fg-muted)]">
                      file changes
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-[var(--color-fg-muted)]">
                      {turn.file_changes}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type AgentRunStatus = "waiting" | "running" | "completed" | "error";

function getAgentStatus(
  agentId: string,
  turns: TurnResult[],
  events: StreamEvent[],
): AgentRunStatus {
  const agentTurns = turns.filter((turn) => turn.agent_id === agentId);
  if (agentTurns.some((turn) => turn.error)) return "error";

  const lastAgentEvent = [...events]
    .reverse()
    .find(
      (event) =>
        (event.type === "turn_started" && event.agent_id === agentId) ||
        (event.type === "turn_completed" && event.turn.agent_id === agentId),
    );
  if (lastAgentEvent?.type === "turn_started") return "running";
  if (agentTurns.length > 0) return "completed";
  return "waiting";
}

function AgentStatusBadge({ status }: { status: AgentRunStatus }) {
  const label =
    status === "running"
      ? "実行中"
      : status === "completed"
        ? "完了"
        : status === "error"
          ? "エラー"
          : "待機中";
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold",
        status === "running" && "border-sky-500/40 bg-sky-500/10 text-sky-200",
        status === "completed" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
        status === "error" && "border-red-500/40 bg-red-500/10 text-red-200",
        status === "waiting" &&
          "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-subtle)]",
      )}
    >
      {label}
    </span>
  );
}

function FeedbackList({ items }: { items: VerificationFeedback[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-sm text-[var(--color-fg-subtle)]">
        まだフィードバックはありません。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold text-[var(--color-fg-muted)]">
              {FEEDBACK_LABEL[item.kind]}
            </span>
            <span className="text-[10px] text-[var(--color-fg-subtle)]">
              {new Date(item.created_at).toLocaleString("ja-JP")}
            </span>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-fg-muted)]">
            {item.comment}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildFeedbackContinuationSource({
  originalSource,
  finalText,
  feedback,
}: {
  originalSource: string;
  finalText?: string;
  feedback: VerificationFeedback;
}) {
  return [
    "以下は前回の依頼内容です。",
    originalSource.trim(),
    "",
    finalText
      ? ["以下は前回のAIチームの最終回答です。", finalText.trim()].join("\n")
      : "前回の最終回答はまだありません。",
    "",
    "ユーザーから追加フィードバックがありました。",
    `種別: ${FEEDBACK_LABEL[feedback.kind]}`,
    feedback.comment.trim(),
    "",
    "このフィードバックを反映して、AIチームで議論を再開してください。前回の内容を前提に、必要な修正点・追加で確認すべき点・改善後の回答を出してください。",
  ].join("\n");
}

function Info({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
        {icon}
        {label}
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-fg)]">
        {value}
      </div>
    </div>
  );
}
