// STRAND — Workspace. Management list | center subwork edit/progress/history | logs inspector.
// Presentation migrated to the strand design system; behavior preserved verbatim.
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  ClipboardList,
  Download,
  FileDiff,
  Loader2,
  MessageSquareText,
  Play,
  RefreshCcw,
  Square,
  Users,
  X,
} from "lucide-react";
import { StrandShell } from "../components/strand/Chrome";
import { Btn, Dot, Icon, Panel, Pill } from "../components/strand/primitives";
import { inputStyle, selectStyle, textareaStyle } from "../components/strand/formStyles";
import { EmptyState, Field, InlineAlert } from "../components/refine/primitives";
import { buildBaseVersion, isDuplicateVersion } from "../lib/versions";
import {
  codeContextToText,
  downloadTextFile,
  markdownBlock,
  sanitizeFileNamePart,
  statusTone,
  teamLabel,
  textToCodeContextItems,
} from "../lib/refine";
import { useToast } from "../components/ui/Toast";
import { api } from "../api/client";
import { formatDuration, PROVIDER_LABEL, ROLE_LABEL } from "../lib/format";
import { useApp } from "../state/store";
import type { RunState } from "../state/store";
import type {
  AgentConfig,
  CodeContext,
  KnowledgeKind,
  KnowledgeResource,
  ManagedRequest,
  ManagedRequestStatus,
  ProviderHealth,
  ProviderKind,
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
  status: "completed" | "running" | "failed" | "not_started";
  createdAt?: string;
  input: string;
  result: string;
  error?: string;
  diff?: string;
  fileChanges?: string;
  isCurrent?: boolean;
  isEditable?: boolean;
  parentId?: string;
  reviewFeedback?: VerificationFeedback;
  version?: WorkspaceVersion;
}

interface SubworkExportPayload {
  schema_version: 1;
  exported_at: string;
  work: {
    id: string;
    title: string;
  };
  subwork: {
    id: string;
    label: string;
    status: SubWorkView["status"];
    created_at?: string;
    parent_id?: string;
    version_no?: number;
    review_feedback?: VerificationFeedback;
  };
  input: string;
  request: ManagedRequest["request"];
  agents: AgentConfig[];
  agent_turns: TurnResult[];
  stream_events: StreamEvent[];
  flow_json?: SubworkFlowJson;
  final_text?: string;
  diff?: string;
  file_changes?: string;
  error?: string;
}

interface WorkspaceExportPayload {
  schema_version: 1;
  exported_at: string;
  work: {
    id: string;
    title: string;
  };
  subworks: SubworkExportPayload[];
}

const cloneRequest = (value: ManagedRequest["request"]): ManagedRequest["request"] =>
  JSON.parse(JSON.stringify(value)) as ManagedRequest["request"];

const cloneAgentConfig = (agent: AgentConfig): AgentConfig => ({
  ...agent,
  skills: [...agent.skills],
  depends_on: [...agent.depends_on],
  research_sources: [...agent.research_sources],
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


const subWorkLabel = (versionNo: number) =>
  versionNo <= 1 ? "ワーク（初回）" : `サブワーク${versionNo}（議論${versionNo}）`;

const subWorkStatusLabel = (status: SubWorkView["status"]) => {
  if (status === "completed") return "終了";
  if (status === "running") return "実行中";
  if (status === "failed") return "エラー";
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

const buildSubworkMarkdown = (payload: SubworkExportPayload) => {
  const lines = [
    `# ${payload.work.title} / ${payload.subwork.label}`,
    "",
    `- exported_at: ${payload.exported_at}`,
    `- status: ${payload.subwork.status}`,
    payload.subwork.created_at ? `- created_at: ${payload.subwork.created_at}` : "",
    payload.subwork.version_no ? `- version_no: ${payload.subwork.version_no}` : "",
    "",
    "## 依頼内容",
    markdownBlock(payload.input),
    "",
  ].filter(Boolean);

  if (payload.subwork.review_feedback) {
    lines.push(
      "## ユーザーレビュー",
      `- kind: ${payload.subwork.review_feedback.kind}`,
      `- created_at: ${payload.subwork.review_feedback.created_at}`,
      markdownBlock(payload.subwork.review_feedback.comment),
      "",
    );
  }

  lines.push("## エージェント発言");
  if (payload.agent_turns.length === 0) {
    lines.push("_発言はありません。_", "");
  } else {
    payload.agent_turns.forEach((turn, index) => {
      lines.push(
        `### ${index + 1}. ${turn.agent_name} (${turn.org_role} / ${turn.provider})`,
        turn.error ? `**error:** ${turn.error}` : "",
        markdownBlock(turn.output || "出力はありません。"),
        turn.research_results?.length ? "#### research results" : "",
        turn.research_results?.length
          ? turn.research_results
              .map((item) =>
                [
                  `- ${item.url}`,
                  item.title ? `  - title: ${item.title}` : "",
                  item.snippet ? `  - snippet: ${item.snippet}` : "",
                  item.error ? `  - error: ${item.error}` : "",
                ]
                  .filter(Boolean)
                  .join("\n"),
              )
              .join("\n")
          : "",
        turn.file_changes ? "#### file changes" : "",
        turn.file_changes ? markdownBlock(turn.file_changes, "diff") : "",
        "",
      );
    });
  }

  lines.push("## 議論結果", markdownBlock(payload.final_text), "");
  if (payload.error) {
    lines.push("## エラー", markdownBlock(payload.error), "");
  }
  if (payload.diff || payload.file_changes) {
    lines.push("## diff / file changes", markdownBlock(payload.file_changes || payload.diff, "diff"), "");
  }

  lines.push("## stream_events", markdownBlock(JSON.stringify(payload.stream_events, null, 2), "json"));
  return lines.filter((line) => line !== "").join("\n");
};

const buildWorkspaceMarkdown = (payload: WorkspaceExportPayload) => [
  `# ${payload.work.title} / 全サブワーク議論ログ`,
  "",
  `- exported_at: ${payload.exported_at}`,
  `- subworks: ${payload.subworks.length}`,
  "",
  ...payload.subworks.flatMap((subwork, index) => [
    index === 0 ? "" : "\n---\n",
    buildSubworkMarkdown(subwork),
  ]),
].join("\n");

const collaborationStyle = (value: ManagedRequest["request"]) => {
  const text = `${value.objective}\n${value.global_instruction}`.toLowerCase();
  if (text.includes("ディベート") || text.includes("debate")) return "debate";
  if (text.includes("議論") || text.includes("ディスカッション") || text.includes("discussion")) {
    return "discussion";
  }
  return "";
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
  const [inspectorTab, setInspectorTab] = useState<"run" | "output" | "context">("run");
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
  const { notify } = useToast();
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
  const versionSubWorks: SubWorkView[] = [...versions]
    .sort((a, b) => a.version_no - b.version_no)
    .map((version) => ({
      id: version.id,
      label: subWorkLabel(version.version_no),
      status: "completed" as const,
      createdAt: version.created_at,
      input: version.request.source_text,
      result: version.final_text || version.diff || version.file_changes || "",
      error: version.error,
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
        status:
          run.status === "running"
            ? "running"
            : run.status === "failed"
              ? "failed"
              : "not_started",
        createdAt: run.startedAt ? new Date(run.startedAt).toISOString() : undefined,
        input: request.source_text,
        result: currentRunHasResult ? run.finalText ?? "" : "",
        error: run.error,
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
  const activeCollaborationStyle = collaborationStyle(activeRequest);
  const progressTabLabel = activeCollaborationStyle ? "議論ログ" : "エージェント進捗";
  const progressHeaderLabel = activeCollaborationStyle ? "議論タイムライン" : "リアルタイム出力";
  const agentCardsLabel = activeCollaborationStyle ? "発言者と反応状況" : "エージェント作業状況";
  const outputPanelLabel = activeCollaborationStyle
    ? "議論結果（ユーザー確認前）"
    : "最終回答";
  const emptyOutputMessage = activeCollaborationStyle
    ? "議論が完了すると、ここにユーザー確認前の議論結果が表示されます。"
    : "実行が完了すると、ここに最終回答が表示されます。";
  const activeResult = selectedSubWork?.isEditable && currentSubWork
    ? currentSubWork.result
    : selectedSubWork?.result ?? "";
  const activeError = selectedSubWork?.isEditable && currentSubWork
    ? currentSubWork.error
    : selectedSubWork?.error;
  const activeDiff = selectedSubWork?.isEditable && currentSubWork ? currentSubWork.diff : selectedSubWork?.diff;
  const activeFileChanges = selectedSubWork?.isEditable && currentSubWork
    ? currentSubWork.fileChanges
    : selectedSubWork?.fileChanges;
  const activeOutputText = activeResult || (selectedSubWork?.isCurrent ? visibleFinalText : "");
  const activeRunTurns = selectedSubWork?.isCurrent
    ? run.turns
    : selectedSubWork?.version?.agent_turns ?? [];
  const activeRunEvents = selectedSubWork?.isCurrent
    ? run.events
    : selectedSubWork?.version?.stream_events ?? [];
  const activeRunState: RunState = selectedSubWork?.isCurrent
    ? run
    : {
        status:
          selectedSubWork?.status === "running"
            ? "running"
            : selectedSubWork?.status === "failed"
              ? "failed"
              : selectedSubWork?.status === "completed"
                ? "completed"
                : "idle",
        events: activeRunEvents,
        turns: activeRunTurns,
        currentRound: 0,
        error: activeError,
        finalText: activeResult || undefined,
        diff: activeDiff,
        fileChanges: activeFileChanges,
        startedAt: selectedSubWork?.version?.run_started_at
          ? Date.parse(selectedSubWork.version.run_started_at)
          : selectedSubWork?.createdAt
            ? Date.parse(selectedSubWork.createdAt)
            : undefined,
        endedAt: selectedSubWork?.version?.run_ended_at
          ? Date.parse(selectedSubWork.version.run_ended_at)
          : undefined,
      };
  const progressSteps = getProgressSteps(activeRunState);
  const liveNotes = getLiveNotes(activeRunState);
  const displayedProgressSteps = activeCollaborationStyle
    ? progressSteps.map((step) =>
        step.id === "finalizing"
          ? { ...step, label: "議論結果をまとめています" }
          : step,
      )
    : progressSteps;
  const displayedLiveNotes = activeCollaborationStyle
    ? liveNotes.map((note) =>
        note === "AIチームの最終回答が完成しました。"
          ? "AIチームの議論結果がまとまりました。ユーザー確認前の内容です。"
          : note,
      )
    : liveNotes;
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
  const buildSubworkExportPayload = (subWork: SubWorkView): SubworkExportPayload => {
    const isCurrent = Boolean(subWork.isCurrent);
    const subRequest = subWork.version?.request ?? request;
    const subTurns = isCurrent ? run.turns : subWork.version?.agent_turns ?? [];
    const subEvents = isCurrent ? run.events : subWork.version?.stream_events ?? [];
    const subFinalText = isCurrent ? activeOutputText : subWork.result;
    const subDiff = isCurrent ? activeDiff : subWork.diff;
    const subFileChanges = isCurrent ? activeFileChanges : subWork.fileChanges;
    const subError = isCurrent ? activeError : subWork.error;
    const versionNo =
      subWork.version?.version_no ??
      Math.max(1, subWorks.findIndex((item) => item.id === subWork.id) + 1);
    const createdAt = subWork.createdAt ?? new Date().toISOString();
    const runStartedAt = isCurrent
      ? run.startedAt
        ? new Date(run.startedAt).toISOString()
        : undefined
      : subWork.version?.run_started_at;
    const runEndedAt = isCurrent
      ? run.endedAt
        ? new Date(run.endedAt).toISOString()
        : undefined
      : subWork.version?.run_ended_at;
    const workId =
      selectedManagedRequest?.id ??
      selectedManagedRequestId ??
      localRequestIdRef.current ??
      "unsaved-work";
    const flowJson =
      subWork.version?.flow_json ??
      buildSubworkFlowJson({
        workId,
        subworkId: subWork.id,
        parentSubworkId: subWork.parentId,
        versionNo,
        title: subWork.label,
        createdAt,
        requestSnapshot: cloneRequest(subRequest),
        runStartedAt,
        runEndedAt,
        turns: subTurns,
        events: subEvents,
        finalText: subFinalText,
        diff: subDiff,
        fileChanges: subFileChanges,
      });

    return {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      work: {
        id: workId,
        title: activeRequestTitle,
      },
      subwork: {
        id: subWork.id,
        label: subWork.label,
        status: subWork.status,
        created_at: subWork.createdAt,
        parent_id: subWork.parentId,
        version_no: versionNo,
        review_feedback: subWork.reviewFeedback,
      },
      input: subWork.input,
      request: cloneRequest(subRequest),
      agents: subRequest.agents,
      agent_turns: subTurns,
      stream_events: subEvents,
      flow_json: flowJson,
      final_text: subFinalText,
      diff: subDiff,
      file_changes: subFileChanges,
      error: subError,
    };
  };
  const downloadSubwork = (subWork: SubWorkView | undefined, format: "json" | "md") => {
    if (!subWork) return;
    const payload = buildSubworkExportPayload(subWork);
    const baseName = [
      sanitizeFileNamePart(activeRequestTitle),
      sanitizeFileNamePart(subWork.label),
      format === "json" ? "debate-log" : "debate-log",
    ].join("-");
    if (format === "json") {
      downloadTextFile(
        `${baseName}.json`,
        JSON.stringify(payload, null, 2),
        "application/json",
      );
      return;
    }
    downloadTextFile(`${baseName}.md`, buildSubworkMarkdown(payload), "text/markdown");
  };
  const buildWorkspaceExportPayload = (): WorkspaceExportPayload => ({
    schema_version: 1,
    exported_at: new Date().toISOString(),
    work: {
      id:
        selectedManagedRequest?.id ??
        selectedManagedRequestId ??
        localRequestIdRef.current ??
        "unsaved-work",
      title: activeRequestTitle,
    },
    subworks: subWorks.map((subWork) => buildSubworkExportPayload(subWork)),
  });
  const downloadAllSubworks = (format: "json" | "md") => {
    if (subWorks.length === 0) return;
    const payload = buildWorkspaceExportPayload();
    const baseName = `${sanitizeFileNamePart(activeRequestTitle)}-all-debate-logs`;
    if (format === "json") {
      downloadTextFile(
        `${baseName}.json`,
        JSON.stringify(payload, null, 2),
        "application/json",
      );
      return;
    }
    downloadTextFile(`${baseName}.md`, buildWorkspaceMarkdown(payload), "text/markdown");
  };
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
      knowledge_context: [],
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
    const mergedFeedback =
      pendingReviewFeedback && !feedbackList.some((item) => item.id === pendingReviewFeedback.id)
        ? [pendingReviewFeedback, ...feedbackList]
        : feedbackList;
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
      verification_feedback: mergedFeedback,
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
      ...buildBaseVersion({ id, versionNo, title, createdAt, request: requestSnapshot, run }),
      parent_version_id: pendingParentSubWorkId,
      review_feedback: pendingReviewFeedback,
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
    };
  };

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
      notify({ kind: "error", title: "自動保存に失敗しました", description: message });
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
      notify({ kind: "error", title: "削除に失敗しました", description: message });
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
      notify({ kind: "success", title: "レビューを反映しました" });
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
    const continuationFinalText =
      [
        activeResult,
        selectedSubWork?.version?.final_text,
        selectedSubWork?.version?.file_changes,
        selectedSubWork?.version?.diff,
        selectedManagedRequest?.final_text,
        selectedManagedRequest?.file_changes,
        selectedManagedRequest?.diff,
      ].find((value) => value?.trim()) ?? "";
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
        finalText: continuationFinalText,
        feedback: result.feedback,
      }),
    };
    setPendingParentSubWorkId(parentId);
    setPendingReviewFeedback(result.feedback);
    setSelectedVersionId(CURRENT_SUBWORK_ID);
    updateRequest(nextRequest);
    setWorkMode("subwork");
    setContentMode("progress");
    setInspectorTab("run");
    setSaveMessage("フィードバックを反映して、AIチームの議論を再開します。");
    await startRun();
  };

  const runCurrentWork = async () => {
    setSelectedVersionId(CURRENT_SUBWORK_ID);
    setWorkMode("subwork");
    setContentMode("progress");
    setInspectorTab("run");
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
    const completed = run.status === "completed";
    void persistManagedRequestAuto({
      appendRunVersion: completed,
      clearPending: completed,
      resetRunAfter: completed,
    });
  }, [run.status, run.endedAt, run.startedAt, run.finalText, run.diff, run.fileChanges, run.error]);

  return (
    <StrandShell breadcrumb={["work", "workspace"]} mainStyle={{ display: "flex", overflow: "hidden" }}>
      <div
        className="workspace"
        style={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "minmax(320px,380px) minmax(560px,1fr) minmax(340px,400px)",
          gap: 0,
          background: "var(--paper)",
          overflow: "hidden",
        }}
      >
        <style>{"@keyframes ws-spin{to{transform:rotate(360deg)}}.workspace .spin{animation:ws-spin 0.8s linear infinite}"}</style>

        {/* LEFT — workspace management */}
        <aside
          style={{
            display: "flex",
            minWidth: 0,
            flexDirection: "column",
            borderRight: "1px solid var(--border)",
            background: "var(--paper)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              background: "var(--paper-2)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "var(--ink)", textTransform: "uppercase" }}>
                ワークスペース管理
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
                ワークを選びます。変更は自動保存されます。
              </div>
            </div>
            <ClipboardList style={{ width: 16, height: 16, flexShrink: 0, color: "var(--ink-3)" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 16 }}>
            <section
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                padding: 12,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="outline" size="sm" onClick={resetManagedRequest} style={{ flex: 1, justifyContent: "center" }}>
                  新規
                </Btn>
                <Btn
                  variant="outline"
                  size="sm"
                  disabled={!selectedManagedRequestId}
                  onClick={() => void deleteSelectedManagedRequest()}
                  style={{ flex: 1, justifyContent: "center", color: selectedManagedRequestId ? "var(--danger)" : "var(--ink-3)" }}
                >
                  削除
                </Btn>
              </div>
              {selectedManagedRequest && (
                <div style={{ borderRadius: 3, border: "1px solid var(--accent)", background: "var(--accent-soft)", padding: 8, fontSize: 11, color: "var(--ink-3)" }}>
                  編集中: <span style={{ fontWeight: 600, color: "var(--ink)" }}>{selectedManagedRequest.title}</span>
                </div>
              )}
              <Field label="ワークスペース名">
                <input
                  value={requestTitle}
                  placeholder="例: ログイン画面レビュー"
                  onChange={(event) => setRequestTitle(event.target.value)}
                  style={inputStyle()}
                />
              </Field>
              <Field label="状態">
                <select
                  value={requestStatus}
                  onChange={(event) => setRequestStatus(event.target.value as ManagedRequestStatus)}
                  className="mono"
                  style={selectStyle()}
                >
                  <option value="draft">下書き</option>
                  <option value="running">実行中</option>
                  <option value="completed">完了</option>
                  <option value="paused">保留</option>
                </select>
              </Field>
              <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 8, fontSize: 11, color: "var(--ink-3)" }}>
                入力・設定・実行結果は自動保存されます。
              </div>
              {saveMessage && (
                <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 8, fontSize: 11, color: "var(--ink-3)" }}>
                  {saveMessage}
                </div>
              )}
            </section>

            <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>ワークスペース一覧</div>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>
                  {filteredWorkspaces.length}/{managedRequests.length}
                </span>
              </div>
              <input
                value={workspaceQuery}
                placeholder="名前・状態・依頼内容で検索"
                onChange={(event) => setWorkspaceQuery(event.target.value)}
                style={inputStyle()}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
                {managedRequests.length === 0 && (
                  <EmptyState title="ワークスペースはまだありません。" />
                )}
                {managedRequests.length > 0 && filteredWorkspaces.length === 0 && (
                  <EmptyState title="条件に一致するワークスペースはありません。" />
                )}
                {filteredWorkspaces.map((item) => {
                  const sel = selectedManagedRequestId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => loadManagedRequest(item)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: 12,
                        borderRadius: 3,
                        border: "1px solid var(--border)",
                        borderLeft: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: sel ? "var(--surface)" : "var(--surface-2)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.title}
                        </div>
                        <Pill tone={statusTone(item.status)}>{STATUS_LABEL[item.status] ?? item.status}</Pill>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          lineHeight: 1.5,
                          color: "var(--ink-3)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.request.source_text || "依頼内容なし"}
                      </div>
                      <div className="mono" style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 10, color: "var(--ink-4)" }}>
                        <span>{item.versions?.length ?? 0} versions</span>
                        <span>{new Date(item.updated_at).toLocaleString("ja-JP")}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </aside>

        {/* CENTER — content */}
        <main
          style={{
            display: "flex",
            minWidth: 0,
            flexDirection: "column",
            borderRight: "1px solid var(--border)",
            background: "var(--paper)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              background: "var(--paper-2)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "var(--ink)", textTransform: "uppercase" }}>
                コンテンツ
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
                {workMode === "history"
                  ? "ワーク全体のサブワーク履歴とエージェントログ"
                  : contentMode === "edit"
                    ? `${selectedSubWork?.label ?? "サブワーク"} · 作成・編集`
                    : `${selectedSubWork?.label ?? "サブワーク"} · ${activeExecutionEnabledAgents.length}人のAIチーム · ${formatDuration(activeRunState.startedAt, activeRunState.endedAt)}`}
              </div>
            </div>
            {workMode === "subwork" && contentMode === "progress" ? (
              <Activity style={{ width: 16, height: 16, flexShrink: 0, color: "var(--ink-3)" }} />
            ) : (
              <Users style={{ width: 16, height: 16, flexShrink: 0, color: "var(--ink-3)" }} />
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                marginBottom: 16,
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: 8,
              }}
            >
              <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>サブワーク</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>
                  {subWorks.length}件
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {subWorks.map((subWork) => {
                  const sel = workMode === "subwork" && selectedSubWork?.id === subWork.id;
                  return (
                    <button
                      key={subWork.id}
                      type="button"
                      onClick={() => {
                        setSelectedVersionId(subWork.id);
                        setWorkMode("subwork");
                        setContentMode("edit");
                      }}
                      style={{
                        minWidth: 176,
                        borderRadius: 3,
                        border: "1px solid var(--border)",
                        borderLeft: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: sel ? "var(--surface-2)" : "var(--surface)",
                        padding: "8px 12px",
                        textAlign: "left",
                        fontSize: 11,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "var(--ink)" }}>{subWork.label}</div>
                      <div className="mono" style={{ marginTop: 4, fontSize: 10, color: "var(--ink-4)" }}>
                        {subWorkStatusLabel(subWork.status)}
                        {subWork.createdAt
                          ? ` · ${new Date(subWork.createdAt).toLocaleString("ja-JP")}`
                          : ""}
                      </div>
                      {subWork.parentId && (
                        <div style={{ marginTop: 4, fontSize: 10, color: "var(--info)" }}>レビューから作成</div>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setWorkMode("history")}
                  style={{
                    minWidth: 176,
                    borderRadius: 3,
                    border: "1px solid var(--border)",
                    borderLeft: workMode === "history" ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: workMode === "history" ? "var(--surface-2)" : "var(--surface)",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontSize: 11,
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--ink)" }}>履歴</div>
                  <div className="mono" style={{ marginTop: 4, fontSize: 10, color: "var(--ink-4)" }}>
                    サブワーク概要 / エージェントログ
                  </div>
                </button>
              </div>
            </div>

            {workMode === "subwork" && (
              <div
                role="tablist"
                style={{
                  marginBottom: 16,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 4,
                  borderRadius: 3,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  padding: 4,
                }}
              >
                {([
                  ["edit", "作成・編集"],
                  ["progress", progressTabLabel],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setContentMode(mode as ContentMode)}
                    className="mono"
                    style={{
                      borderRadius: 3,
                      padding: "8px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      background: contentMode === mode ? "var(--accent)" : "transparent",
                      color: contentMode === mode ? "var(--accent-ink)" : "var(--ink-2)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {workMode === "subwork" && contentMode === "edit" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="1. 何をしたいですか？">
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
                    {REQUEST_PRESETS.map((item) => {
                      const sel = presetId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!activeCanEdit}
                          onClick={() => activeCanEdit && selectPreset(item.id)}
                          style={{
                            borderRadius: 3,
                            border: "1px solid var(--border)",
                            borderLeft: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                            background: sel ? "var(--surface)" : "var(--surface-2)",
                            padding: 12,
                            textAlign: "left",
                            cursor: activeCanEdit ? "pointer" : "default",
                            opacity: activeCanEdit ? 1 : 0.6,
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{item.label}</div>
                          <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5, color: "var(--ink-3)" }}>
                            {item.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="2. 元になる内容を貼ってください">
                  <textarea
                    rows={10}
                    value={activeRequest.source_text}
                    placeholder="文章、相談内容、要件、エラー内容、コードの説明などを貼ってください。"
                    readOnly={!activeCanEdit}
                    onChange={(event) =>
                      activeCanEdit && updateRequest({ source_text: event.target.value })
                    }
                    style={textareaStyle(!activeCanEdit)}
                  />
                </Field>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
                  <Field label="3. どんな結果がほしいですか？">
                    {activeCanEdit ? (
                      <select
                        value={request.objective || preset.defaultObjective}
                        onChange={(event) => updateRequest({ objective: event.target.value })}
                        style={selectStyle()}
                      >
                        <option value={preset.defaultObjective}>
                          {preset.defaultObjective || "AIチームに任せる"}
                        </option>
                        {preset.resultOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input value={activeRequest.objective || "AIチームに任せる"} readOnly style={inputStyle(true)} />
                    )}
                  </Field>
                  <Field label="補足. 誰に向けた内容ですか？">
                    <input
                      value={activeRequest.global_instruction}
                      placeholder="例: 初心者向け、開発者向け、顧客向け"
                      readOnly={!activeCanEdit}
                      onChange={(event) =>
                        activeCanEdit && updateRequest({ global_instruction: event.target.value })
                      }
                      style={inputStyle(!activeCanEdit)}
                    />
                  </Field>
                </div>

                <KnowledgeResources
                  selected={activeRequest.knowledge_context ?? []}
                  disabled={!activeCanEdit}
                  onChange={(knowledge_context) => activeCanEdit && updateRequest({ knowledge_context })}
                />

                <Field label="4. 結果">
                  <div
                    style={{
                      minHeight: 96,
                      borderRadius: 3,
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      padding: 12,
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "var(--ink-3)",
                    }}
                  >
                    {activeError ? (
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          borderRadius: 3,
                          border: "1px solid var(--danger)",
                          background: "var(--danger-bg)",
                          padding: 12,
                          fontFamily: "var(--strand-font-sans)",
                          color: "var(--danger)",
                          margin: 0,
                        }}
                      >
                        {activeError}
                      </pre>
                    ) : activeResult ? (
                      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", margin: 0 }}>
                        {activeResult}
                      </pre>
                    ) : (
                      "まだ結果はありません。実行後にここへ表示されます。"
                    )}
                  </div>
                  {(activeDiff || activeFileChanges) && (
                    <details style={{ marginTop: 8, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 8 }}>
                      <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--ink-3)" }}>
                        diff / file changes
                      </summary>
                      <pre className="mono" style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 11, color: "var(--ink-3)", margin: 0 }}>
                        {activeFileChanges || activeDiff}
                      </pre>
                    </details>
                  )}
                </Field>

                <div style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)" }}>
                    <Field label={activeCanEdit ? "このサブワークで実行するチーム" : "このサブワークで実行したチーム"}>
                      {activeCanEdit ? (
                        <select
                          value={selectedTeamTemplateId}
                          onChange={(event) => applyTeamTemplate(event.target.value)}
                          style={selectStyle()}
                        >
                          <option value="">ワーク内チームを使う（下に内訳表示）</option>
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {teamLabel(template)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input value="保存済みチーム構成" readOnly style={inputStyle(true)} />
                      )}
                    </Field>
                    <Field label="作業モード">
                      <select
                        value={activeRequest.workflow_mode}
                        disabled={!activeCanEdit}
                        onChange={(event) =>
                          updateRequest({ workflow_mode: event.target.value as "writing" | "coding" })
                        }
                        style={selectStyle(!activeCanEdit)}
                      >
                        <option value="writing">writing</option>
                        <option value="coding">coding</option>
                      </select>
                    </Field>
                    <Field label="進め方">
                      <select
                        value={activeRequest.orchestration_mode}
                        disabled={!activeCanEdit}
                        onChange={(event) =>
                          updateRequest({
                            orchestration_mode: event.target.value as typeof request.orchestration_mode,
                          })
                        }
                        style={selectStyle(!activeCanEdit)}
                      >
                        <option value="role_based">role_based</option>
                        <option value="dependency_graph">dependency_graph</option>
                        <option value="sequential">sequential</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 12 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                          {activeExecutionTeamName}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
                          {activeExecutionTeamSource}
                        </div>
                      </div>
                      <div className="mono" style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "4px 8px", fontSize: 11, color: "var(--ink-3)" }}>
                        {activeExecutionEnabledAgents.length}/{activeExecutionAgents.length}人が有効
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", fontSize: 11, color: "var(--ink-3)" }}>
                      <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "6px 8px" }}>
                        ロール: {activeExecutionRoleSummary}
                      </div>
                      <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "6px 8px" }}>
                        プロバイダー: {activeExecutionProviderSummary}
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {activeExecutionPreviewAgents.length > 0 ? (
                        activeExecutionPreviewAgents.map((agent) => {
                          const disabledAgent = agent.enabled === false;
                          return (
                            <span
                              key={agent.id}
                              title={`${agent.name} / ${ROLE_LABEL[agent.org_role]} / ${PROVIDER_LABEL[agent.provider]}`}
                              style={{
                                borderRadius: 3,
                                border: disabledAgent ? "1px solid var(--border)" : "1px solid var(--agent)",
                                background: disabledAgent ? "transparent" : "var(--agent-bg)",
                                color: disabledAgent ? "var(--ink-4)" : "var(--agent-deep)",
                                padding: "4px 8px",
                                fontSize: 11,
                              }}
                            >
                              {agent.name || agent.id} · {ROLE_LABEL[agent.org_role]}
                              {disabledAgent ? " · 無効" : ""}
                            </span>
                          );
                        })
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                          エージェントが設定されていません。
                        </span>
                      )}
                      {activeExecutionHiddenAgentCount > 0 && (
                        <span style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "4px 8px", fontSize: 11, color: "var(--ink-3)" }}>
                          +{activeExecutionHiddenAgentCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      marginTop: 12,
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderRadius: 3,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      padding: "8px 12px",
                      fontSize: 13,
                      color: "var(--ink-2)",
                    }}
                    onClick={() => setCodingOpen((open) => !open)}
                  >
                    コーディング用コンテキスト
                    <ChevronDown
                      style={{ width: 16, height: 16, transition: "transform 0.15s", transform: codingOpen ? "rotate(180deg)" : undefined }}
                    />
                  </button>
                  {(codingOpen || activeRequest.workflow_mode === "coding") && (
                    <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
                      <Field label="working_directory">
                        <input
                          value={activeRequest.code_context.working_directory}
                          placeholder="/path/to/repo"
                          readOnly={!activeCanEdit}
                          onChange={(event) =>
                            activeCanEdit && updateCodeContext({ working_directory: event.target.value })
                          }
                          className="mono"
                          style={{ ...inputStyle(!activeCanEdit), fontFamily: "var(--strand-font-mono)" }}
                        />
                      </Field>
                      <Field label="test_command">
                        <input
                          value={activeRequest.code_context.test_command}
                          placeholder="npm run build"
                          readOnly={!activeCanEdit}
                          onChange={(event) =>
                            activeCanEdit && updateCodeContext({ test_command: event.target.value })
                          }
                          className="mono"
                          style={{ ...inputStyle(!activeCanEdit), fontFamily: "var(--strand-font-mono)" }}
                        />
                      </Field>
                      <Field label="tech_stack">
                        <input
                          value={activeRequest.code_context.tech_stack}
                          placeholder="React / TypeScript / FastAPI"
                          readOnly={!activeCanEdit}
                          onChange={(event) =>
                            activeCanEdit && updateCodeContext({ tech_stack: event.target.value })
                          }
                          style={inputStyle(!activeCanEdit)}
                        />
                      </Field>
                      <Field label="target_paths">
                        <textarea
                          rows={3}
                          value={codeContextToText(activeRequest.code_context.target_paths)}
                          placeholder="app/web/src/screens/Workspace.tsx"
                          readOnly={!activeCanEdit}
                          onChange={(event) =>
                            activeCanEdit &&
                            updateCodeContext({ target_paths: textToCodeContextItems(event.target.value) })
                          }
                          className="mono"
                          style={{ ...textareaStyle(!activeCanEdit), fontFamily: "var(--strand-font-mono)" }}
                        />
                      </Field>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <Field label="acceptance_criteria">
                          <textarea
                            rows={3}
                            value={activeRequest.code_context.acceptance_criteria}
                            placeholder="完了条件、UI要件、避けたい変更"
                            readOnly={!activeCanEdit}
                            onChange={(event) =>
                              activeCanEdit && updateCodeContext({ acceptance_criteria: event.target.value })
                            }
                            style={textareaStyle(!activeCanEdit)}
                          />
                        </Field>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: 3,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    padding: "8px 12px",
                    fontSize: 13,
                    color: "var(--ink-2)",
                  }}
                  onClick={() => setDetailsOpen((open) => !open)}
                >
                  追加で伝えたいこと
                  <ChevronDown
                    style={{ width: 16, height: 16, transition: "transform 0.15s", transform: detailsOpen ? "rotate(180deg)" : undefined }}
                  />
                </button>
                {detailsOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}>
                    <Field label="AIチームへの追加指示">
                      <textarea
                        rows={4}
                        value={activeRequest.global_instruction}
                        placeholder="口調、制約、必ず見てほしい観点など"
                        readOnly={!activeCanEdit}
                        onChange={(event) =>
                          activeCanEdit && updateRequest({ global_instruction: event.target.value })
                        }
                        style={textareaStyle(!activeCanEdit)}
                      />
                    </Field>
                  </div>
                )}

                {activeResult && !activeError && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <Field label={reviewLabel}>
                        {activeReviewText && (
                          <div style={{ marginBottom: 8, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 8, fontSize: 11, lineHeight: 1.6, color: "var(--ink-3)" }}>
                            前回レビュー: {activeReviewText}
                          </div>
                        )}
                        <textarea
                          rows={5}
                          value={feedbackText}
                          placeholder="例: まことみけんの意見交換が見られない。ちゃんと会話して"
                          onChange={(event) => setFeedbackText(event.target.value)}
                          style={textareaStyle()}
                        />
                      </Field>
                      <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}>
                        <Field label="レビューを実行するチーム">
                          <select
                            value={selectedTeamTemplateId}
                            disabled={run.status === "running"}
                            onChange={(event) => applyTeamTemplate(event.target.value)}
                            style={selectStyle(run.status === "running")}
                          >
                            <option value="">ワーク内チームを使う（下に内訳表示）</option>
                            {templates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {teamLabel(template)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <div style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 12 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                                {currentTeamName}
                              </div>
                              <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
                                {currentTeamSource}
                              </div>
                            </div>
                            <div className="mono" style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "4px 8px", fontSize: 11, color: "var(--ink-3)" }}>
                              {currentTeamEnabledAgents.length}/{currentTeamAgents.length}人が有効
                            </div>
                          </div>
                          <div style={{ marginTop: 12, display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", fontSize: 11, color: "var(--ink-3)" }}>
                            <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "6px 8px" }}>
                              ロール: {currentTeamRoleSummary}
                            </div>
                            <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "6px 8px" }}>
                              プロバイダー: {currentTeamProviderSummary}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Btn
                      variant="solid"
                      tone="accent"
                      disabled={run.status === "running" || !feedbackText.trim()}
                      onClick={() => void restartDiscussionWithFeedback()}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      <Play style={{ width: 14, height: 14 }} />
                      レビューを反映して議論
                    </Btn>
                    {nextLinkedSubWorks.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 11 }}>
                        <span style={{ color: "var(--ink-4)" }}>次のサブワーク:</span>
                        {nextLinkedSubWorks.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "4px 8px", color: "var(--info)" }}
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    {run.status === "running" ? (
                      <Btn
                        variant="solid"
                        onClick={stopRun}
                        style={{ justifyContent: "center", background: "var(--danger)", borderColor: "var(--danger)", color: "white" }}
                      >
                        <Square style={{ width: 14, height: 14 }} />
                        停止する
                      </Btn>
                    ) : (
                      <Btn
                        variant="solid"
                        tone="accent"
                        disabled={!canStart}
                        onClick={() => void runCurrentWork()}
                        style={{ justifyContent: "center", opacity: canStart ? 1 : 0.5 }}
                      >
                        <Play style={{ width: 14, height: 14 }} />
                        このサブワークを実行
                      </Btn>
                    )}
                  </div>
                )}
                {activeCanEdit && (
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    変更は自動保存されます。
                  </div>
                )}
                {!activeCanEdit && (
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    過去のサブワークを表示中です。内容は編集できません。必要ならレビューから次のサブワークを作成できます。
                  </div>
                )}
                {!canStart && <div style={{ fontSize: 11, color: "var(--warn)" }}>{missingReason}</div>}
              </div>
            )}

            {workMode === "subwork" && contentMode === "progress" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                      {selectedSubWork?.label ?? "サブワーク"} の議論ログ
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
                      エージェント発言、イベント、議論結果を保存用に書き出します。
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => downloadSubwork(selectedSubWork, "json")}
                      disabled={!selectedSubWork}
                    >
                      <Download style={{ width: 14, height: 14 }} />
                      JSON
                    </Btn>
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => downloadSubwork(selectedSubWork, "md")}
                      disabled={!selectedSubWork}
                    >
                      <Download style={{ width: 14, height: 14 }} />
                      Markdown
                    </Btn>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                  {displayedProgressSteps.map((step) => {
                    const palette =
                      step.state === "done"
                        ? { fg: "var(--ok)", bg: "var(--ok-bg)", bd: "var(--ok)" }
                        : step.state === "active"
                          ? { fg: "var(--info)", bg: "var(--info-bg)", bd: "var(--info)" }
                          : step.state === "failed"
                            ? { fg: "var(--danger)", bg: "var(--danger-bg)", bd: "var(--danger)" }
                            : { fg: "var(--ink-3)", bg: "var(--surface-2)", bd: "var(--border)" };
                    return (
                      <div
                        key={step.id}
                        style={{
                          display: "flex",
                          minHeight: 40,
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          borderRadius: 3,
                          border: `1px solid ${palette.bd}`,
                          background: palette.bg,
                          color: palette.fg,
                          padding: "8px 12px",
                          fontSize: 12,
                        }}
                      >
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.label}</span>
                        {step.state === "active" && (
                          <Loader2 style={{ width: 16, height: 16, flexShrink: 0, color: "var(--info)" }} className="spin" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{agentCardsLabel}</h3>
                  <div style={{ marginBottom: 8 }}>
                    <ProviderHealthStrip
                      providers={activeExecutionEnabledAgents.map((agent) => agent.provider)}
                      compact
                    />
                  </div>
                  <AgentProgressCards
                    agents={activeExecutionEnabledAgents}
                    turns={activeRunTurns}
                    events={activeRunEvents}
                  />
                </div>
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{progressHeaderLabel}</h3>
                  <Conversation
                    agents={activeExecutionEnabledAgents}
                    turns={activeRunTurns}
                    events={activeRunEvents}
                  />
                </div>
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>ライブメモ</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {displayedLiveNotes.map((note, index) => (
                      <div
                        key={`${note}-${index}`}
                        style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12, fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)" }}
                      >
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 16 }}>
                  <h3 style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{outputPanelLabel}</h3>
                  {activeOutputText ? (
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink)", margin: 0 }}>
                      {activeOutputText}
                    </pre>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {emptyOutputMessage}
                    </div>
                  )}
                </div>
                <Btn variant="ghost" onClick={resetRun} style={{ width: "100%", justifyContent: "center" }}>
                  <RefreshCcw style={{ width: 14, height: 14 }} />
                  実行結果をリセット
                </Btn>
              </div>
            )}

            {workMode === "history" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <section style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <Info label="現在のWS" value={activeRequestTitle} />
                    <Info label="サブワーク" value={`${subWorks.length}件`} />
                    <Info label="履歴化済み結果" value={`${versionSubWorks.length}件`} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 8 }}>
                    <span style={{ padding: "0 4px", fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>
                      一括ダウンロード
                    </span>
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAllSubworks("json")}
                      disabled={subWorks.length === 0}
                    >
                      <Download style={{ width: 14, height: 14 }} />
                      JSON
                    </Btn>
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAllSubworks("md")}
                      disabled={subWorks.length === 0}
                    >
                      <Download style={{ width: 14, height: 14 }} />
                      Markdown
                    </Btn>
                  </div>
                </section>
                {subWorks.length === 0 ? (
                  <EmptyState title="サブワークはまだありません。実行後に自動で初回ワークとして残ります。" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                          style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}
                        >
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                                {subWork.label}
                              </div>
                              <div className="mono" style={{ marginTop: 4, fontSize: 10, color: "var(--ink-4)" }}>
                                {subWorkStatusLabel(subWork.status)}
                                {subWork.createdAt
                                  ? ` · ${new Date(subWork.createdAt).toLocaleString("ja-JP")}`
                                  : ""}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              <Btn
                                variant="outline"
                                size="sm"
                                onClick={() => downloadSubwork(subWork, "json")}
                              >
                                <Download style={{ width: 14, height: 14 }} />
                                JSON
                              </Btn>
                              <Btn
                                variant="outline"
                                size="sm"
                                onClick={() => downloadSubwork(subWork, "md")}
                              >
                                <Download style={{ width: 14, height: 14 }} />
                                Markdown
                              </Btn>
                              {subWork.version && (
                                <Btn
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => restoreVersionRequest(subWork.version!)}
                                >
                                  依頼に戻す
                                </Btn>
                              )}
                              <Btn
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedVersionId(subWork.id);
                                  setWorkMode("subwork");
                                  setContentMode("edit");
                                }}
                              >
                                このサブワークを開く
                              </Btn>
                            </div>
                          </div>
                          <div style={{ marginTop: 12, display: "grid", gap: 8, gridTemplateColumns: "repeat(3, 1fr)", fontSize: 11, color: "var(--ink-3)" }}>
                            <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: "6px 8px" }}>
                              エージェント: {historyAgents.length}人
                            </div>
                            <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: "6px 8px" }}>
                              出力: {historyTurns.length}件
                            </div>
                            <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: "6px 8px" }}>
                              ログ: {historyEvents.length}件
                            </div>
                          </div>
                          {subWork.version?.flow_json && (
                            <details style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 12 }}>
                              <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
                                flow_json
                              </summary>
                              <pre className="mono" style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 11, lineHeight: 1.6, color: "var(--ink-3)", margin: 0 }}>
                                {JSON.stringify(subWork.version.flow_json, null, 2)}
                              </pre>
                            </details>
                          )}
                          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                            <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 12 }}>
                              <h3 style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>インプット概要</h3>
                              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", fontSize: 11, lineHeight: 1.6, color: "var(--ink-3)", margin: 0 }}>
                                {subWork.input || "入力はありません。"}
                              </pre>
                            </div>
                            {subWork.reviewFeedback && (
                              <div style={{ borderRadius: 3, border: "1px solid var(--info)", background: "var(--info-bg)", padding: 12 }}>
                                <h3 style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: "var(--info)" }}>ユーザーレビュー</h3>
                                <div style={{ marginBottom: 8, fontSize: 10, color: "var(--info)" }}>
                                  {FEEDBACK_LABEL[subWork.reviewFeedback.kind]} ·{" "}
                                  {new Date(subWork.reviewFeedback.created_at).toLocaleString("ja-JP")}
                                </div>
                                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", fontSize: 11, lineHeight: 1.6, color: "var(--info)", margin: 0 }}>
                                  {subWork.reviewFeedback.comment || "レビュー本文はありません。"}
                                </pre>
                              </div>
                            )}
                            <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 12 }}>
                              <h3 style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>結果概要</h3>
                              {subWork.error ? (
                                <pre style={{ whiteSpace: "pre-wrap", borderRadius: 3, border: "1px solid var(--danger)", background: "var(--danger-bg)", padding: 12, fontFamily: "var(--strand-font-sans)", fontSize: 11, lineHeight: 1.6, color: "var(--danger)", margin: 0 }}>
                                  {subWork.error}
                                </pre>
                              ) : (
                                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", fontSize: 11, lineHeight: 1.6, color: "var(--ink-3)", margin: 0 }}>
                                  {subWork.result || "このサブワークに結果はまだありません。"}
                                </pre>
                              )}
                            </div>
                          </div>
                          {(subWork.diff || subWork.fileChanges) && (
                            <details style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 12 }}>
                              <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
                                diff / file changes
                              </summary>
                              <pre className="mono" style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 11, lineHeight: 1.6, color: "var(--ink-3)", margin: 0 }}>
                                {subWork.fileChanges || subWork.diff}
                              </pre>
                            </details>
                          )}
                          <details style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 12 }}>
                            <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
                              エージェントログ
                            </summary>
                            <div style={{ marginTop: 12 }}>
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
          </div>
        </main>

        {/* RIGHT — logs inspector */}
        <aside
          style={{
            display: "flex",
            minWidth: 0,
            flexDirection: "column",
            background: "var(--paper)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              background: "var(--paper-2)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "var(--ink)", textTransform: "uppercase" }}>
                ログ
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
                会話ログ、イベント、JSONを確認します。
              </div>
            </div>
            <Activity style={{ width: 16, height: 16, flexShrink: 0, color: "var(--ink-3)" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            <section>
              <div
                role="tablist"
                style={{
                  marginBottom: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 4,
                  borderRadius: 3,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  padding: 4,
                }}
              >
                {(["run", "output", "context"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={inspectorTab === tab}
                    onClick={() => setInspectorTab(tab)}
                    className="mono"
                    style={{
                      borderRadius: 3,
                      padding: "7px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      background: inspectorTab === tab ? "var(--accent)" : "transparent",
                      color: inspectorTab === tab ? "var(--accent-ink)" : "var(--ink-2)",
                    }}
                  >
                    {tab === "run" ? "Run" : tab === "output" ? "Output" : "Context"}
                  </button>
                ))}
              </div>
              <div style={{ minHeight: 288, overflowY: "auto", paddingBottom: 8 }}>
                {inspectorTab === "run" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Info
                      label="現在のサブワーク"
                      value={
                        selectedSubWork
                          ? `${selectedSubWork.label} / ${subWorkStatusLabel(selectedSubWork.status)}`
                          : "未選択"
                      }
                    />
                    <Info label="AIチーム" value={`${activeExecutionEnabledAgents.length}人が有効`} />
                    <Info label="ターン数" value={`${activeRunTurns.length}件`} />
                    {activeRunState.error && <Info label="エラー" value={activeRunState.error} />}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
                        会話
                      </div>
                      <Conversation
                        agents={activeExecutionEnabledAgents}
                        turns={activeRunTurns}
                        events={activeRunEvents}
                      />
                    </div>
                  </div>
                )}
                {inspectorTab === "output" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {activeOutputText ? (
                      <Info label="最新の実行結果" value={activeOutputText} />
                    ) : (
                      <EmptyState
                        title="まだ結果はありません"
                        description="実行が完了するとここに最新の出力が表示されます。"
                      />
                    )}
                    {activeDiff && (
                      <Info
                        label="変更点"
                        value={activeDiff}
                        icon={<FileDiff style={{ width: 14, height: 14 }} />}
                      />
                    )}
                    {activeFileChanges && (
                      <Info
                        label="ファイル変更"
                        value={activeFileChanges}
                        icon={<FileDiff style={{ width: 14, height: 14 }} />}
                      />
                    )}
                    <Info label="依頼内容" value={requestPreview || "未設定"} />
                  </div>
                )}
                {inspectorTab === "context" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <details
                      style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 8 }}
                      open
                    >
                      <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
                        payload (RefineRequest)
                      </summary>
                      <pre
                        className="mono"
                        style={{ marginTop: 8, maxHeight: 288, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 10, lineHeight: 1.5, color: "var(--ink-3)", margin: 0 }}
                      >
                        {JSON.stringify(request, null, 2)}
                      </pre>
                    </details>
                    <details style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 8 }}>
                      <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>
                        raw events ({activeRunEvents.length})
                      </summary>
                      <pre
                        className="mono"
                        style={{ marginTop: 8, maxHeight: 288, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 10, lineHeight: 1.5, color: "var(--ink-3)", margin: 0 }}
                      >
                        {activeRunEvents.length
                          ? JSON.stringify(activeRunEvents, null, 2)
                          : "ログはまだありません。"}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </StrandShell>
  );
}

// ---------- Inline strand Provider Health strip (replaces ProviderHealthBar) ----------
function ProviderHealthStrip({ providers, compact = false }: { providers: ProviderKind[]; compact?: boolean }) {
  const uniqueProviders = useMemo(() => Array.from(new Set(providers)).sort(), [providers]);
  const [results, setResults] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const refresh = useMemo(
    () => async () => {
      if (uniqueProviders.length === 0) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await api.getProvidersHealth(uniqueProviders);
        setResults(res.providers);
        setLastCheckedAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [uniqueProviders],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (uniqueProviders.length === 0) return null;
  const dead = results.filter((r) => !r.alive);
  const alive = results.length - dead.length;

  return (
    <Panel
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Dot tone={dead.length === 0 ? "ok" : "warn"} />
          Provider Health
          <span style={{ color: "var(--ink-3)", textTransform: "none", letterSpacing: 0 }}>
            {alive}/{results.length} alive
          </span>
        </span>
      }
      action={
        <Btn variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCcw style={{ width: 12, height: 12 }} className={loading ? "spin" : undefined} />
          {loading ? "確認中" : "再チェック"}
        </Btn>
      }
      padded={false}
    >
      <div style={{ padding: compact ? 8 : 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {lastCheckedAt && !error && (
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>
            last check: {new Date(lastCheckedAt).toLocaleTimeString()}
          </div>
        )}
        {results.map((row) => {
          const label = PROVIDER_LABEL[row.provider] ?? row.provider;
          return (
            <div
              key={row.provider}
              style={{
                borderRadius: 3,
                border: `1px solid ${row.alive ? "var(--border)" : "var(--warn)"}`,
                background: row.alive ? "var(--surface-2)" : "var(--warn-bg)",
                padding: "6px 8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Dot tone={row.alive ? "ok" : "danger"} size={8} />
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink)" }}>{label}</span>
                {row.endpoint && (
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{row.endpoint}</span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: row.alive ? "var(--ink-3)" : "var(--warn)" }}>{row.detail}</span>
              </div>
              {!row.alive && row.start_command && (
                <div
                  className="mono"
                  style={{
                    marginTop: 6,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                    borderRadius: 3,
                    border: "1px solid var(--border)",
                    background: "var(--paper)",
                    padding: "6px 8px",
                    fontSize: 10,
                    color: "var(--ink)",
                  }}
                >
                  <Icon name="terminal" size={11} color="var(--ink-3)" />
                  <code style={{ wordBreak: "break-all", flex: 1 }}>{row.start_command}</code>
                  <button
                    type="button"
                    style={{ fontSize: 10, color: "var(--ink-3)" }}
                    onClick={() => {
                      if (row.start_command) void navigator.clipboard.writeText(row.start_command);
                    }}
                  >
                    copy
                  </button>
                </div>
              )}
              {!row.alive && row.docs_url && (
                <div style={{ marginTop: 4 }}>
                  <a href={row.docs_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--accent-deep)" }}>
                    {row.docs_url}
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------- Inline strand Knowledge resources (replaces KnowledgePicker) ----------
const KNOWLEDGE_KIND_OPTIONS: KnowledgeKind[] = ["markdown", "text", "image", "figma", "mcp", "link", "note"];
const knowledgeUid = () => Math.random().toString(36).slice(2, 10);
const newKnowledgeDraft = (): KnowledgeResource => ({
  id: `knowledge_${knowledgeUid()}`,
  title: "",
  kind: "markdown",
  content: "",
  source: "",
  content_type: "text/plain",
  tags: [],
});

function KnowledgeResources({
  selected,
  onChange,
  disabled = false,
}: {
  selected: KnowledgeResource[];
  onChange: (items: KnowledgeResource[]) => void;
  disabled?: boolean;
}) {
  const knowledge = useApp((state) => state.knowledge);
  const loadKnowledge = useApp((state) => state.loadKnowledge);
  const saveKnowledge = useApp((state) => state.saveKnowledge);
  const deleteKnowledge = useApp((state) => state.deleteKnowledge);
  const [path, setPath] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<KnowledgeResource>(newKnowledgeDraft);

  useEffect(() => {
    void loadKnowledge();
  }, [loadKnowledge]);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);

  const toggle = (item: KnowledgeResource) => {
    if (disabled) return;
    onChange(selectedIds.has(item.id) ? selected.filter((entry) => entry.id !== item.id) : [...selected, item]);
  };

  const importLocal = async () => {
    if (!path.trim()) return;
    try {
      const item = await api.importLocalKnowledge(path.trim());
      await loadKnowledge();
      onChange(selectedIds.has(item.id) ? selected : [...selected, item]);
      setPath("");
      setStatus(`${item.title} を取り込みました。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const saveManual = async () => {
    if (!draft.title.trim()) {
      setStatus("title を入力してください。");
      return;
    }
    try {
      const item = await saveKnowledge({
        ...draft,
        id: draft.id.trim() || `knowledge_${knowledgeUid()}`,
        title: draft.title.trim(),
      });
      onChange(selectedIds.has(item.id) ? selected : [...selected, item]);
      setDraft(newKnowledgeDraft());
      setStatus(`${item.title} を保存して添付しました。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const remove = async (id: string) => {
    await deleteKnowledge(id);
    onChange(selected.filter((item) => item.id !== id));
  };

  return (
    <Panel
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="inbox" size={12} color="var(--accent-deep)" />
          学習用リソース
        </span>
      }
      action={<Pill tone="neutral">{selected.length} selected</Pill>}
      padded={false}
    >
      <div style={{ padding: 12, opacity: disabled ? 0.6 : 1 }}>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 10 }}>
          MD、画像、Figma/FIG、MCPメモをこのワークのコンテキストとして添付します。
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", alignItems: "start" }}>
          {/* Existing resources + import-local */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <input
                value={path}
                placeholder="/path/to/README.md / image.png / mcp.json"
                disabled={disabled}
                onChange={(event) => setPath(event.target.value)}
                className="mono"
                style={{ ...inputStyle(disabled), fontFamily: "var(--strand-font-mono)" }}
              />
              <Btn variant="outline" size="sm" icon="plus" disabled={disabled || !path.trim()} onClick={() => void importLocal()}>
                取込
              </Btn>
            </div>
            <div
              style={{
                maxHeight: 200,
                overflowY: "auto",
                borderRadius: 3,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {knowledge.length === 0 && (
                <div style={{ padding: 12, textAlign: "center", fontSize: 11, color: "var(--ink-3)" }}>
                  まだリソースがありません。ローカルファイルを取り込むか、右側でメモを作成してください。
                </div>
              )}
              {knowledge.map((item) => {
                const sel = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 3,
                      border: sel ? "1px solid var(--accent)" : "1px solid var(--border)",
                      background: sel ? "var(--accent-soft)" : "var(--surface-2)",
                      padding: "6px 8px",
                    }}
                  >
                    <button type="button" disabled={disabled} onClick={() => toggle(item)} style={{ flex: 1, minWidth: 0, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}>
                      <Dot tone={sel ? "accent" : "neutral"} size={6} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </span>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{item.kind}</span>
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void remove(item.id)}
                      style={{ width: 22, height: 22, display: "grid", placeItems: "center", color: "var(--ink-3)", borderRadius: 3, border: "1px solid var(--border)" }}
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick memo */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) 120px" }}>
              <Field label="title">
                <input
                  value={draft.title}
                  placeholder="例: 社内コーディング規約"
                  disabled={disabled}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  style={inputStyle(disabled)}
                />
              </Field>
              <Field label="kind">
                <select
                  value={draft.kind}
                  disabled={disabled}
                  onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}
                  className="mono"
                  style={selectStyle(disabled)}
                >
                  {KNOWLEDGE_KIND_OPTIONS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <textarea
              rows={5}
              value={draft.content}
              placeholder="MD本文、MCPメモ、Figma URL、補足メモなど"
              disabled={disabled}
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              style={textareaStyle(disabled)}
            />
            <Btn variant="outline" size="sm" icon="plus" disabled={disabled || !draft.title.trim()} onClick={() => void saveManual()}>
              保存して添付
            </Btn>
          </div>
        </div>
        {status && <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>{status}</div>}
      </div>
    </Panel>
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
      <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12, fontSize: 12, color: "var(--ink-3)" }}>
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
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: compact ? "repeat(auto-fit, minmax(260px, 1fr))" : "1fr",
      }}
    >
      {groupedTurns.map((group) => (
        <div
          key={group.agentId}
          style={{
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: compact ? "var(--surface)" : "var(--surface-2)",
            padding: 12,
          }}
        >
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
            <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 8 }}>
              <MessageSquareText style={{ width: 16, height: 16, flexShrink: 0, color: "var(--accent)" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {group.agentName}
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>
                  {group.turns.length > 0 ? `${group.turns.length} messages` : "待機中"}
                </div>
              </div>
            </div>
            <div className="mono" style={{ flexShrink: 0, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
              {group.orgRole}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <AgentStatusBadge status={group.status} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {group.turns.length === 0 && (
              <div style={{ borderRadius: 3, border: "1px dashed var(--border-2)", background: "var(--surface)", padding: 12, fontSize: 12, color: "var(--ink-3)" }}>
                このエージェントの出力はまだありません。
              </div>
            )}
            {group.turns.map((turn, index) => (
              <div
                key={`${turn.agent_id}-${index}`}
                style={{ borderRadius: 3, border: "1px solid var(--border)", background: compact ? "var(--surface-2)" : "var(--surface)", padding: 12 }}
              >
                <div className="mono" style={{ marginBottom: 8, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                  message {index + 1}
                </div>
                {turn.error && (
                  <div style={{ marginBottom: 8, borderRadius: 3, border: "1px solid var(--danger)", background: "var(--danger-bg)", padding: 8, fontSize: 11, color: "var(--danger)" }}>
                    {turn.error}
                  </div>
                )}
                {turn.research_results && turn.research_results.length > 0 && (
                  <ResearchResultsList results={turn.research_results} />
                )}
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)", margin: 0 }}>
                  {turn.output || "出力はありません。"}
                </pre>
                {turn.file_changes && (
                  <details style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--ink-3)" }}>
                      file changes
                    </summary>
                    <pre className="mono" style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 11, color: "var(--ink-3)", margin: 0 }}>
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
      <div style={{ borderRadius: 3, border: "1px dashed var(--border-2)", background: "var(--surface-2)", padding: 12, fontSize: 12, color: "var(--ink-3)" }}>
        エージェントがありません。
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
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
            style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {agent.name}
                </div>
                <div className="mono" style={{ marginTop: 4, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                  {ROLE_LABEL[agent.org_role]} · {PROVIDER_LABEL[agent.provider]}
                </div>
              </div>
              <div className="mono" style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "4px 8px", fontSize: 10, color: "var(--ink-3)" }}>
                {agentTurns.length} turns
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6, color: "var(--ink-3)" }}>
              {latestTurn ? (
                latestTurn.error ? (
                  <div style={{ color: "var(--danger)" }}>{latestTurn.error}</div>
                ) : (
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", margin: 0 }}>
                    {latestTurn.output || "出力はありません。"}
                  </pre>
                )
              ) : (
                "このエージェントの出力はありません。"
              )}
            </div>
            {latestTurn?.research_results && latestTurn.research_results.length > 0 && (
              <ResearchResultsList results={latestTurn.research_results} />
            )}
            {agentEvents.length > 0 && (
              <details style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 8 }}>
                <summary style={{ cursor: "pointer", fontSize: 10, fontWeight: 600, color: "var(--ink-3)" }}>
                  raw events
                </summary>
                <pre className="mono" style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 10, color: "var(--ink-4)", margin: 0 }}>
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
      <div style={{ borderRadius: 3, border: "1px dashed var(--border-2)", background: "var(--surface-2)", padding: 16, fontSize: 12, color: "var(--ink-3)" }}>
        エージェントが選ばれていません。
      </div>
    );
  }

  const latestPhaseByAgent = new Map<string, Extract<StreamEvent, { type: "turn_phase" }>>();
  for (const ev of events) {
    if (ev.type === "turn_phase") {
      latestPhaseByAgent.set(ev.agent_id, ev);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
      {agents.map((agent) => {
        const agentTurns = turns.filter((turn) => turn.agent_id === agent.id);
        const latestTurn = agentTurns[agentTurns.length - 1];
        const status = getAgentStatus(agent.id, turns, events);
        const workDescription = getAgentWorkDescription(agent, status, latestTurn);
        const phaseEvent = latestPhaseByAgent.get(agent.id);
        const running = status === "running";
        return (
          <div
            key={agent.id}
            style={{
              borderRadius: 3,
              border: running ? "1px solid var(--info)" : "1px solid var(--border)",
              background: running ? "var(--info-bg)" : "var(--surface-2)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {agent.name}
                </div>
                <div className="mono" style={{ marginTop: 4, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                  {ROLE_LABEL[agent.org_role]} · {PROVIDER_LABEL[agent.provider]}
                </div>
              </div>
              <AgentStatusBadge status={status} />
            </div>

            <div style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 8, fontSize: 11, lineHeight: 1.6, color: "var(--ink-3)" }}>
              <div style={{ marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>現在の作業</span>
                {phaseEvent && <PhaseBadge phase={phaseEvent.phase} />}
              </div>
              {phaseEvent ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div>{describePhase(phaseEvent)}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)" }}>
                    {workDescription}
                  </div>
                </div>
              ) : (
                workDescription
              )}
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", fontSize: 11, color: "var(--ink-3)" }}>
              <div style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "6px 8px" }}>
                出力: {agentTurns.length}件
              </div>
              <div style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "6px 8px" }}>
                依存: {agent.depends_on.length > 0 ? agent.depends_on.join(", ") : "なし"}
              </div>
            </div>

            {agent.skills.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {agent.skills.slice(0, 5).map((skill) => (
                  <span
                    key={skill}
                    style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "2px 6px", fontSize: 10, color: "var(--ink-4)" }}
                  >
                    {skill}
                  </span>
                ))}
                {agent.skills.length > 5 && (
                  <span style={{ borderRadius: 3, border: "1px solid var(--border)", padding: "2px 6px", fontSize: 10, color: "var(--ink-4)" }}>
                    +{agent.skills.length - 5}
                  </span>
                )}
              </div>
            )}

            {latestTurn && (
              <div style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 8 }}>
                <div className="mono" style={{ marginBottom: 4, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                  latest output
                </div>
                {latestTurn.error ? (
                  <div style={{ fontSize: 11, color: "var(--danger)" }}>{latestTurn.error}</div>
                ) : (
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", fontSize: 11, lineHeight: 1.6, color: "var(--ink-3)", margin: 0 }}>
                    {latestTurn.output || "出力はありません。"}
                  </pre>
                )}
                {latestTurn.research_results && latestTurn.research_results.length > 0 && (
                  <ResearchResultsList results={latestTurn.research_results} compact />
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

function ResearchResultsList({
  results,
  compact = false,
}: {
  results: NonNullable<TurnResult["research_results"]>;
  compact?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: compact ? 8 : 8, marginBottom: compact ? 0 : 12 }}>
      <div className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--info)" }}>
        research results
      </div>
      {results.map((item, index) => (
        <div
          key={`${item.url}-${index}`}
          style={{ borderRadius: 3, border: "1px solid var(--info)", background: "var(--info-bg)", padding: 8, fontSize: 11, color: "var(--info)" }}
        >
          <div style={{ fontWeight: 600 }}>{item.title || item.url}</div>
          <div className="mono" style={{ marginTop: 4, wordBreak: "break-all", fontSize: 10, color: "var(--info)" }}>{item.url}</div>
          {item.snippet && (
            <div style={{ marginTop: 8, lineHeight: 1.6, color: "var(--info)" }}>{item.snippet}</div>
          )}
          {item.error && <div style={{ marginTop: 8, color: "var(--danger)" }}>{item.error}</div>}
        </div>
      ))}
    </div>
  );
}

const PHASE_LABEL: Record<string, string> = {
  research_fetching: "Web 検索中",
  prompt_building: "プロンプト構築中",
  mcp_loading: "MCP コンテキスト取得中",
  provider_calling: "AI 呼び出し中",
  provider_completed: "応答取得",
  provider_failed: "失敗",
};

function PhaseBadge({ phase }: { phase: string }) {
  const palette =
    phase === "provider_failed"
      ? { fg: "var(--danger)", bg: "var(--danger-bg)", bd: "var(--danger)" }
      : phase === "provider_completed"
        ? { fg: "var(--ok)", bg: "var(--ok-bg)", bd: "var(--ok)" }
        : { fg: "var(--info)", bg: "var(--info-bg)", bd: "var(--info)" };
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        borderRadius: 99,
        border: `1px solid ${palette.bd}`,
        background: palette.bg,
        color: palette.fg,
        padding: "2px 6px",
        fontSize: 9,
        letterSpacing: "0.04em",
      }}
    >
      {PHASE_LABEL[phase] ?? phase}
    </span>
  );
}

function describePhase(ev: Extract<StreamEvent, { type: "turn_phase" }>): string {
  switch (ev.phase) {
    case "research_fetching":
      return `${ev.sources ?? 0} 件のリサーチソースを取得中…`;
    case "prompt_building":
      return "プロンプトを組み立てています…";
    case "mcp_loading":
      return `MCP サーバ (${(ev.servers ?? []).join(", ") || "default"}) からコンテキスト取得中…`;
    case "provider_calling":
      return `${ev.provider ?? "AI"} を呼び出し中 (prompt ${ev.prompt_chars ?? "?"}文字${ev.model ? ` / ${ev.model}` : ""})…`;
    case "provider_completed":
      return `応答を受信 (${ev.output_chars ?? "?"}文字 / ${ev.elapsed_sec ?? "?"}s)`;
    case "provider_failed":
      return `エラー: ${ev.error ?? "詳細不明"}`;
    default:
      return ev.phase;
  }
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
  const tone: "ok" | "info" | "danger" | "neutral" =
    status === "running" ? "ok" : status === "completed" ? "info" : status === "error" ? "danger" : "neutral";
  return <Pill tone={tone}>{label}</Pill>;
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
    "重要: このユーザーフィードバックを次の議論の最優先変更要求として扱ってください。",
    `種別: ${FEEDBACK_LABEL[feedback.kind]}`,
    feedback.comment.trim(),
    "",
    "このフィードバックを反映して、AIチームで議論を再開してください。前回の内容を前提に、必要な修正点・追加で確認すべき点・改善後の回答を出してください。",
  ].join("\n");
}

function Info({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}>
      <div className="mono" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 6, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
        {icon}
        {label}
      </div>
      <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.6, color: "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
