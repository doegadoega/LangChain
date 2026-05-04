import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import { formatDuration, PROVIDER_LABEL, ROLE_LABEL } from "../lib/format";
import { useApp } from "../state/store";
import type {
  AgentConfig,
  CodeContext,
  ManagedRequest,
  ManagedRequestStatus,
  Template,
  SubworkFlowEvent,
  SubworkFlowJson,
  TurnResult,
  VerificationFeedback,
  WorkspaceVersion,
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

type WorkMode = "subwork" | "history";
type ContentMode = "edit" | "progress";

interface SubWorkView {
  id: string;
  label: string;
  status: "completed" | "running" | "not_started";
  createdAt?: string;
  input: string;
  result: string;
  diff?: string;
  fileChanges?: string;
  isCurrent?: boolean;
  isEditable?: boolean;
  parentId?: string;
  reviewFeedback?: VerificationFeedback;
  version?: WorkspaceVersion;
}

const cloneRequest = (value: ManagedRequest["request"]): ManagedRequest["request"] =>
  JSON.parse(JSON.stringify(value)) as ManagedRequest["request"];

const codeContextToText = (items: string[]) => items.join("\n");

const textToCodeContextItems = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const cloneAgentConfig = (agent: AgentConfig): AgentConfig => ({
  ...agent,
  skills: [...agent.skills],
  depends_on: [...agent.depends_on],
  mcp_servers: [...agent.mcp_servers],
});

const countByLabel = <T extends string>(
  values: T[],
  labels: Record<T, string>,
  emptyLabel: string,
) => {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    const label = labels[value] ?? value;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts)
    .map(([label, count]) => `${label} ${count}`)
    .join(" / ");
  return summary || emptyLabel;
};

const summarizeRoles = (agents: AgentConfig[]) =>
  countByLabel(
    agents.map((agent) => agent.org_role),
    ROLE_LABEL,
    "ロール未設定",
  );

const summarizeProviders = (agents: AgentConfig[]) =>
  countByLabel(
    agents.map((agent) => agent.provider),
    PROVIDER_LABEL,
    "プロバイダー未設定",
  );

const teamLabel = (template: Template) =>
  `${template.locked || template.is_builtin ? "Built-in" : "Custom"} · ${template.name}`;

const subWorkLabel = (versionNo: number) =>
  versionNo <= 1 ? "ワーク（初回）" : `サブワーク${versionNo}（議論${versionNo}）`;

const subWorkStatusLabel = (status: SubWorkView["status"]) => {
  if (status === "completed") return "終了";
  if (status === "running") return "実行中";
  return "未実行";
};

const CURRENT_SUBWORK_ID = "current-edit";

function buildSubworkFlowJson({
  workId,
  subworkId,
  parentSubworkId,
  versionNo,
  title,
  createdAt,
  requestSnapshot,
  runStartedAt,
  runEndedAt,
  turns,
  events,
  finalText,
  diff,
  fileChanges,
}: {
  workId: string;
  subworkId: string;
  parentSubworkId?: string;
  versionNo: number;
  title: string;
  createdAt: string;
  requestSnapshot: ManagedRequest["request"];
  runStartedAt?: string;
  runEndedAt?: string;
  turns: TurnResult[];
  events: StreamEvent[];
  finalText?: string;
  diff?: string;
  fileChanges?: string;
}): SubworkFlowJson {
  const flowEvents = normalizeFlowEvents({
    requestSnapshot,
    events,
    turns,
    createdAt,
    finalText,
    diff,
    fileChanges,
  });

  return {
    schema_version: 1,
    work_id: workId,
    subwork_id: subworkId,
    parent_subwork_id: parentSubworkId,
    version_no: versionNo,
    title,
    created_at: createdAt,
    run_started_at: runStartedAt,
    run_ended_at: runEndedAt,
    request: requestSnapshot,
    agents: requestSnapshot.agents,
    events: flowEvents,
    final_text: finalText,
    diff,
    file_changes: fileChanges,
  };
}

function normalizeFlowEvents({
  requestSnapshot,
  events,
  turns,
  createdAt,
  finalText,
  diff,
  fileChanges,
}: {
  requestSnapshot: ManagedRequest["request"];
  events: StreamEvent[];
  turns: TurnResult[];
  createdAt: string;
  finalText?: string;
  diff?: string;
  fileChanges?: string;
}): SubworkFlowEvent[] {
  const normalized = events.map((event, index): SubworkFlowEvent => {
    const sequence = event.sequence ?? index;
    const timestamp = event.received_at ?? createdAt;
    const base = {
      id: `flow_${sequence}`,
      sequence,
      timestamp,
      raw_event: event,
    };

    if (event.type === "run_started") {
      return {
        ...base,
        type: "run_started",
        summary: "Subwork run started",
        input: requestSnapshot.source_text,
      };
    }
    if (event.type === "round_started") {
      return {
        ...base,
        type: "round_started",
        round_index: event.round_index,
        summary: `Round ${event.round_index + 1} started`,
      };
    }
    if (event.type === "turn_started") {
      return {
        ...base,
        type: "agent_started",
        agent_id: event.agent_id,
        agent_name: event.agent_name,
        org_role: event.org_role,
        provider: event.provider,
        summary: `${event.agent_name} started`,
      };
    }
    if (event.type === "turn_completed") {
      return {
        ...base,
        type: "agent_completed",
        round_index: event.round_index,
        batch_index: event.batch_index,
        turn_index: event.turn_index,
        agent_id: event.turn.agent_id,
        agent_name: event.turn.agent_name,
        org_role: event.turn.org_role,
        provider: event.turn.provider,
        output: event.turn.output,
        error: event.turn.error ?? undefined,
        file_changes: event.turn.file_changes ?? undefined,
        summary: `${event.turn.agent_name} completed`,
      };
    }
    if (event.type === "round_completed") {
      return {
        ...base,
        type: "round_completed",
        round_index: event.round_index,
        output: event.draft_after_round,
        summary: `Round ${event.round_index + 1} completed`,
      };
    }
    if (event.type === "run_completed") {
      return {
        ...base,
        type: "run_completed",
        output: event.result.final_text,
        file_changes: event.result.file_changes,
        summary: "Subwork run completed",
      };
    }
    return {
      ...base,
      type: "run_failed",
      error: event.error,
      summary: "Subwork run failed",
    };
  });

  if (normalized.some((event) => event.type === "agent_completed")) {
    return normalized;
  }

  const fallbackAgentEvents: SubworkFlowEvent[] = turns.map((turn, index) => ({
    id: `flow_fallback_turn_${index}`,
    sequence: normalized.length + index,
    timestamp: createdAt,
    type: "agent_completed",
    agent_id: turn.agent_id,
    agent_name: turn.agent_name,
    org_role: turn.org_role,
    provider: turn.provider,
    output: turn.output,
    error: turn.error ?? undefined,
    file_changes: turn.file_changes ?? undefined,
    summary: `${turn.agent_name} completed`,
  }));

  const finalSequence = normalized.length + fallbackAgentEvents.length;
  const fallbackFinalEvent: SubworkFlowEvent | undefined =
    finalText || diff || fileChanges
      ? {
          id: `flow_fallback_final_${finalSequence}`,
          sequence: finalSequence,
          timestamp: createdAt,
          type: "run_completed",
          output: finalText,
          file_changes: fileChanges,
          summary: "Subwork run completed",
        }
      : undefined;

  return [...normalized, ...fallbackAgentEvents, ...(fallbackFinalEvent ? [fallbackFinalEvent] : [])];
}

const extractFeedbackFromSource = (value: string) => {
  const marker = "ユーザーから追加フィードバックがありました。";
  const index = value.indexOf(marker);
  if (index < 0) return "";
  return value.slice(index + marker.length).trim();
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
  const [codingOpen, setCodingOpen] = useState(false);
  const [workMode, setWorkMode] = useState<WorkMode>("subwork");
  const [contentMode, setContentMode] = useState<ContentMode>("edit");
  const [inspectorTab, setInspectorTab] =
    useState<"summary" | "conversation" | "events" | "payload">("summary");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const managedRequests = useApp((state) => state.managedRequests);
  const templates = useApp((state) => state.templates);
  const selectedManagedRequestId = useApp((state) => state.selectedManagedRequestId);
  const selectManagedRequest = useApp((state) => state.selectManagedRequest);
  const persistManagedRequest = useApp((state) => state.saveManagedRequest);
  const removeManagedRequest = useApp((state) => state.deleteManagedRequest);
  const persistFeedback = useApp((state) => state.addManagedRequestFeedback);
  const loadManagedRequests = useApp((state) => state.loadManagedRequests);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestStatus, setRequestStatus] = useState<ManagedRequestStatus>("draft");
  const [selectedTeamTemplateId, setSelectedTeamTemplateId] = useState("");
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [feedbackKind] = useState<VerificationFeedback["kind"]>("fix_request");
  const [feedbackText, setFeedbackText] = useState("");
  const [pendingParentSubWorkId, setPendingParentSubWorkId] = useState<string | undefined>();
  const [pendingReviewFeedback, setPendingReviewFeedback] = useState<VerificationFeedback | undefined>();
  const localRequestIdRef = useRef<string | undefined>(undefined);
  const autoSaveTimerRef = useRef<number | undefined>(undefined);
  const lastDraftSignatureRef = useRef("");
  const lastSavedRunKeyRef = useRef("");

  const preset = getRequestPreset(presetId);
  const enabledAgents = request.agents.filter((agent) => agent.enabled !== false);
  const progressSteps = getProgressSteps(run);
  const liveNotes = getLiveNotes(run);
  const selectedManagedRequest = managedRequests.find((item) => item.id === selectedManagedRequestId);
  const verificationFeedback = selectedManagedRequest?.verification_feedback ?? [];
  const versions = selectedManagedRequest?.versions ?? [];
  const selectedTeamTemplate = templates.find((item) => item.id === selectedTeamTemplateId);
  const currentTeamAgents = selectedTeamTemplate?.agents ?? request.agents;
  const currentTeamEnabledAgents = currentTeamAgents.filter((agent) => agent.enabled !== false);
  const currentTeamName = selectedTeamTemplate
    ? teamLabel(selectedTeamTemplate)
    : "ワーク内チーム（テンプレート未選択）";
  const currentTeamSource = selectedTeamTemplate
    ? selectedTeamTemplate.description || "テンプレートからコピーした構成で実行します。"
    : "このワークに保存されているエージェント構成で実行します。";
  const currentTeamRoleSummary = summarizeRoles(currentTeamEnabledAgents);
  const currentTeamProviderSummary = summarizeProviders(currentTeamEnabledAgents);
  const visibleFinalText = run.finalText ?? selectedManagedRequest?.final_text ?? "";
  const visibleDiff = run.diff ?? selectedManagedRequest?.diff ?? "";
  const visibleFileChanges = run.fileChanges ?? selectedManagedRequest?.file_changes ?? "";
  const versionSubWorks: SubWorkView[] = [...versions]
    .sort((a, b) => a.version_no - b.version_no)
    .map((version) => ({
      id: version.id,
      label: subWorkLabel(version.version_no),
      status: "completed" as const,
      createdAt: version.created_at,
      input: version.request.source_text,
      result: version.final_text || version.diff || version.file_changes || "",
      diff: version.diff,
      fileChanges: version.file_changes,
      parentId: version.parent_version_id,
      reviewFeedback: version.review_feedback,
      version,
    }));
  const currentRunHasResult = Boolean(
    run.startedAt || run.endedAt || run.finalText || run.diff || run.fileChanges || run.turns.length,
  );
  const shouldShowCurrentSubWork =
    versionSubWorks.length === 0 ||
    run.status === "running" ||
    currentRunHasResult ||
    Boolean(pendingReviewFeedback);
  const currentSubWork: SubWorkView | undefined = shouldShowCurrentSubWork
    ? {
        id: CURRENT_SUBWORK_ID,
        label: subWorkLabel(versionSubWorks.length + 1),
        status: run.status === "running" ? "running" : "not_started",
        createdAt: run.startedAt ? new Date(run.startedAt).toISOString() : undefined,
        input: request.source_text,
        result: currentRunHasResult ? run.finalText ?? "" : "",
        diff: currentRunHasResult ? run.diff : undefined,
        fileChanges: currentRunHasResult ? run.fileChanges : undefined,
        isCurrent: true,
        isEditable: true,
        parentId: pendingParentSubWorkId,
        reviewFeedback: pendingReviewFeedback,
      }
    : undefined;
  const subWorks = currentSubWork ? [...versionSubWorks, currentSubWork] : versionSubWorks;
  const selectedSubWork =
    subWorks.find((item) => item.id === selectedVersionId) ??
    currentSubWork ??
    versionSubWorks[versionSubWorks.length - 1];
  const selectedSubWorkChildren = subWorks.filter((item) => item.parentId === selectedSubWork?.id);
  const fallbackNextSubWork =
    selectedSubWork?.version
      ? subWorks.find((item) => item.version?.version_no === selectedSubWork.version!.version_no + 1)
      : undefined;
  const nextLinkedSubWorks =
    selectedSubWorkChildren.length > 0
      ? selectedSubWorkChildren
      : fallbackNextSubWork
        ? [fallbackNextSubWork]
        : [];
  const activeRequest = selectedSubWork?.version?.request ?? request;
  const activeResult = selectedSubWork?.isEditable && currentSubWork
    ? currentSubWork.result
    : selectedSubWork?.result ?? "";
  const activeDiff = selectedSubWork?.isEditable && currentSubWork ? currentSubWork.diff : selectedSubWork?.diff;
  const activeFileChanges = selectedSubWork?.isEditable && currentSubWork
    ? currentSubWork.fileChanges
    : selectedSubWork?.fileChanges;
  const activeCanEdit = selectedSubWork?.isEditable ?? true;
  const activeExecutionAgents = activeRequest.agents;
  const activeExecutionEnabledAgents = activeExecutionAgents.filter((agent) => agent.enabled !== false);
  const activeExecutionPreviewAgents = activeExecutionAgents.slice(0, 6);
  const activeExecutionHiddenAgentCount = Math.max(
    0,
    activeExecutionAgents.length - activeExecutionPreviewAgents.length,
  );
  const activeExecutionTeamName = activeCanEdit ? currentTeamName : "履歴: このサブワークの実行チーム";
  const activeExecutionTeamSource = activeCanEdit
    ? currentTeamSource
    : "このサブワークの実行時に保存されたエージェント構成です。";
  const activeExecutionRoleSummary = summarizeRoles(activeExecutionEnabledAgents);
  const activeExecutionProviderSummary = summarizeProviders(activeExecutionEnabledAgents);
  const reviewStepNumber = 5 + nextLinkedSubWorks.length;
  const reviewLabel =
    reviewStepNumber === 5
      ? "5. ユーザーからのレビュー"
      : `${reviewStepNumber}. ユーザーからの別レビュー`;
  const activeReviewText =
    selectedSubWork?.reviewFeedback?.comment ??
    extractFeedbackFromSource(selectedSubWork?.input ?? "");
  const activeRequestTitle = requestTitle.trim() || selectedManagedRequest?.title || "新規ワーク";
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

  const filteredWorkspaces = useMemo(() => {
    const query = workspaceQuery.trim().toLowerCase();
    if (!query) return managedRequests;
    return managedRequests.filter((item) => {
      const haystack = [
        item.title,
        STATUS_LABEL[item.status] ?? item.status,
        item.request.source_text,
        item.request.objective,
      ].join("\n").toLowerCase();
      return haystack.includes(query);
    });
  }, [managedRequests, workspaceQuery]);

  useEffect(() => {
    void loadManagedRequests();
  }, [loadManagedRequests]);

  useEffect(() => {
    if (!selectedManagedRequestId) return;
    const entry = managedRequests.find((item) => item.id === selectedManagedRequestId);
    if (!entry) return;
    setRequestTitle(entry.title);
    setRequestStatus(entry.status);
    setSelectedTeamTemplateId(entry.template_id ?? "");
    setSelectedVersionId(entry.versions?.[0]?.id ?? "");
  }, [selectedManagedRequestId, managedRequests]);

  const selectPreset = (nextId: RequestPresetId) => {
    const nextPreset = getRequestPreset(nextId);
    setPresetId(nextId);
    updateRequest(applyPresetToRequest(request, nextPreset));
  };

  const resetManagedRequest = () => {
    selectManagedRequest(undefined);
    localRequestIdRef.current = undefined;
    lastDraftSignatureRef.current = "";
    lastSavedRunKeyRef.current = "";
    setRequestTitle("");
    setRequestStatus("draft");
    setSelectedTeamTemplateId("");
    setSelectedVersionId(CURRENT_SUBWORK_ID);
    setPendingParentSubWorkId(undefined);
    setPendingReviewFeedback(undefined);
    setFeedbackText("");
    updateRequest({
      source_text: "",
      objective: preset.defaultObjective,
      global_instruction: "",
      code_context: {
        repository: "",
        working_directory: "",
        target_paths: [],
        tech_stack: "",
        acceptance_criteria: "",
        test_command: "",
      },
    });
    resetRun();
    setWorkMode("subwork");
    setContentMode("edit");
    setSaveMessage("新しいワークスペースを作成中です。");
  };

  const draftSignature = (
    title = requestTitle,
    status = requestStatus,
    templateId = selectedTeamTemplateId,
    requestValue = request,
  ) =>
    JSON.stringify({
      title: title.trim(),
      status,
      templateId,
      request: requestValue,
    });

  const buildManagedRequestRecord = (
    feedbackList: VerificationFeedback[] = verificationFeedback,
    options: { appendRunVersion?: boolean } = {},
  ): ManagedRequest => {
    const now = new Date().toISOString();
    const fallbackTitle = request.source_text.trim().split("\n")[0]?.slice(0, 40) || preset.label;
    const existing = managedRequests.find((item) => item.id === selectedManagedRequestId);
    const id = existing?.id ?? selectedManagedRequestId ?? localRequestIdRef.current ?? `req_${Date.now().toString(36)}`;
    localRequestIdRef.current = id;
    const baseVersions = existing?.versions ?? [];
    const nextVersion =
      options.appendRunVersion && hasRunResult()
        ? buildWorkspaceVersion(baseVersions.length + 1, now)
        : undefined;
    const versions = nextVersion && !isDuplicateVersion(baseVersions[0], nextVersion)
      ? [nextVersion, ...baseVersions]
      : baseVersions;
    return {
      id,
      title: requestTitle.trim() || fallbackTitle,
      status: run.status === "running" ? "running" : run.status === "completed" ? "completed" : requestStatus,
      template_id: selectedTeamTemplateId || undefined,
      request: cloneRequest(request),
      original_request: existing?.original_request ?? (existing ? cloneRequest(existing.request) : cloneRequest(request)),
      previous_request: existing ? cloneRequest(existing.request) : undefined,
      versions,
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
      verification_feedback: feedbackList,
    };
  };

  const hasRunResult = () =>
    Boolean(run.startedAt || run.endedAt || run.finalText || run.diff || run.fileChanges || run.turns.length);

  const buildWorkspaceVersion = (versionNo: number, createdAt: string): WorkspaceVersion => {
    const id = `ver_${Date.now().toString(36)}`;
    const title = `v${versionNo} ${new Date(createdAt).toLocaleString("ja-JP")}`;
    const requestSnapshot = cloneRequest(request);
    const runStartedAt = run.startedAt ? new Date(run.startedAt).toISOString() : undefined;
    const runEndedAt = run.endedAt ? new Date(run.endedAt).toISOString() : undefined;
    return {
      id,
      version_no: versionNo,
      title,
      created_at: createdAt,
      request: requestSnapshot,
      parent_version_id: pendingParentSubWorkId,
      review_feedback: pendingReviewFeedback,
      final_text: run.finalText,
      diff: run.diff,
      file_changes: run.fileChanges,
      agent_turns: run.turns.length > 0 ? run.turns : undefined,
      stream_events: run.events.length > 0 ? run.events : undefined,
      flow_json: buildSubworkFlowJson({
        workId: localRequestIdRef.current ?? selectedManagedRequestId ?? "pending-work",
        subworkId: id,
        parentSubworkId: pendingParentSubWorkId,
        versionNo,
        title,
        createdAt,
        requestSnapshot,
        runStartedAt,
        runEndedAt,
        turns: run.turns,
        events: run.events,
        finalText: run.finalText,
        diff: run.diff,
        fileChanges: run.fileChanges,
      }),
      run_started_at: runStartedAt,
      run_ended_at: runEndedAt,
    };
  };

  const isDuplicateVersion = (latest: WorkspaceVersion | undefined, next: WorkspaceVersion) =>
    Boolean(
      latest &&
        latest.run_started_at === next.run_started_at &&
        latest.run_ended_at === next.run_ended_at &&
        latest.final_text === next.final_text &&
        latest.diff === next.diff,
    );

  const persistManagedRequestAuto = async ({
    appendRunVersion = false,
    clearPending = false,
    resetRunAfter = false,
    quiet = false,
  }: {
    appendRunVersion?: boolean;
    clearPending?: boolean;
    resetRunAfter?: boolean;
    quiet?: boolean;
  } = {}) => {
    const record = buildManagedRequestRecord(verificationFeedback, { appendRunVersion });
    try {
      const saved = await persistManagedRequest(record);
      localRequestIdRef.current = saved.id;
      setRequestTitle(saved.title);
      setRequestStatus(saved.status);
      lastDraftSignatureRef.current = draftSignature(saved.title, saved.status, saved.template_id ?? "", saved.request);
      if (appendRunVersion) {
        setSelectedVersionId(saved.versions?.[0]?.id ?? CURRENT_SUBWORK_ID);
      }
      if (clearPending) {
        setPendingParentSubWorkId(undefined);
        setPendingReviewFeedback(undefined);
      }
      if (resetRunAfter) {
        resetRun();
      }
      if (!quiet) {
        setSaveMessage("自動保存しました。");
      }
      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveMessage(`自動保存に失敗しました: ${message}`);
      return undefined;
    }
  };

  const loadManagedRequest = (item: ManagedRequest) => {
    localRequestIdRef.current = item.id;
    lastDraftSignatureRef.current = draftSignature(
      item.title,
      item.status,
      item.template_id ?? "",
      item.request,
    );
    lastSavedRunKeyRef.current = "";
    selectManagedRequest(item.id);
    setRequestTitle(item.title);
    setRequestStatus(item.status);
    setSelectedTeamTemplateId(item.template_id ?? "");
    setSelectedVersionId(CURRENT_SUBWORK_ID);
    setPendingParentSubWorkId(undefined);
    setPendingReviewFeedback(undefined);
    setFeedbackText("");
    updateRequest(item.request);
    setWorkMode("subwork");
    setContentMode(item.status === "running" ? "progress" : "edit");
    setSaveMessage("ワークスペースを読み込みました。内容を編集できます。");
  };

  const restoreVersionRequest = (version: WorkspaceVersion) => {
    updateRequest(cloneRequest(version.request));
    setWorkMode("subwork");
    setContentMode("edit");
    setSaveMessage(`履歴 ${version.title} の依頼内容を編集状態へ戻しました。`);
  };

  const deleteSelectedManagedRequest = async () => {
    if (!selectedManagedRequestId) return;
    if (!window.confirm("このワークスペースを削除しますか？")) return;
    try {
      await removeManagedRequest(selectedManagedRequestId);
      localRequestIdRef.current = undefined;
      lastDraftSignatureRef.current = "";
      lastSavedRunKeyRef.current = "";
      setRequestTitle("");
      setRequestStatus("draft");
      setSelectedTeamTemplateId("");
      setSelectedVersionId(CURRENT_SUBWORK_ID);
      setPendingParentSubWorkId(undefined);
      setPendingReviewFeedback(undefined);
      setFeedbackText("");
      updateRequest({
        source_text: "",
        objective: preset.defaultObjective,
        global_instruction: "",
      });
      resetRun();
      setWorkMode("subwork");
      setContentMode("edit");
      setSaveMessage("ワークスペースを削除しました。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveMessage(`削除に失敗しました: ${message}`);
    }
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
    try {
      const saved = await persistFeedback(buildManagedRequestRecord(), nextFeedback);
      setRequestTitle(saved.title);
      setRequestStatus(saved.status);
      setFeedbackText("");
      setSaveMessage("レビューを反映しました。");
      return { feedback: nextFeedback, feedbackList: saved.verification_feedback ?? [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveMessage(`レビュー反映に失敗しました: ${message}`);
      return undefined;
    }
  };

  const updateCodeContext = (patch: Partial<CodeContext>) => {
    updateRequest({
      code_context: {
        ...request.code_context,
        ...patch,
      },
    });
  };

  const applyTeamTemplate = (templateId: string) => {
    setSelectedTeamTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      setSaveMessage("テンプレート紐付けを外しました。現在のワーク内チームで実行します。");
      return;
    }
    updateRequest({
      agents: template.agents.map(cloneAgentConfig),
      workflow_mode: template.workflow_mode ?? request.workflow_mode,
      orchestration_mode: template.orchestration_mode ?? request.orchestration_mode,
      rounds: template.rounds ?? request.rounds,
    });
    setSaveMessage(`実行チームを「${template.name}」に変更しました。`);
  };

  const restartDiscussionWithFeedback = async () => {
    if (run.status === "running") {
      setSaveMessage("実行中です。停止してからフィードバックを反映してください。");
      return;
    }
    const result = await addVerificationFeedback();
    if (!result) return;

    const parentId =
      selectedSubWork?.version?.id ??
      (versionSubWorks.length > 0 ? versionSubWorks[versionSubWorks.length - 1].id : undefined);
    const nextRequest = {
      ...cloneRequest(activeRequest),
      agents: request.agents.map(cloneAgentConfig),
      workflow_mode: request.workflow_mode,
      orchestration_mode: request.orchestration_mode,
      rounds: request.rounds,
      objective:
        "追加フィードバックを反映し、AIチームでもう一度議論して改善案を出す。",
      source_text: buildFeedbackContinuationSource({
        originalSource: activeRequest.source_text,
        finalText: activeResult,
        feedback: result.feedback,
      }),
    };
    setPendingParentSubWorkId(parentId);
    setPendingReviewFeedback(result.feedback);
    setSelectedVersionId(CURRENT_SUBWORK_ID);
    updateRequest(nextRequest);
    setWorkMode("subwork");
    setContentMode("progress");
    setInspectorTab("summary");
    setSaveMessage("フィードバックを反映して、AIチームの議論を再開します。");
    await startRun();
  };

  const runCurrentWork = async () => {
    setSelectedVersionId(CURRENT_SUBWORK_ID);
    setWorkMode("subwork");
    setContentMode("progress");
    setInspectorTab("summary");
    setRequestStatus("running");
    await startRun();
  };

  useEffect(() => {
    const hasPersistableContent =
      Boolean(request.source_text.trim()) ||
      Boolean(requestTitle.trim()) ||
      Boolean(selectedManagedRequestId) ||
      Boolean(localRequestIdRef.current);
    if (!hasPersistableContent || run.status === "running") return;

    const signature = draftSignature();
    if (signature === lastDraftSignatureRef.current) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      void persistManagedRequestAuto({ quiet: true });
    }, 700);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [request, requestTitle, requestStatus, selectedTeamTemplateId, selectedManagedRequestId, run.status]);

  useEffect(() => {
    if ((run.status !== "completed" && run.status !== "failed") || !run.endedAt) return;
    const runKey = `${run.startedAt ?? ""}:${run.endedAt}:${run.finalText ?? ""}:${run.diff ?? ""}:${run.error ?? ""}`;
    if (runKey === lastSavedRunKeyRef.current) return;
    lastSavedRunKeyRef.current = runKey;
    setRequestStatus(run.status === "completed" ? "completed" : "paused");
    void persistManagedRequestAuto({
      appendRunVersion: true,
      clearPending: true,
      resetRunAfter: true,
    });
  }, [run.status, run.endedAt, run.startedAt, run.finalText, run.diff, run.error]);

  return (
    <div className="grid h-full grid-cols-[minmax(320px,380px)_minmax(560px,1fr)_minmax(340px,400px)] gap-4 overflow-hidden p-4">
      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>ワークスペース管理</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              ワークを選びます。変更は自動保存されます。
            </p>
          </div>
          <ClipboardList className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
        </CardHeader>
        <CardBody className="flex-1 space-y-4 overflow-y-auto">
          <section className="space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={resetManagedRequest}>
                新規
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={!selectedManagedRequestId}
                onClick={() => void deleteSelectedManagedRequest()}
              >
                削除
              </Button>
            </div>
            {selectedManagedRequest && (
              <div className="rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-2 text-xs text-[var(--color-fg-muted)]">
                編集中: <span className="font-semibold text-[var(--color-fg)]">{selectedManagedRequest.title}</span>
              </div>
            )}
            <div>
              <Label>ワークスペース名</Label>
              <Input
                value={requestTitle}
                placeholder="例: ログイン画面レビュー"
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
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs text-[var(--color-fg-muted)]">
              入力・設定・実行結果は自動保存されます。
            </div>
            {saveMessage && (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs text-[var(--color-fg-muted)]">
                {saveMessage}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold">ワークスペース一覧</div>
              <span className="text-[10px] text-[var(--color-fg-subtle)]">
                {filteredWorkspaces.length}/{managedRequests.length}
              </span>
            </div>
            <Input
              value={workspaceQuery}
              placeholder="名前・状態・依頼内容で検索"
              onChange={(event) => setWorkspaceQuery(event.target.value)}
            />
            <div className="space-y-2 overflow-y-auto">
              {managedRequests.length === 0 && (
                <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-fg-subtle)]">
                  ワークスペースはまだありません。
                </div>
              )}
              {managedRequests.length > 0 && filteredWorkspaces.length === 0 && (
                <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-fg-subtle)]">
                  条件に一致するワークスペースはありません。
                </div>
              )}
              {filteredWorkspaces.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadManagedRequest(item)}
                  className={clsx(
                    "w-full rounded-md border p-3 text-left transition-colors",
                    selectedManagedRequestId === item.id
                      ? "border-[var(--color-accent)] bg-[var(--color-surface-3)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-semibold">{item.title}</div>
                    <span className="shrink-0 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-muted)]">
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--color-fg-muted)]">
                    {item.request.source_text || "依頼内容なし"}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[var(--color-fg-subtle)]">
                    <span>{item.versions?.length ?? 0} versions</span>
                    <span>{new Date(item.updated_at).toLocaleString("ja-JP")}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </CardBody>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>コンテンツ</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              {workMode === "history"
                ? "ワーク全体のサブワーク履歴とエージェントログ"
                : contentMode === "edit"
                  ? `${selectedSubWork?.label ?? "サブワーク"} · 作成・編集`
                  : `${selectedSubWork?.label ?? "サブワーク"} · ${enabledAgents.length}人のAIチーム · ${formatDuration(run.startedAt, run.endedAt)}`}
            </p>
          </div>
          {workMode === "subwork" && contentMode === "progress" ? (
            <Activity className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
          ) : (
            <Users className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
          )}
        </CardHeader>
        <CardBody className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[var(--color-fg)]">サブワーク</div>
              <div className="text-[10px] text-[var(--color-fg-subtle)]">
                {subWorks.length}件
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {subWorks.map((subWork) => (
                <button
                  key={subWork.id}
                  type="button"
                  onClick={() => {
                    setSelectedVersionId(subWork.id);
                    setWorkMode("subwork");
                    setContentMode("edit");
                  }}
                  className={clsx(
                    "min-w-44 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                    workMode === "subwork" && selectedSubWork?.id === subWork.id
                      ? "border-[var(--color-accent)] bg-[var(--color-surface-3)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]",
                  )}
                >
                  <div className="font-semibold text-[var(--color-fg)]">{subWork.label}</div>
                  <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
                    {subWorkStatusLabel(subWork.status)}
                    {subWork.createdAt
                      ? ` · ${new Date(subWork.createdAt).toLocaleString("ja-JP")}`
                      : ""}
                  </div>
                  {subWork.parentId && (
                    <div className="mt-1 text-[10px] text-sky-300">レビューから作成</div>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setWorkMode("history")}
                className={clsx(
                  "min-w-44 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                  workMode === "history"
                    ? "border-[var(--color-accent)] bg-[var(--color-surface-3)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]",
                )}
              >
                <div className="font-semibold text-[var(--color-fg)]">履歴</div>
                <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
                  サブワーク概要 / エージェントログ
                </div>
              </button>
            </div>
          </div>

          {workMode === "subwork" && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-xs">
              {[
                ["edit", "作成・編集"],
                ["progress", "エージェント進捗"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setContentMode(mode as ContentMode)}
                  className={clsx(
                    "rounded px-2 py-2 font-semibold transition-colors",
                    contentMode === mode
                      ? "bg-[var(--color-accent)] text-white"
                      : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {workMode === "subwork" && contentMode === "edit" && (
            <div className="space-y-4">
              <div>
                <Label>1. 何をしたいですか？</Label>
                <div className="grid gap-2 md:grid-cols-2">
                  {REQUEST_PRESETS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!activeCanEdit}
                      onClick={() => activeCanEdit && selectPreset(item.id)}
                      className={clsx(
                        "rounded-md border p-3 text-left transition-colors",
                        presetId === item.id
                          ? "border-[var(--color-accent)] bg-[var(--color-surface-3)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]",
                        !activeCanEdit && "cursor-default opacity-60",
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
                  rows={10}
                  value={activeRequest.source_text}
                  placeholder="文章、相談内容、要件、エラー内容、コードの説明などを貼ってください。"
                  className="font-sans"
                  readOnly={!activeCanEdit}
                  onChange={(event) =>
                    activeCanEdit && updateRequest({ source_text: event.target.value })
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>3. どんな結果がほしいですか？</Label>
                  {activeCanEdit ? (
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
                  ) : (
                    <Input value={activeRequest.objective || "AIチームに任せる"} readOnly />
                  )}
                </div>
                <div>
                  <Label>補足. 誰に向けた内容ですか？</Label>
                  <Input
                    value={activeRequest.global_instruction}
                    placeholder="例: 初心者向け、開発者向け、顧客向け"
                    readOnly={!activeCanEdit}
                    onChange={(event) =>
                      activeCanEdit && updateRequest({ global_instruction: event.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <Label>4. 結果</Label>
                  <div className="min-h-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                    {activeResult ? (
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans">
                        {activeResult}
                      </pre>
                    ) : (
                      "まだ結果はありません。実行後にここへ表示されます。"
                    )}
                  </div>
                  {(activeDiff || activeFileChanges) && (
                    <details className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
                      <summary className="cursor-pointer text-xs text-[var(--color-fg-muted)]">
                        diff / file changes
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-[var(--color-fg-muted)]">
                        {activeFileChanges || activeDiff}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div>
                    <Label>{activeCanEdit ? "このサブワークで実行するチーム" : "このサブワークで実行したチーム"}</Label>
                    {activeCanEdit ? (
                      <Select
                        value={selectedTeamTemplateId}
                        onChange={(event) => applyTeamTemplate(event.target.value)}
                      >
                        <option value="">ワーク内チームを使う（下に内訳表示）</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {teamLabel(template)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input value="保存済みチーム構成" readOnly />
                    )}
                  </div>
                  <div>
                    <Label>作業モード</Label>
                    <Select
                      value={activeRequest.workflow_mode}
                      disabled={!activeCanEdit}
                      onChange={(event) =>
                        updateRequest({ workflow_mode: event.target.value as "writing" | "coding" })
                      }
                    >
                      <option value="writing">writing</option>
                      <option value="coding">coding</option>
                    </Select>
                  </div>
                  <div>
                    <Label>進め方</Label>
                    <Select
                      value={activeRequest.orchestration_mode}
                      disabled={!activeCanEdit}
                      onChange={(event) =>
                        updateRequest({
                          orchestration_mode: event.target.value as typeof request.orchestration_mode,
                        })
                      }
                    >
                      <option value="role_based">role_based</option>
                      <option value="dependency_graph">dependency_graph</option>
                      <option value="sequential">sequential</option>
                    </Select>
                  </div>
                </div>
                <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[var(--color-fg)]">
                        {activeExecutionTeamName}
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
                        {activeExecutionTeamSource}
                      </div>
                    </div>
                    <div className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-fg-muted)]">
                      {activeExecutionEnabledAgents.length}/{activeExecutionAgents.length}人が有効
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--color-fg-muted)] md:grid-cols-2">
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5">
                      ロール: {activeExecutionRoleSummary}
                    </div>
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5">
                      プロバイダー: {activeExecutionProviderSummary}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeExecutionPreviewAgents.length > 0 ? (
                      activeExecutionPreviewAgents.map((agent) => (
                        <span
                          key={agent.id}
                          className={clsx(
                            "rounded-md border px-2 py-1 text-xs",
                            agent.enabled === false
                              ? "border-[var(--color-border)] text-[var(--color-fg-subtle)]"
                              : "border-indigo-500/40 bg-indigo-500/10 text-indigo-200",
                          )}
                          title={`${agent.name} / ${ROLE_LABEL[agent.org_role]} / ${PROVIDER_LABEL[agent.provider]}`}
                        >
                          {agent.name || agent.id} · {ROLE_LABEL[agent.org_role]}
                          {agent.enabled === false ? " · 無効" : ""}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--color-fg-muted)]">
                        エージェントが設定されていません。
                      </span>
                    )}
                    {activeExecutionHiddenAgentCount > 0 && (
                      <span className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-fg-muted)]">
                        +{activeExecutionHiddenAgentCount}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-3)]"
                  onClick={() => setCodingOpen((open) => !open)}
                >
                  コーディング用コンテキスト
                  <ChevronDown
                    className={clsx("h-4 w-4 transition-transform", codingOpen && "rotate-180")}
                  />
                </button>
                {(codingOpen || activeRequest.workflow_mode === "coding") && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>working_directory</Label>
                      <Input
                        value={activeRequest.code_context.working_directory}
                        placeholder="/path/to/repo"
                        readOnly={!activeCanEdit}
                        onChange={(event) =>
                          activeCanEdit && updateCodeContext({ working_directory: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>test_command</Label>
                      <Input
                        value={activeRequest.code_context.test_command}
                        placeholder="npm run build"
                        readOnly={!activeCanEdit}
                        onChange={(event) =>
                          activeCanEdit && updateCodeContext({ test_command: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>tech_stack</Label>
                      <Input
                        value={activeRequest.code_context.tech_stack}
                        placeholder="React / TypeScript / FastAPI"
                        readOnly={!activeCanEdit}
                        onChange={(event) =>
                          activeCanEdit && updateCodeContext({ tech_stack: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>target_paths</Label>
                      <Textarea
                        rows={3}
                        className="font-mono"
                        value={codeContextToText(activeRequest.code_context.target_paths)}
                        placeholder="app/web/src/screens/Workspace.tsx"
                        readOnly={!activeCanEdit}
                        onChange={(event) =>
                          activeCanEdit &&
                          updateCodeContext({ target_paths: textToCodeContextItems(event.target.value) })
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>acceptance_criteria</Label>
                      <Textarea
                        rows={3}
                        value={activeRequest.code_context.acceptance_criteria}
                        placeholder="完了条件、UI要件、避けたい変更"
                        className="font-sans"
                        readOnly={!activeCanEdit}
                        onChange={(event) =>
                          activeCanEdit && updateCodeContext({ acceptance_criteria: event.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
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
                    value={activeRequest.global_instruction}
                    placeholder="口調、制約、必ず見てほしい観点など"
                    className="font-sans"
                    readOnly={!activeCanEdit}
                    onChange={(event) =>
                      activeCanEdit && updateRequest({ global_instruction: event.target.value })
                    }
                  />
                </div>
              )}

              {activeResult && (
                <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
                  <div className="space-y-3">
                    <div>
                      <Label>{reviewLabel}</Label>
                      {activeReviewText && (
                        <div className="mb-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-xs leading-relaxed text-[var(--color-fg-muted)]">
                          前回レビュー: {activeReviewText}
                        </div>
                      )}
                      <Textarea
                        rows={5}
                        className="font-sans"
                        value={feedbackText}
                        placeholder="例: まことみけんの意見交換が見られない。ちゃんと会話して"
                        onChange={(event) => setFeedbackText(event.target.value)}
                      />
                    </div>
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                      <Label>レビューを実行するチーム</Label>
                      <Select
                        value={selectedTeamTemplateId}
                        disabled={run.status === "running"}
                        onChange={(event) => applyTeamTemplate(event.target.value)}
                      >
                        <option value="">ワーク内チームを使う（下に内訳表示）</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {teamLabel(template)}
                          </option>
                        ))}
                      </Select>
                      <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-[var(--color-fg)]">
                              {currentTeamName}
                            </div>
                            <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
                              {currentTeamSource}
                            </div>
                          </div>
                          <div className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-fg-muted)]">
                            {currentTeamEnabledAgents.length}/{currentTeamAgents.length}人が有効
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--color-fg-muted)] md:grid-cols-2">
                          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5">
                            ロール: {currentTeamRoleSummary}
                          </div>
                          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5">
                            プロバイダー: {currentTeamProviderSummary}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={run.status === "running" || !feedbackText.trim()}
                    onClick={() => void restartDiscussionWithFeedback()}
                  >
                    <Play className="h-4 w-4" />
                    レビューを反映して議論
                  </Button>
                  {nextLinkedSubWorks.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-[var(--color-fg-subtle)]">次のサブワーク:</span>
                      {nextLinkedSubWorks.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className="rounded border border-[var(--color-border)] px-2 py-1 text-sky-300 hover:border-sky-500/40"
                          onClick={() => {
                            setSelectedVersionId(child.id);
                            setWorkMode("subwork");
                            setContentMode("edit");
                          }}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!activeResult && activeCanEdit && (
                <div className="grid gap-2 border-t border-[var(--color-border)] pt-4">
                  {run.status === "running" ? (
                    <Button variant="danger" onClick={stopRun}>
                      <Square className="h-4 w-4" />
                      停止する
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={!canStart}
                      onClick={() => void runCurrentWork()}
                    >
                      <Play className="h-4 w-4" />
                      このワークを実行
                    </Button>
                  )}
                </div>
              )}
              {activeCanEdit && (
                <div className="text-xs text-[var(--color-fg-muted)]">
                  変更は自動保存されます。
                </div>
              )}
              {!activeCanEdit && (
                <div className="text-xs text-[var(--color-fg-muted)]">
                  過去のサブワークを表示中です。内容は編集できません。必要ならレビューから次のサブワークを作成できます。
                </div>
              )}
              {!canStart && <div className="text-xs text-amber-300">{missingReason}</div>}
            </div>
          )}

          {workMode === "subwork" && contentMode === "progress" && (
            <div className="space-y-4">
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
                <h3 className="mb-2 text-sm font-semibold">エージェント作業状況</h3>
                <AgentProgressCards agents={enabledAgents} turns={run.turns} events={run.events} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">リアルタイム出力</h3>
                <Conversation agents={enabledAgents} turns={run.turns} events={run.events} />
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
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <h3 className="mb-2 text-sm font-semibold">最終回答</h3>
                {visibleFinalText ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--color-fg)]">
                    {visibleFinalText}
                  </pre>
                ) : (
                  <div className="text-sm text-[var(--color-fg-muted)]">
                    実行が完了すると、ここに最終回答が表示されます。
                  </div>
                )}
              </div>
              <Button variant="ghost" className="w-full" onClick={resetRun}>
                <RefreshCcw className="h-4 w-4" />
                実行結果をリセット
              </Button>
            </div>
          )}

          {workMode === "history" && (
            <div className="space-y-3">
              <section className="grid grid-cols-3 gap-2">
                <Info label="現在のWS" value={activeRequestTitle} />
                <Info label="サブワーク" value={`${subWorks.length}件`} />
                <Info label="履歴化済み結果" value={`${versionSubWorks.length}件`} />
              </section>
              {subWorks.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-fg-subtle)]">
                  サブワークはまだありません。実行後に自動で初回ワークとして残ります。
                </div>
              ) : (
                <div className="grid gap-3">
                  {subWorks.map((subWork) => {
                    const historyAgents =
                      subWork.version?.request.agents.filter((agent) => agent.enabled !== false) ??
                      enabledAgents;
                    const historyTurns = subWork.isEditable
                      ? run.turns
                      : subWork.version?.agent_turns ?? [];
                    const historyEvents = subWork.isEditable
                      ? run.events
                      : subWork.version?.stream_events ?? [];
                    return (
                      <section
                        key={subWork.id}
                        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--color-fg)]">
                              {subWork.label}
                            </div>
                            <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">
                              {subWorkStatusLabel(subWork.status)}
                              {subWork.createdAt
                                ? ` · ${new Date(subWork.createdAt).toLocaleString("ja-JP")}`
                                : ""}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {subWork.version && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => restoreVersionRequest(subWork.version!)}
                              >
                                依頼に戻す
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedVersionId(subWork.id);
                                setWorkMode("subwork");
                                setContentMode("edit");
                              }}
                            >
                              このサブワークを開く
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--color-fg-muted)] md:grid-cols-3">
                          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
                            エージェント: {historyAgents.length}人
                          </div>
                          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
                            出力: {historyTurns.length}件
                          </div>
                          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
                            ログ: {historyEvents.length}件
                          </div>
                        </div>
                        {subWork.version?.flow_json && (
                          <details className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                            <summary className="cursor-pointer text-xs font-semibold">
                              flow_json
                            </summary>
                            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--color-fg-muted)]">
                              {JSON.stringify(subWork.version.flow_json, null, 2)}
                            </pre>
                          </details>
                        )}
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                            <h3 className="mb-2 text-xs font-semibold text-[var(--color-fg)]">インプット概要</h3>
                            <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--color-fg-muted)]">
                              {truncateForCard(subWork.input || "入力はありません。", 360)}
                            </pre>
                          </div>
                          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                            <h3 className="mb-2 text-xs font-semibold text-[var(--color-fg)]">結果概要</h3>
                            <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--color-fg-muted)]">
                              {truncateForCard(subWork.result || "このサブワークに結果はまだありません。", 360)}
                            </pre>
                          </div>
                        </div>
                        {(subWork.diff || subWork.fileChanges) && (
                          <details className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                            <summary className="cursor-pointer text-xs font-semibold">
                              diff / file changes
                            </summary>
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--color-fg-muted)]">
                              {subWork.fileChanges || subWork.diff}
                            </pre>
                          </details>
                        )}
                        <details className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                          <summary className="cursor-pointer text-xs font-semibold">
                            エージェントログ
                          </summary>
                          <div className="mt-3">
                            <HistoryAgentLogs
                              agents={historyAgents}
                              turns={historyTurns}
                              events={historyEvents}
                            />
                          </div>
                        </details>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>ログ</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              会話ログ、イベント、JSONを確認します。
            </p>
          </div>
          <Activity className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
        </CardHeader>
        <CardBody className="flex-1 space-y-4 overflow-y-auto">
          <section>
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
            <div className="min-h-72 overflow-y-auto pb-2 text-sm">
              {inspectorTab === "summary" && (
                <div className="space-y-3">
                    <Info
                      label="現在のサブワーク"
                      value={
                        selectedSubWork
                        ? `${selectedSubWork.label} / ${subWorkStatusLabel(selectedSubWork.status)}`
                        : "未選択"
                      }
                    />
                  {visibleFinalText && (
                    <Info label="最新の実行結果" value={visibleFinalText} />
                  )}
                  <Info label="依頼内容" value={requestPreview || "未設定"} />
                  <Info label="AIチーム" value={`${enabledAgents.length}人が有効`} />
                  <Info label="ターン数" value={`${run.turns.length}件`} />
                  {visibleDiff && (
                    <Info
                      label="変更点"
                      value={visibleDiff}
                      icon={<FileDiff className="h-3.5 w-3.5" />}
                    />
                  )}
                  {visibleFileChanges && (
                    <Info
                      label="ファイル変更"
                      value={visibleFileChanges}
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
          </section>
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

function HistoryAgentLogs({
  agents,
  turns,
  events,
}: {
  agents: AgentConfig[];
  turns: TurnResult[];
  events: StreamEvent[];
}) {
  if (agents.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-sm text-[var(--color-fg-subtle)]">
        エージェントがありません。
      </div>
    );
  }

  return (
    <div className="grid gap-2 xl:grid-cols-2">
      {agents.map((agent) => {
        const agentTurns = turns.filter((turn) => turn.agent_id === agent.id);
        const agentEvents = events.filter((event) => {
          if (event.type === "turn_started") return event.agent_id === agent.id;
          if (event.type === "turn_completed") return event.turn.agent_id === agent.id;
          return false;
        });
        const latestTurn = agentTurns[agentTurns.length - 1];
        return (
          <div
            key={agent.id}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--color-fg)]">
                  {agent.name}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  {ROLE_LABEL[agent.org_role]} · {PROVIDER_LABEL[agent.provider]}
                </div>
              </div>
              <div className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-fg-muted)]">
                {agentTurns.length} turns
              </div>
            </div>
            <div className="mt-3 text-xs leading-relaxed text-[var(--color-fg-muted)]">
              {latestTurn ? (
                latestTurn.error ? (
                  <div className="text-red-300">{latestTurn.error}</div>
                ) : (
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans">
                    {truncateForCard(latestTurn.output || "出力はありません。")}
                  </pre>
                )
              ) : (
                "このエージェントの出力はありません。"
              )}
            </div>
            {agentEvents.length > 0 && (
              <details className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                <summary className="cursor-pointer text-[10px] font-semibold text-[var(--color-fg-muted)]">
                  raw events
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-[var(--color-fg-subtle)]">
                  {JSON.stringify(agentEvents, null, 2)}
                </pre>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgentProgressCards({
  agents,
  turns,
  events,
}: {
  agents: AgentConfig[];
  turns: TurnResult[];
  events: StreamEvent[];
}) {
  if (agents.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-fg-subtle)]">
        エージェントが選ばれていません。
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {agents.map((agent) => {
        const agentTurns = turns.filter((turn) => turn.agent_id === agent.id);
        const latestTurn = agentTurns[agentTurns.length - 1];
        const status = getAgentStatus(agent.id, turns, events);
        const workDescription = getAgentWorkDescription(agent, status, latestTurn);
        return (
          <div
            key={agent.id}
            className={clsx(
              "rounded-md border p-3",
              status === "running"
                ? "border-sky-500/40 bg-sky-500/10"
                : "border-[var(--color-border)] bg-[var(--color-surface-2)]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--color-fg)]">
                  {agent.name}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  {ROLE_LABEL[agent.org_role]} · {PROVIDER_LABEL[agent.provider]}
                </div>
              </div>
              <AgentStatusBadge status={status} />
            </div>

            <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs leading-relaxed text-[var(--color-fg-muted)]">
              <div className="mb-1 font-semibold text-[var(--color-fg)]">現在の作業</div>
              {workDescription}
            </div>

            <div className="mt-3 grid gap-2 text-xs text-[var(--color-fg-muted)] md:grid-cols-2">
              <div className="rounded-md border border-[var(--color-border)] px-2 py-1.5">
                出力: {agentTurns.length}件
              </div>
              <div className="rounded-md border border-[var(--color-border)] px-2 py-1.5">
                依存: {agent.depends_on.length > 0 ? agent.depends_on.join(", ") : "なし"}
              </div>
            </div>

            {agent.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {agent.skills.slice(0, 5).map((skill) => (
                  <span
                    key={skill}
                    className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-subtle)]"
                  >
                    {skill}
                  </span>
                ))}
                {agent.skills.length > 5 && (
                  <span className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-subtle)]">
                    +{agent.skills.length - 5}
                  </span>
                )}
              </div>
            )}

            {latestTurn && (
              <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  latest output
                </div>
                {latestTurn.error ? (
                  <div className="text-xs text-red-300">{latestTurn.error}</div>
                ) : (
                  <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--color-fg-muted)]">
                    {latestTurn.output || "出力はありません。"}
                  </pre>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getAgentWorkDescription(
  agent: AgentConfig,
  status: AgentRunStatus,
  latestTurn?: TurnResult,
) {
  if (status === "running") {
    return `${ROLE_LABEL[agent.org_role]}の観点で作業中です。依頼内容と他エージェントの出力を確認しています。`;
  }
  if (status === "completed") {
    return latestTurn?.file_changes
      ? "出力とファイル変更を完了しました。詳細は latest output と file changes を確認できます。"
      : "担当観点での出力を完了しました。";
  }
  if (status === "error") {
    return "実行中にエラーが発生しました。latest output に詳細を表示します。";
  }
  if (agent.depends_on.length > 0) {
    return `${agent.depends_on.join(", ")} の出力を待っています。`;
  }
  return "開始待ちです。実行順が来ると、このカードが実行中に変わります。";
}

function truncateForCard(value: string, maxLength = 420) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}\n...`;
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
