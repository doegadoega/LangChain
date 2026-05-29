// STRAND — Coding / Execution. Request list | center form+source | status panel.
// Presentation migrated to the strand design system; behavior preserved verbatim.
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Code2,
  FileCode2,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  MessageSquareMore,
  Play,
  RefreshCcw,
  Send,
  Square,
  X,
} from "lucide-react";
import { StrandShell } from "../components/strand/Chrome";
import { Btn, Dot, Icon, Panel, Pill } from "../components/strand/primitives";
import { inputStyle, selectStyle, textareaStyle } from "../components/strand/formStyles";
import { EmptyState, Field, InlineAlert } from "../components/refine/primitives";
import { statusTone, teamLabel, truncateText } from "../lib/refine";
import { buildBaseVersion, isDuplicateVersion } from "../lib/versions";
import { ResizeHandle } from "../components/ui/ResizeHandle";
import { useToast } from "../components/ui/Toast";
import { api } from "../api/client";
import { PROVIDER_LABEL, ROLE_LABEL, formatDuration } from "../lib/format";
import { useApp } from "../state/store";
import type {
  AgentConfig,
  ChatAttachment,
  ChatSession,
  CodingWorktreeState,
  KnowledgeKind,
  KnowledgeResource,
  ManagedRequest,
  ManagedRequestStatus,
  ProviderHealth,
  ProviderKind,
  RefineRequest,
  SourceTreeItem,
  StreamEvent,
  TurnResult,
  WorkspaceVersion,
} from "../types";

type ResultTab = "agents" | "diff" | "logs" | "chat";
type CodingRunSnapshot = {
  events: StreamEvent[];
  turns: TurnResult[];
  error?: string;
  finalText?: string;
  diff?: string;
  fileChanges?: string;
  startedAt?: number;
  endedAt?: number;
};
type ResizeTarget = "requestList" | "statusPanel" | "formPane";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const nowIso = () => new Date().toISOString();
const makeId = () => `coding_${Date.now().toString(36)}`;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const defaultCodingAgent = (): AgentConfig => ({
  id: "cli_coder",
  name: "CLI Coder",
  org_role: "worker",
  provider: "codex_cli",
  persona: "コーディング担当。対象範囲を絞り、必要最小限の変更、確認方法、リスクを明確にする。",
  skills: ["coding", "minimal-diff"],
  skill_refs: [],
  depends_on: [],
  command_template: null,
  model: null,
  model_decision: "fixed",
  enabled: true,
  allow_web_search: false,
  research_sources: [],
  require_citations: true,
  max_search_results: 5,
  mcp_enabled: false,
  mcp_config_path: null,
  mcp_servers: [],
  mcp_instruction: "",
  mcp_context_command: null,
  mcp_timeout_sec: 60,
  is_custom: true,
});

const createCodingRequest = (base?: Partial<RefineRequest>): RefineRequest => ({
  workflow_mode: "coding",
  orchestration_mode: "sequential",
  source_text: base?.source_text ?? "",
  objective: base?.objective ?? "コードの問題を調査して、必要最小限の修正案または変更を出す。",
  global_instruction:
    base?.global_instruction ?? "対象範囲外のリファクタは避け、変更理由と確認方法を簡潔に示す。",
  rounds: base?.rounds ?? 1,
  code_context: {
    repository: base?.code_context?.repository ?? "",
    working_directory: base?.code_context?.working_directory ?? "",
    target_paths: base?.code_context?.target_paths ?? [],
    tech_stack: base?.code_context?.tech_stack ?? "",
    acceptance_criteria: base?.code_context?.acceptance_criteria ?? "",
    test_command: base?.code_context?.test_command ?? "",
  },
  knowledge_context: base?.knowledge_context ?? [],
  agents: base?.agents?.length ? base.agents : [defaultCodingAgent()],
});

export function Coding() {
  const managedRequests = useApp((state) => state.managedRequests);
  const loadManagedRequests = useApp((state) => state.loadManagedRequests);
  const saveManagedRequest = useApp((state) => state.saveManagedRequest);
  const deleteManagedRequest = useApp((state) => state.deleteManagedRequest);
  const templates = useApp((state) => state.templates);
  const updateRequest = useApp((state) => state.updateRequest);
  const run = useApp((state) => state.run);
  const startRun = useApp((state) => state.startRun);
  const stopRun = useApp((state) => state.stopRun);
  const resetRun = useApp((state) => state.resetRun);
  const { notify } = useToast();

  const [activeId, setActiveId] = useState<string | undefined>();
  const [leftTab, setLeftTab] = useState<"requests" | "tree">("requests");
  const [draft, setDraft] = useState<RefineRequest>(() => createCodingRequest());
  const [title, setTitle] = useState("");
  const [treeByPath, setTreeByPath] = useState<Record<string, SourceTreeItem[]>>({});
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [sourcePath, setSourcePath] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [resultTab, setResultTab] = useState<ResultTab>("agents");
  const [saveMessage, setSaveMessage] = useState("");
  const [versionMessage, setVersionMessage] = useState("");
  const [selectedTeamTemplateId, setSelectedTeamTemplateId] = useState("");
  const [featureRequest, setFeatureRequest] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatImageAttachments, setChatImageAttachments] = useState<ChatAttachment[]>([]);
  const [chatStatus, setChatStatus] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [layout, setLayout] = useState({
    requestList: 340,
    statusPanel: 420,
    formPane: 420,
  });

  const codingRequests = useMemo(
    () =>
      managedRequests
        .filter((item) => item.request.workflow_mode === "coding")
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [managedRequests],
  );
  const selectedRecord = managedRequests.find((item) => item.id === activeId);
  const displayedTurns = run.status !== "idle" || run.turns.length ? run.turns : selectedRecord?.agent_turns ?? [];
  const displayedEvents =
    run.status !== "idle" || run.events.length ? run.events : selectedRecord?.stream_events ?? [];
  const displayedDiff = run.fileChanges || run.diff || selectedRecord?.file_changes || selectedRecord?.diff || "";
  const displayedFinal = run.finalText || selectedRecord?.final_text || "";
  const displayedError = run.error || selectedRecord?.error || "";
  const displayedVersionControl = selectedRecord?.version_control;
  const completedTurnCount = displayedEvents.filter((event) => event.type === "turn_completed").length;
  const runStartedEvent = displayedEvents.find((event) => event.type === "run_started");
  const totalTurnCount = runStartedEvent?.total_turns ?? Math.max(1, enabledAgentsCount(draft.agents) * (draft.rounds || 1));
  const progressPercent = Math.min(100, Math.round((completedTurnCount / totalTurnCount) * 100));
  const activeTurnEvent = run.status === "running" ? findActiveTurnEvent(displayedEvents) : undefined;
  const selectableBuiltInTeams = useMemo(
    () =>
      templates.filter(
        (template) => (template.locked || template.is_builtin) && template.workflow_mode === "coding",
      ),
    [templates],
  );
  const selectableCustomTeams = useMemo(
    () => templates.filter((template) => !(template.locked || template.is_builtin)),
    [templates],
  );
  const enabledAgents = draft.agents.filter((agent) => agent.enabled !== false);
  const ceoAgent = enabledAgents.find((agent) => agent.org_role === "ceo") ?? enabledAgents[0];
  const ceoChatId = ceoAgent ? codingChatSessionId(activeId, ceoAgent.id) : "";
  const ceoChatSession = ceoChatId
    ? chatSessions.find((session) => session.id === ceoChatId)
    : undefined;
  const canRun = draft.source_text.trim() && draft.code_context.working_directory.trim() && enabledAgents.length;

  useEffect(() => {
    void loadManagedRequests();
  }, [loadManagedRequests]);

  useEffect(() => {
    void api.listChats().then(setChatSessions).catch(() => setChatSessions([]));
  }, []);

  const updateDraft = (patch: Partial<RefineRequest>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const updateCodeContext = (patch: Partial<RefineRequest["code_context"]>) => {
    setDraft((current) => ({
      ...current,
      code_context: {
        ...current.code_context,
        ...patch,
      },
    }));
  };

  const selectRecord = (record: ManagedRequest) => {
    setActiveId(record.id);
    setTitle(record.title);
    setDraft(createCodingRequest(record.request));
    setSelectedTeamTemplateId(record.template_id ?? "");
    setFeatureRequest("");
    resetRun();
    setSaveMessage("コーディング依頼を読み込みました。");
    if (record.request.code_context.working_directory) {
      void loadTree(record.request.code_context.working_directory, true);
    }
  };

  const newRequest = () => {
    setActiveId(undefined);
    setTitle("");
    setDraft(createCodingRequest());
    setTreeByPath({});
    setOpenDirs(new Set());
    setSourcePath("");
    setSourceText("");
    setSelectedTeamTemplateId("");
    setFeatureRequest("");
    resetRun();
    setSaveMessage("新しいコーディング依頼を作成中です。");
  };

  const loadTree = async (path = draft.code_context.working_directory, open = true) => {
    const target = path.trim();
    if (!target) {
      setSourceError("作業ディレクトリを入力してください。");
      return;
    }
    try {
      const tree = await api.listSourceTree(target);
      setTreeByPath((current) => ({ ...current, [tree.path]: tree.children }));
      if (open) {
        setOpenDirs((current) => new Set([...current, tree.path]));
        updateCodeContext({ working_directory: tree.path });
      }
      setSourceError("");
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : String(error));
    }
  };

  const pickDirectory = async () => {
    try {
      const selected = await api.pickDirectory();
      if (!selected.path) {
        setSourceError("フォルダ選択をキャンセルしました。");
        return;
      }
      updateCodeContext({ working_directory: selected.path });
      await loadTree(selected.path, true);
      setSourceError("");
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleDir = async (path: string) => {
    const next = new Set(openDirs);
    if (next.has(path)) {
      next.delete(path);
      setOpenDirs(next);
      return;
    }
    if (!treeByPath[path]) {
      await loadTree(path, false);
    }
    next.add(path);
    setOpenDirs(next);
  };

  const openFile = async (path: string) => {
    try {
      const file = await api.readSourceFile(path);
      setSourcePath(file.path);
      setSourceText(file.content);
      setSourceError("");
      const rel = relativePath(file.path, draft.code_context.working_directory);
      if (!draft.code_context.target_paths.includes(rel)) {
        updateCodeContext({ target_paths: [...draft.code_context.target_paths, rel] });
      }
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : String(error));
    }
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTeamTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      setSaveMessage("現在のエージェント構成を使います。");
      return;
    }
    setDraft((current) => ({
      ...current,
      workflow_mode: "coding",
      agents: template.agents.map((agent) => clone(agent)),
      orchestration_mode: template.orchestration_mode ?? current.orchestration_mode,
      rounds: template.rounds ?? current.rounds,
    }));
    setSaveMessage(`実行チームを「${teamLabel(template)}」に変更しました。`);
  };

  const buildRecord = (
    requestValue: RefineRequest,
    status: ManagedRequestStatus,
    currentRun = useApp.getState().run,
    recordId = activeId,
    versionControl?: CodingWorktreeState,
  ): ManagedRequest => {
    const existing = recordId ? managedRequests.find((item) => item.id === recordId) : undefined;
    const now = nowIso();
    const id = existing?.id ?? recordId ?? makeId();
    const recordTitle =
      title.trim() ||
      requestValue.source_text.trim().split("\n")[0]?.slice(0, 60) ||
      "Untitled coding request";
    const baseVersions = existing?.versions ?? [];
    const runVersion =
      currentRun.endedAt || currentRun.turns.length || currentRun.finalText || currentRun.fileChanges
        ? buildCodingVersion({
            versionNo: baseVersions.length + 1,
            createdAt: now,
            requestValue,
            currentRun,
            versionControl,
          })
        : undefined;
    const versions =
      runVersion && !isDuplicateCodingVersion(baseVersions[0], runVersion)
        ? [runVersion, ...baseVersions]
        : baseVersions;

    return {
      id,
      title: recordTitle,
      status,
      request: clone(requestValue),
      template_id: selectedTeamTemplateId || undefined,
      original_request: existing?.original_request ?? clone(requestValue),
      previous_request: existing?.request ? clone(existing.request) : undefined,
      versions,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      last_run_at: currentRun.startedAt ? new Date(currentRun.startedAt).toISOString() : existing?.last_run_at,
      final_text: currentRun.finalText ?? existing?.final_text,
      diff: currentRun.diff ?? existing?.diff,
      file_changes: currentRun.fileChanges ?? existing?.file_changes,
      agent_turns: currentRun.turns.length > 0 ? currentRun.turns : existing?.agent_turns,
      stream_events: currentRun.events.length > 0 ? currentRun.events : existing?.stream_events,
      version_control: versionControl ?? existing?.version_control,
      run_started_at: currentRun.startedAt ? new Date(currentRun.startedAt).toISOString() : existing?.run_started_at,
      run_ended_at: currentRun.endedAt ? new Date(currentRun.endedAt).toISOString() : existing?.run_ended_at,
      error: currentRun.error ?? existing?.error,
      verification_feedback: existing?.verification_feedback ?? [],
    };
  };

  const saveDraft = async () => {
    const saved = await saveManagedRequest(buildRecord(draft, "draft"));
    setActiveId(saved.id);
    setTitle(saved.title);
    setSaveMessage("コーディング依頼を保存しました。");
    notify({ kind: "success", title: "コーディング依頼を保存しました" });
  };

  const prepareRequestForRun = async (
    requestValue: RefineRequest,
    recordId: string,
  ): Promise<{ requestValue: RefineRequest; versionControl?: CodingWorktreeState }> => {
    const existing = selectedRecord?.version_control;
    const baseWorkingDirectory =
      existing?.source_working_directory ||
      requestValue.code_context.repository ||
      requestValue.code_context.working_directory;
    if (!baseWorkingDirectory.trim()) {
      return { requestValue };
    }
    // Use a stable worktree per coding record so follow-up / re-runs continue on
    // the code already implemented, instead of forking a fresh worktree from the
    // source HEAD every time. If the record already has a worktree, target that
    // exact one; otherwise key the new worktree by the record id.
    const worktreeKey = existing?.worktree_path
      ? existing.worktree_path.split("/").filter(Boolean).pop() ?? recordId
      : recordId;
    const versionControl = await api.prepareCodingWorktree({
      request_id: worktreeKey,
      working_directory: baseWorkingDirectory,
    });
    const preparedRequest = createCodingRequest({
      ...requestValue,
      code_context: {
        ...requestValue.code_context,
        repository: versionControl.source_working_directory,
        working_directory: versionControl.worktree_path,
      },
    });
    setDraft(preparedRequest);
    const tree = await api.listSourceTree(versionControl.worktree_path);
    setTreeByPath((current) => ({ ...current, [tree.path]: tree.children }));
    setOpenDirs((current) => new Set([...current, tree.path]));
    setVersionMessage(
      versionControl.user_dirty
        ? versionControl.user_patch_applied
          ? "ユーザ変更を検出し、AI用worktreeへ反映しました。"
          : "ユーザ変更を検出しました。未追跡ファイルはAI用worktreeへ自動反映されません。"
        : "AI用worktreeを準備しました。",
    );
    return { requestValue: preparedRequest, versionControl };
  };

  const runCoding = async () => {
    try {
      const recordId = activeId ?? makeId();
      setActiveId(recordId);
      const prepared = await prepareRequestForRun(createCodingRequest(draft), recordId);
      const requestValue = prepared.requestValue;
      updateRequest(requestValue);
      const running = await saveManagedRequest(
        buildRecord(requestValue, "running", useApp.getState().run, recordId, prepared.versionControl),
      );
      setActiveId(running.id);
      setTitle(running.title);
      setResultTab("agents");
      await startRun();
      const latestRun = useApp.getState().run;
      const finalStatus: ManagedRequestStatus =
        latestRun.status === "completed" ? "completed" : latestRun.status === "failed" ? "paused" : "running";
      await saveManagedRequest(
        buildRecord(requestValue, finalStatus, latestRun, recordId, prepared.versionControl),
      );
      setSaveMessage(latestRun.status === "completed" ? "実行が完了しました。" : "実行結果を保存しました。");
      notify({
        kind: latestRun.status === "completed" ? "success" : "info",
        title: latestRun.status === "completed" ? "実行が完了しました" : "実行結果を保存しました",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveMessage(message);
      setVersionMessage("AI用worktreeの準備に失敗しました。");
    }
  };

  const runFeatureAddition = async () => {
    try {
      const addition = featureRequest.trim();
      if (!addition) {
        setSaveMessage("追加したい機能を書いてください。");
        return;
      }
      const previousSummary = selectedRecord?.final_text || selectedRecord?.request.source_text || draft.source_text;
      const recordId = activeId ?? makeId();
      setActiveId(recordId);
      const requestBeforeWorktree = createCodingRequest({
        ...draft,
        source_text: [
          "既存の実装を前提に、次の機能追加を行ってください。",
          "",
          "## 追加したい機能",
          addition,
          "",
          "## 元の依頼",
          truncateText(selectedRecord?.original_request?.source_text || draft.source_text, 1600),
          "",
          "## 直近の結果メモ",
          truncateText(previousSummary, 1600),
        ].join("\n"),
        objective: "既存コードに対して、指定された追加機能を必要最小限の差分で実装する。",
      });
      const prepared = await prepareRequestForRun(requestBeforeWorktree, recordId);
      const requestValue = prepared.requestValue;
      setDraft(requestValue);
      updateRequest(requestValue);
      const running = await saveManagedRequest(
        buildRecord(requestValue, "running", useApp.getState().run, recordId, prepared.versionControl),
      );
      setActiveId(running.id);
      setTitle(running.title);
      setResultTab("agents");
      await startRun();
      const latestRun = useApp.getState().run;
      const finalStatus: ManagedRequestStatus =
        latestRun.status === "completed" ? "completed" : latestRun.status === "failed" ? "paused" : "running";
      await saveManagedRequest(
        buildRecord(requestValue, finalStatus, latestRun, recordId, prepared.versionControl),
      );
      setFeatureRequest("");
      setSaveMessage(latestRun.status === "completed" ? "追加機能の実行が完了しました。" : "追加機能の実行結果を保存しました。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveMessage(message);
      setVersionMessage("追加機能用worktreeの準備に失敗しました。");
    }
  };

  const removeActive = async () => {
    if (!activeId) return;
    await deleteManagedRequest(activeId);
    newRequest();
  };

  const sendCEOChat = async () => {
    const question = chatMessage.trim();
    if (!ceoAgent || !question || chatSending) return;
    setChatSending(true);
    setChatStatus("");
    try {
      const session = await api.postChatMessage({
        session_id: ceoChatId,
        agent: ceoAgent,
        question,
        web_search_enabled: ceoAgent.allow_web_search,
        attachments: buildCodingChatAttachments({
          request: draft,
          selectedRecord,
          events: displayedEvents,
          turns: displayedTurns,
          error: displayedError,
          sourcePath,
          sourceText,
        }).concat(chatImageAttachments),
      });
      setChatSessions((items) => [session, ...items.filter((item) => item.id !== session.id)]);
      setChatMessage("");
      setChatImageAttachments([]);
      setChatStatus("CEOから回答がありました。");
      notify({ kind: "success", title: "CEO から回答がありました" });
      setResultTab("chat");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setChatStatus(message);
      notify({ kind: "error", title: "CEO チャットでエラー", description: message });
    } finally {
      setChatSending(false);
    }
  };

  const adjustResize = (target: ResizeTarget, delta: number) => {
    setLayout((current) => ({
      requestList:
        target === "requestList" ? clamp(current.requestList + delta, 260, 520) : current.requestList,
      statusPanel:
        target === "statusPanel" ? clamp(current.statusPanel - delta, 320, 760) : current.statusPanel,
      formPane:
        target === "formPane"
          ? clamp(current.formPane + delta, 300, Math.max(360, window.innerHeight - 220))
          : current.formPane,
    }));
  };

  const beginResize = (target: ResizeTarget, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { ...layout };
    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setLayout({
        requestList:
          target === "requestList"
            ? clamp(initial.requestList + dx, 260, 520)
            : initial.requestList,
        statusPanel:
          target === "statusPanel"
            ? clamp(initial.statusPanel - dx, 320, 760)
            : initial.statusPanel,
        formPane:
          target === "formPane"
            ? clamp(initial.formPane + dy, 300, Math.max(360, window.innerHeight - 220))
            : initial.formPane,
      });
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = target === "formPane" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <StrandShell breadcrumb={["overview", "execution"]} mainStyle={{ display: "flex", overflow: "hidden" }}>
      <div
        className="coding"
        style={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: `${layout.requestList}px 6px minmax(560px,1fr) 6px ${layout.statusPanel}px`,
          background: "var(--paper)",
          overflow: "hidden",
        }}
      >
        <style>{"@keyframes coding-spin{to{transform:rotate(360deg)}}.coding .spin{animation:coding-spin 0.8s linear infinite}"}</style>
        {/* LEFT — request list / source tabs */}
        <aside
          style={{
            display: "flex",
            minWidth: 0,
            flexDirection: "column",
            borderRight: "1px solid var(--border)",
            background: "var(--paper)",
          }}
        >
          <div style={{ borderBottom: "1px solid var(--border)", padding: 12 }}>
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                  EXECUTION · CODING
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>依頼とソース</div>
              </div>
              <Btn variant="outline" size="sm" icon="plus" onClick={newRequest}>
                新規
              </Btn>
            </div>
            <div
              role="tablist"
              style={{
                display: "flex",
                border: "1px solid var(--border)",
                borderRadius: 3,
                background: "var(--surface)",
                overflow: "hidden",
              }}
            >
              {(["requests", "tree"] as const).map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={leftTab === tab}
                  onClick={() => setLeftTab(tab)}
                  className="mono"
                  style={{
                    flex: 1,
                    padding: "5px 8px",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    background: leftTab === tab ? "var(--ink)" : "transparent",
                    color: leftTab === tab ? "var(--paper)" : "var(--ink-2)",
                    borderRight: i === 0 ? "1px solid var(--border)" : "none",
                  }}
                >
                  {tab === "requests" ? "依頼一覧" : "ソース"}
                </button>
              ))}
            </div>
          </div>

          {leftTab === "requests" ? (
            <>
              <div style={{ borderBottom: "1px solid var(--border)", padding: 12 }}>
                <Btn
                  variant="outline"
                  size="sm"
                  icon="x"
                  disabled={!activeId}
                  onClick={() => void removeActive()}
                  style={{ width: "100%", justifyContent: "center", color: activeId ? "var(--danger)" : "var(--ink-3)" }}
                >
                  選択中の依頼を削除
                </Btn>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                {codingRequests.length === 0 ? (
                  <EmptyState
                    title="コーディング依頼はまだありません"
                    description="右上の「新規」から作成してください。"
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {codingRequests.map((item) => {
                      const sel = activeId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => selectRecord(item)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: 10,
                            borderRadius: 3,
                            border: "1px solid var(--border)",
                            borderLeft: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                            background: sel ? "var(--surface)" : "var(--surface-2)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 12,
                                fontWeight: sel ? 600 : 500,
                                color: "var(--ink)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.title}
                            </span>
                            <Pill tone={statusTone(item.status)}>{STATUS_LABEL[item.status]}</Pill>
                          </div>
                          <div
                            className="mono"
                            style={{
                              marginTop: 6,
                              fontSize: 10,
                              color: "var(--ink-3)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.request.code_context.working_directory || "working_directory 未設定"}
                          </div>
                          <div className="mono" style={{ marginTop: 2, fontSize: 10, color: "var(--ink-4)" }}>
                            {new Date(item.updated_at).toLocaleString("ja-JP")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ borderBottom: "1px solid var(--border)", padding: 12 }}>
                <WorkspaceControl
                  value={draft.code_context.working_directory}
                  onChange={(working_directory) => updateCodeContext({ working_directory })}
                  onPick={() => void pickDirectory()}
                  onLoad={() => void loadTree()}
                />
                {sourceError && <InlineAlert tone="danger" spaced>{sourceError}</InlineAlert>}
                {(displayedVersionControl || versionMessage) && (
                  <VersionControlSummary state={displayedVersionControl} message={versionMessage} />
                )}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                {draft.code_context.working_directory && treeByPath[draft.code_context.working_directory] ? (
                  <SourceTree
                    root={draft.code_context.working_directory}
                    treeByPath={treeByPath}
                    openDirs={openDirs}
                    activeFile={sourcePath}
                    onToggleDir={(path) => void toggleDir(path)}
                    onOpenFile={(path) => void openFile(path)}
                  />
                ) : (
                  <EmptyState
                    title="ソース一覧はまだ読み込まれていません"
                    description="作業ディレクトリを入力して「読込」を押してください。"
                  />
                )}
              </div>
            </>
          )}
        </aside>
        <ResizeHandle
          axis="x"
          label="依頼一覧の幅を調整"
          onPointerDown={(event) => beginResize("requestList", event)}
          onAdjust={(delta) => adjustResize("requestList", delta)}
        />

        {/* CENTER — request form + source preview */}
        <main style={{ display: "flex", minWidth: 0, flexDirection: "column", overflow: "hidden" }}>
          <section style={{ display: "flex", minWidth: 0, flexDirection: "column", overflow: "hidden", flex: 1 }}>
            <div
              style={{
                display: "grid",
                minHeight: 0,
                flex: 1,
                overflow: "hidden",
                gridTemplateRows: `${layout.formPane}px 6px minmax(220px,1fr)`,
              }}
            >
              <div style={{ overflowY: "auto", borderBottom: "1px solid var(--border)", padding: 16 }}>
                {/* Workspace row — full width, required to run (FIX A) */}
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    background: "var(--surface-2)",
                    padding: 12,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Icon name="doc" size={13} color="var(--accent-deep)" />
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "var(--ink)" }}>
                      ワークスペース
                    </span>
                    <Pill tone={draft.code_context.working_directory.trim() ? "ok" : "warn"}>
                      {draft.code_context.working_directory.trim() ? "ready" : "required"}
                    </Pill>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>実行には working_directory が必要です。</span>
                  </div>
                  <WorkspaceControl
                    value={draft.code_context.working_directory}
                    onChange={(working_directory) => updateCodeContext({ working_directory })}
                    onPick={() => void pickDirectory()}
                    onLoad={() => void loadTree()}
                  />
                  {(displayedVersionControl || versionMessage) && (
                    <VersionControlSummary state={displayedVersionControl} message={versionMessage} />
                  )}
                </div>

                {/* Name + team row */}
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", marginBottom: 14 }}>
                  <Field label="コーディング依頼名">
                    <input
                      value={title}
                      placeholder="例: TODOリスト実装"
                      onChange={(event) => setTitle(event.target.value)}
                      style={inputStyle()}
                    />
                  </Field>
                  <Field label="実行チーム">
                    <select
                      value={selectedTeamTemplateId}
                      onChange={(event) => applyTemplate(event.target.value)}
                      className="mono"
                      style={selectStyle()}
                    >
                      <option value="">現在のエージェント構成</option>
                      <optgroup label="Built-in">
                        {selectableBuiltInTeams.map((template) => (
                          <option key={template.id} value={template.id}>
                            {teamLabel(template)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Custom">
                        {selectableCustomTeams.length === 0 && (
                          <option value="__no_custom_team__" disabled>
                            Customチームはまだありません
                          </option>
                        )}
                        {selectableCustomTeams.map((template) => (
                          <option key={template.id} value={template.id}>
                            {teamLabel(template)}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </Field>
                </div>

                {/* Balanced two-column body (FIX B) */}
                <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", alignItems: "start" }}>
                  <Field label="依頼内容" required>
                    <textarea
                      rows={14}
                      value={draft.source_text}
                      placeholder="何を作る・直すかを書いてください"
                      onChange={(event) => updateDraft({ source_text: event.target.value })}
                      style={textareaStyle()}
                    />
                  </Field>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Field label="対象ファイル">
                      <textarea
                        rows={4}
                        value={draft.code_context.target_paths.join("\n")}
                        placeholder="クリックしたソースは自動で追加されます"
                        onChange={(event) =>
                          updateCodeContext({
                            target_paths: event.target.value
                              .split(/\r?\n|,/)
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        className="mono"
                        style={{ ...textareaStyle(), fontFamily: "var(--strand-font-mono)" }}
                      />
                    </Field>
                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
                      <Field label="テストコマンド">
                        <input
                          value={draft.code_context.test_command}
                          placeholder="npm run build"
                          onChange={(event) => updateCodeContext({ test_command: event.target.value })}
                          className="mono"
                          style={{ ...inputStyle(), fontFamily: "var(--strand-font-mono)" }}
                        />
                      </Field>
                      <Field label="技術スタック">
                        <input
                          value={draft.code_context.tech_stack}
                          placeholder="Swift / React / FastAPI"
                          onChange={(event) => updateCodeContext({ tech_stack: event.target.value })}
                          style={inputStyle()}
                        />
                      </Field>
                    </div>
                    <Field label="受け入れ条件">
                      <textarea
                        rows={4}
                        value={draft.code_context.acceptance_criteria}
                        placeholder="完了条件、避けたい変更、確認観点"
                        onChange={(event) => updateCodeContext({ acceptance_criteria: event.target.value })}
                        style={textareaStyle()}
                      />
                    </Field>
                  </div>
                </div>

                {/* Run / save / reset */}
                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  {run.status === "running" ? (
                    <Btn
                      variant="solid"
                      onClick={stopRun}
                      style={{ flex: 1, justifyContent: "center", background: "var(--danger)", borderColor: "var(--danger)", color: "white" }}
                    >
                      <Square style={{ width: 14, height: 14 }} />
                      停止
                    </Btn>
                  ) : (
                    <Btn
                      variant="solid"
                      tone="accent"
                      disabled={!canRun}
                      onClick={() => void runCoding()}
                      style={{ flex: 1, justifyContent: "center", opacity: canRun ? 1 : 0.5 }}
                    >
                      <Play style={{ width: 14, height: 14 }} />
                      この依頼を実行
                    </Btn>
                  )}
                  <Btn variant="outline" onClick={() => void saveDraft()}>
                    保存
                  </Btn>
                  <Btn variant="outline" onClick={resetRun} style={{ width: 36, padding: 0, justifyContent: "center" }}>
                    <RefreshCcw style={{ width: 14, height: 14 }} />
                  </Btn>
                </div>

                {/* Knowledge picker (inline strand) */}
                <div style={{ marginTop: 14 }}>
                  <KnowledgeResources
                    selected={draft.knowledge_context ?? []}
                    onChange={(knowledge_context) => updateDraft({ knowledge_context })}
                  />
                </div>

                {/* Feature addition */}
                <div
                  style={{
                    marginTop: 14,
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    background: "var(--surface-2)",
                    padding: 12,
                  }}
                >
                  <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>追加機能</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                        選択中の依頼と直近結果を前提に、続きの実装を走らせます。
                      </div>
                    </div>
                    <Pill tone="neutral">{selectedRecord?.versions?.length ?? 0} history</Pill>
                  </div>
                  <textarea
                    rows={3}
                    value={featureRequest}
                    placeholder="例: TODOに期限と完了フィルタを追加する"
                    onChange={(event) => setFeatureRequest(event.target.value)}
                    style={textareaStyle()}
                  />
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <Btn
                      variant="outline"
                      disabled={!activeId || !featureRequest.trim() || run.status === "running" || !canRun}
                      onClick={() => void runFeatureAddition()}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <Play style={{ width: 14, height: 14 }} />
                      追加機能として実行
                    </Btn>
                    <Btn variant="ghost" disabled={!featureRequest} onClick={() => setFeatureRequest("")}>
                      クリア
                    </Btn>
                  </div>
                </div>
                {saveMessage && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>{saveMessage}</div>
                )}
              </div>
              <ResizeHandle
                axis="y"
                label="依頼フォームとソース表示の高さを調整"
                onPointerDown={(event) => beginResize("formPane", event)}
                onAdjust={(delta) => adjustResize("formPane", delta)}
              />

              {/* Source preview */}
              <div style={{ display: "flex", minHeight: 0, flexDirection: "column", overflow: "hidden" }}>
                <div
                  className="mono"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderBottom: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    padding: "8px 12px",
                    fontSize: 11,
                    color: "var(--ink-2)",
                  }}
                >
                  <FileCode2 style={{ width: 14, height: 14 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sourcePath || "ソースコード"}
                  </span>
                </div>
                <div style={{ flex: 1, overflow: "auto", background: "var(--paper)", padding: 14 }}>
                  {sourceError ? (
                    <InlineAlert tone="danger" spaced>{sourceError}</InlineAlert>
                  ) : sourceText ? (
                    <pre
                      className="mono"
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: 11,
                        lineHeight: 1.6,
                        color: "var(--ink)",
                        margin: 0,
                      }}
                    >
                      {sourceText}
                    </pre>
                  ) : (
                    <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 12, color: "var(--ink-3)" }}>
                      左のソース一覧からファイルを選んでください。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
        <ResizeHandle
          axis="x"
          label="作業状況の幅を調整"
          onPointerDown={(event) => beginResize("statusPanel", event)}
          onAdjust={(delta) => adjustResize("statusPanel", delta)}
        />

        {/* RIGHT — status panel */}
        <aside
          style={{
            display: "flex",
            minWidth: 0,
            flexDirection: "column",
            borderLeft: "1px solid var(--border)",
            background: "var(--paper)",
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
            <div>
              <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "var(--ink)", textTransform: "uppercase" }}>
                作業状況
              </div>
              <div className="mono" style={{ marginTop: 4, fontSize: 10, color: "var(--ink-3)" }}>
                {run.status} · {formatDuration(run.startedAt, run.endedAt)}
              </div>
            </div>
            {run.status === "running" && <Loader2 style={{ width: 16, height: 16, color: "var(--ok)" }} className="spin" />}
          </div>
          <div style={{ borderBottom: "1px solid var(--border)", padding: "12px 14px" }}>
            <div className="mono" style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "var(--ink-3)" }}>
              <span>{completedTurnCount}/{totalTurnCount} turns</span>
              <span>{progressPercent}%</span>
            </div>
            <div style={{ height: 6, overflow: "hidden", borderRadius: 99, background: "var(--surface-sunk)" }}>
              <div style={{ height: "100%", borderRadius: 99, background: "var(--accent)", width: `${progressPercent}%`, transition: "width 0.2s" }} />
            </div>
            <div
              style={{
                marginTop: 8,
                borderRadius: 3,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                padding: 8,
                fontSize: 11,
                color: "var(--ink-2)",
              }}
            >
              {displayedError
                ? `停止: ${displayedError}`
                : run.status === "completed"
                  ? "完了しました。"
                  : activeTurnEvent
                    ? `現在: ${activeTurnEvent.agent_name} が実行中`
                    : "実行待ちです。"}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 4,
              borderBottom: "1px solid var(--border)",
              padding: 8,
            }}
          >
            {(["agents", "diff", "logs", "chat"] as ResultTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setResultTab(tab)}
                className="mono"
                style={{
                  borderRadius: 3,
                  padding: "7px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  background: resultTab === tab ? "var(--accent)" : "transparent",
                  color: resultTab === tab ? "var(--accent-ink)" : "var(--ink-2)",
                }}
              >
                {tab === "agents" ? "Agents" : tab === "diff" ? "Code" : tab === "logs" ? "Logs" : "CEO"}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {displayedError && <InlineAlert tone="danger" spaced>{displayedError}</InlineAlert>}
            {resultTab === "agents" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <ProviderHealthStrip providers={draft.agents.map((a) => a.provider)} />
                <AgentWorkList agents={draft.agents} turns={displayedTurns} events={displayedEvents} />
              </div>
            )}
            {resultTab === "diff" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Info label="最終出力" value={displayedFinal || "まだ結果はありません。"} icon={<ListChecks style={{ width: 14, height: 14 }} />} />
                <Info label="diff / file changes" value={displayedDiff || "まだファイル変更はありません。"} icon={<Code2 style={{ width: 14, height: 14 }} />} mono />
              </div>
            )}
            {resultTab === "logs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <RunLogView events={displayedEvents} turns={displayedTurns} error={displayedError} />
                <ServerLogPanel />
              </div>
            )}
            {resultTab === "chat" && (
              <CodingCEOChat
                agent={ceoAgent}
                session={ceoChatSession}
                message={chatMessage}
                status={chatStatus}
                sending={chatSending}
                imageAttachments={chatImageAttachments}
                onMessageChange={setChatMessage}
                onImageAttachmentsChange={setChatImageAttachments}
                onStatusChange={setChatStatus}
                onSend={() => void sendCEOChat()}
              />
            )}
          </div>
        </aside>
      </div>
    </StrandShell>
  );
}

// ---------- Workspace control (shared by main form + source tab) ----------
function WorkspaceControl({
  value,
  onChange,
  onPick,
  onLoad,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: () => void;
  onLoad: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Field label="作業ディレクトリ" required>
        <input
          value={value}
          placeholder="/path/to/repo"
          onChange={(event) => onChange(event.target.value)}
          className="mono"
          style={{ ...inputStyle(), fontFamily: "var(--strand-font-mono)" }}
        />
      </Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="outline" size="sm" icon="doc" onClick={onPick} style={{ flex: 1, justifyContent: "center" }}>
          フォルダを選択
        </Btn>
        <Btn variant="outline" size="sm" icon="arrow" onClick={onLoad} style={{ flex: 1, justifyContent: "center" }}>
          読込
        </Btn>
      </div>
    </div>
  );
}

// ---------- Small inline strand helpers ----------

// ---------- Inline strand Provider Health strip (replaces ProviderHealthBar) ----------
function ProviderHealthStrip({ providers }: { providers: ProviderKind[] }) {
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
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {error && <InlineAlert tone="danger" spaced>{error}</InlineAlert>}
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
}: {
  selected: KnowledgeResource[];
  onChange: (items: KnowledgeResource[]) => void;
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
      <div style={{ padding: 12 }}>
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
                onChange={(event) => setPath(event.target.value)}
                className="mono"
                style={{ ...inputStyle(), fontFamily: "var(--strand-font-mono)" }}
              />
              <Btn variant="outline" size="sm" icon="plus" disabled={!path.trim()} onClick={() => void importLocal()}>
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
                    <button type="button" onClick={() => toggle(item)} style={{ flex: 1, minWidth: 0, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}>
                      <Dot tone={sel ? "accent" : "neutral"} size={6} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </span>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{item.kind}</span>
                    </button>
                    <button
                      type="button"
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
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  style={inputStyle()}
                />
              </Field>
              <Field label="kind">
                <select
                  value={draft.kind}
                  onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}
                  className="mono"
                  style={selectStyle()}
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
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              style={textareaStyle()}
            />
            <Btn variant="outline" size="sm" icon="plus" disabled={!draft.title.trim()} onClick={() => void saveManual()}>
              保存して添付
            </Btn>
          </div>
        </div>
        {status && <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>{status}</div>}
      </div>
    </Panel>
  );
}

function SourceTree({
  root,
  treeByPath,
  openDirs,
  activeFile,
  onToggleDir,
  onOpenFile,
}: {
  root: string;
  treeByPath: Record<string, SourceTreeItem[]>;
  openDirs: Set<string>;
  activeFile: string;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const items = treeByPath[root] ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((item) => (
        <SourceTreeNode
          key={item.path}
          item={item}
          depth={0}
          treeByPath={treeByPath}
          openDirs={openDirs}
          activeFile={activeFile}
          onToggleDir={onToggleDir}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}

function VersionControlSummary({
  state,
  message,
}: {
  state?: CodingWorktreeState;
  message: string;
}) {
  return (
    <div
      className="mono"
      style={{
        marginTop: 8,
        borderRadius: 3,
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        padding: 8,
        fontSize: 10,
        color: "var(--ink-3)",
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600, color: "var(--ink)" }}>Git / worktree</div>
      {message && <div style={{ marginBottom: 4, color: "var(--info)" }}>{message}</div>}
      {state ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>元repo: {state.source_working_directory}</div>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>AI作業: {state.worktree_path}</div>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>branch: {state.ai_branch}</div>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>base: {state.base_branch} / {state.base_commit.slice(0, 10)}</div>
          {state.user_dirty && (
            <div style={{ borderRadius: 3, border: "1px solid var(--warn)", background: "var(--warn-bg)", color: "var(--warn)", padding: 4 }}>
              ユーザ変更 {state.user_changed_files.length}件
              {state.user_untracked_files.length ? ` / 未追跡 ${state.user_untracked_files.length}件` : ""}
            </div>
          )}
        </div>
      ) : (
        <div>実行時に元repoからAI専用worktreeを作成します。</div>
      )}
    </div>
  );
}

function SourceTreeNode({
  item,
  depth,
  treeByPath,
  openDirs,
  activeFile,
  onToggleDir,
  onOpenFile,
}: {
  item: SourceTreeItem;
  depth: number;
  treeByPath: Record<string, SourceTreeItem[]>;
  openDirs: Set<string>;
  activeFile: string;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const isDir = item.kind === "directory";
  const open = openDirs.has(item.path);
  const isActive = activeFile === item.path;
  return (
    <div>
      <button
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 4,
          borderRadius: 3,
          padding: "5px 6px",
          paddingLeft: depth * 14 + 6,
          textAlign: "left",
          fontSize: 11,
          background: isActive ? "var(--surface)" : "transparent",
          color: isActive ? "var(--ink)" : "var(--ink-2)",
        }}
        onClick={() => (isDir ? onToggleDir(item.path) : onOpenFile(item.path))}
      >
        {isDir ? (
          <>
            <ChevronRight style={{ width: 12, height: 12, transition: "transform 0.1s", transform: open ? "rotate(90deg)" : undefined }} />
            {open ? (
              <FolderOpen style={{ width: 14, height: 14, color: "var(--accent-deep)" }} />
            ) : (
              <Folder style={{ width: 14, height: 14, color: "var(--accent-deep)" }} />
            )}
          </>
        ) : (
          <>
            <span style={{ width: 12 }} />
            <FileCode2 style={{ width: 14, height: 14, color: "var(--ink-3)" }} />
          </>
        )}
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
      </button>
      {isDir && open && (treeByPath[item.path] ?? []).map((child) => (
        <SourceTreeNode
          key={child.path}
          item={child}
          depth={depth + 1}
          treeByPath={treeByPath}
          openDirs={openDirs}
          activeFile={activeFile}
          onToggleDir={onToggleDir}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}

function AgentWorkList({
  agents,
  turns,
  events,
}: {
  agents: AgentConfig[];
  turns: TurnResult[];
  events: StreamEvent[];
}) {
  const enabled = agents.filter((agent) => agent.enabled !== false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {enabled.map((agent) => {
        const latest = [...turns].reverse().find((turn) => turn.agent_id === agent.id);
        const agentEvents = events.filter(
          (event) =>
            ("agent_id" in event && event.agent_id === agent.id) ||
            (event.type === "turn_completed" && event.turn.agent_id === agent.id),
        );
        const latestStarted = [...agentEvents].reverse().find((event) => event.type === "turn_started");
        const latestCompleted = [...agentEvents].reverse().find((event) => event.type === "turn_completed");
        const hasStartedAfterCompleted =
          (latestStarted?.sequence ?? -1) > (latestCompleted?.sequence ?? -1);
        const status = latest?.error
          ? "エラー"
          : latest && !hasStartedAfterCompleted
            ? "完了"
            : latestStarted
              ? "実行中"
              : "待機中";
        const statusToneValue = status === "エラー" ? "danger" : status === "完了" ? "info" : status === "実行中" ? "ok" : "neutral";
        return (
          <div key={agent.id} style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}>
            <div style={{ marginBottom: 8, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {agent.name}
                </div>
                <div className="mono" style={{ marginTop: 4, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                  {ROLE_LABEL[agent.org_role]} · {PROVIDER_LABEL[agent.provider]}
                </div>
              </div>
              <Pill tone={statusToneValue}>{status}</Pill>
            </div>
            <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 8, fontSize: 11, color: "var(--ink-2)" }}>
              {latest?.error ? (
                <pre style={{ whiteSpace: "pre-wrap", color: "var(--danger)", margin: 0 }}>{latest.error}</pre>
              ) : latest?.output ? (
                <pre style={{ maxHeight: 256, overflow: "auto", whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", lineHeight: 1.6, margin: 0 }}>
                  {latest.output}
                </pre>
              ) : (
                "このエージェントの出力はまだありません。"
              )}
            </div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: 8, fontSize: 10, color: "var(--ink-3)" }}>
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>実行ログ</div>
              {agentEvents.length ? (
                agentEvents.map((event, index) => (
                  <div key={`${event.sequence ?? index}-${event.type}`} style={{ lineHeight: 1.5 }}>
                    {formatStreamEvent(event)}
                  </div>
                ))
              ) : (
                <div>まだ開始していません。</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServerLogPanel() {
  const [content, setContent] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getServerLogs();
      setContent(res.content || (res.exists ? "(空)" : "(ログファイル未生成)"));
      setPath(res.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(id);
  }, [autoRefresh]);

  return (
    <Panel
      title="サーバーログ"
      action={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--ink-3)", textTransform: "none", letterSpacing: 0 }}>
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
            自動更新
          </label>
          <Btn variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "読込中" : "更新"}
          </Btn>
        </span>
      }
      padded={false}
    >
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {path && <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{path}</div>}
        {error && <InlineAlert tone="danger" spaced>{error}</InlineAlert>}
        {loading && !content ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 10, borderRadius: 2, background: "var(--surface-sunk)" }} />
            ))}
          </div>
        ) : content ? (
          <pre
            className="mono"
            style={{
              maxHeight: 288,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              borderRadius: 3,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              padding: 8,
              fontSize: 10,
              lineHeight: 1.5,
              color: "var(--ink-3)",
              margin: 0,
            }}
          >
            {content}
          </pre>
        ) : (
          <EmptyState title="ログはまだありません" description="実行を開始するとここに表示されます。" />
        )}
      </div>
    </Panel>
  );
}

function RunLogView({
  events,
  turns,
  error,
}: {
  events: StreamEvent[];
  turns: TurnResult[];
  error: string;
}) {
  const completed = events.filter((event) => event.type === "turn_completed").length;
  const total = events.find((event) => event.type === "run_started")?.total_turns ?? turns.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Panel title="時系列ログ" padded={false}>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <InfoPill label="イベント" value={`${events.length}件`} />
            <InfoPill label="ターン" value={`${completed}/${Math.max(total, completed, 1)}`} />
          </div>
          {error && <InlineAlert tone="danger" spaced>{error}</InlineAlert>}
          <div
            style={{
              maxHeight: 288,
              overflow: "auto",
              borderRadius: 3,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              padding: 8,
              fontSize: 11,
              color: "var(--ink-3)",
            }}
          >
            {events.length ? (
              events.map((event, index) => (
                <div
                  key={`${event.sequence ?? index}-${event.type}`}
                  style={{ borderBottom: "1px solid var(--border)", padding: "6px 0" }}
                >
                  {formatStreamEvent(event)}
                </div>
              ))
            ) : (
              <div>{error || "ログはまだありません。"}</div>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="エージェント出力ログ" padded={false}>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {turns.length ? (
            turns.map((turn, index) => (
              <div key={`${turn.agent_id}-${index}`} style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 8 }}>
                <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{turn.agent_name}</span>
                  <Pill tone={turn.error ? "danger" : "neutral"}>{turn.error ? "エラー" : "完了"}</Pill>
                </div>
                <pre
                  style={{
                    maxHeight: 320,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: turn.error ? "var(--danger)" : "var(--ink-3)",
                    margin: 0,
                  }}
                >
                  {turn.error || turn.output || "出力はありません。"}
                </pre>
              </div>
            ))
          ) : (
            <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12, fontSize: 11, color: "var(--ink-3)" }}>
              エージェント出力はまだありません。
            </div>
          )}
        </div>
      </Panel>

      <details style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12, fontSize: 11 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink)" }}>生JSON</summary>
        <pre className="mono" style={{ marginTop: 8, maxHeight: 384, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 10, color: "var(--ink-3)" }}>
          {events.length ? JSON.stringify(events, null, 2) : "[]"}
        </pre>
      </details>
    </div>
  );
}

function CodingCEOChat({
  agent,
  session,
  message,
  status,
  sending,
  imageAttachments,
  onMessageChange,
  onImageAttachmentsChange,
  onStatusChange,
  onSend,
}: {
  agent?: AgentConfig;
  session?: ChatSession;
  message: string;
  status: string;
  sending: boolean;
  imageAttachments: ChatAttachment[];
  onMessageChange: (value: string) => void;
  onImageAttachmentsChange: Dispatch<SetStateAction<ChatAttachment[]>>;
  onStatusChange: (value: string) => void;
  onSend: () => void;
}) {
  if (!agent) {
    return (
      <div style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12, fontSize: 11, color: "var(--ink-3)" }}>
        チャットできるエージェントがありません。実行チームに CEO か有効なエージェントを追加してください。
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100%", flexDirection: "column", gap: 12 }}>
      <div style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <MessageSquareMore style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, color: "var(--accent-deep)" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {agent.name}
            </div>
            <div className="mono" style={{ marginTop: 4, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
              {ROLE_LABEL[agent.org_role]} · {PROVIDER_LABEL[agent.provider]}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6, color: "var(--ink-2)" }}>
              {agent.persona || "この依頼の判断・方針相談を担当します。"}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          minHeight: 260,
          flex: 1,
          overflowY: "auto",
          borderRadius: 4,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {!session?.messages.length && (
          <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center", fontSize: 11, lineHeight: 1.6, color: "var(--ink-3)" }}>
            CEOに方針確認、追加機能の切り方、エラー原因、次に何をすべきかを相談できます。
          </div>
        )}
        {session?.messages.map((item) => (
          <div
            key={item.id}
            style={{
              borderRadius: 3,
              border: item.role === "user" ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: item.role === "user" ? "var(--accent-soft)" : "var(--surface)",
              padding: 8,
            }}
          >
            <div className="mono" style={{ marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 9, color: "var(--ink-4)" }}>
              <span>{item.role === "user" ? "あなた" : item.agent_name ?? agent.name}</span>
              <span>{new Date(item.created_at).toLocaleString("ja-JP")}</span>
            </div>
            <pre style={{ maxHeight: 288, overflow: "auto", whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", fontSize: 11, lineHeight: 1.6, color: "var(--ink)", margin: 0 }}>
              {item.content}
            </pre>
            {item.attachments && item.attachments.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                {item.attachments.map((attachment, index) => (
                  <span
                    key={`${item.id}-${attachment.title}-${index}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 2, border: "1px solid var(--border)", padding: "2px 6px", fontSize: 9, color: "var(--ink-3)" }}
                  >
                    <ImageIcon style={{ width: 12, height: 12 }} />
                    {attachment.title}
                  </span>
                ))}
              </div>
            )}
            {item.error && (
              <div style={{ marginTop: 8, borderRadius: 3, border: "1px solid var(--warn)", background: "var(--warn-bg)", padding: 8, fontSize: 10, color: "var(--warn)" }}>
                {item.error}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          rows={4}
          value={message}
          placeholder="CEOに相談したいことを書いてください。例: この追加機能はどう切るべき？ / 先に直すべき問題は？"
          onChange={(event) => onMessageChange(event.target.value)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files).filter((file) =>
              file.type.startsWith("image/"),
            );
            if (files.length) {
              event.preventDefault();
              void addChatImageFiles(files, onImageAttachmentsChange, onStatusChange);
            }
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSend();
          }}
          style={textareaStyle()}
        />
        <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <label
              style={{
                display: "inline-flex",
                cursor: "pointer",
                alignItems: "center",
                gap: 8,
                borderRadius: 3,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: "5px 8px",
                fontSize: 11,
                color: "var(--ink-2)",
              }}
            >
              <ImageIcon style={{ width: 14, height: 14 }} />
              画像を添付
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void addChatImageFiles(files, onImageAttachmentsChange, onStatusChange);
                }}
              />
            </label>
            <div style={{ fontSize: 10, color: "var(--ink-4)" }}>貼り付けでも追加できます。</div>
          </div>
          {imageAttachments.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {imageAttachments.map((attachment, index) => (
                <div
                  key={`${attachment.title}-${index}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: "5px 8px", fontSize: 11 }}
                >
                  {attachment.content.startsWith("data:image/") ? (
                    <img
                      src={attachment.content}
                      alt={attachment.title}
                      style={{ width: 32, height: 32, borderRadius: 3, border: "1px solid var(--border)", objectFit: "cover" }}
                    />
                  ) : (
                    <ImageIcon style={{ width: 14, height: 14, color: "var(--ink-3)" }} />
                  )}
                  <span style={{ maxWidth: 144, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>
                    {attachment.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onImageAttachmentsChange((items) => items.filter((_, i) => i !== index))}
                    style={{ borderRadius: 3, padding: 2, color: "var(--ink-3)" }}
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0, fontSize: 11, color: "var(--ink-3)" }}>{status}</div>
          <Btn variant="solid" tone="accent" disabled={!message.trim() || sending} onClick={onSend}>
            {sending ? <Loader2 style={{ width: 14, height: 14 }} className="spin" /> : <Send style={{ width: 14, height: 14 }} />}
            送信
          </Btn>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "6px 8px" }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function Info({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  mono?: boolean;
}) {
  return (
    <Panel title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{icon}{label}</span>} padded={false}>
      <pre
        className={mono ? "mono" : undefined}
        style={{
          whiteSpace: "pre-wrap",
          fontSize: 11,
          lineHeight: 1.6,
          color: "var(--ink-3)",
          fontFamily: mono ? "var(--strand-font-mono)" : "var(--strand-font-sans)",
          padding: 12,
          margin: 0,
        }}
      >
        {value}
      </pre>
    </Panel>
  );
}

const STATUS_LABEL: Record<ManagedRequestStatus, string> = {
  draft: "下書き",
  running: "実行中",
  completed: "完了",
  paused: "停止/失敗",
};

const enabledAgentsCount = (agents: AgentConfig[]) =>
  agents.filter((agent) => agent.enabled !== false).length;

const codingChatSessionId = (requestId: string | undefined, agentId: string) => {
  const safeRequest = (requestId || "draft").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32);
  const safeAgent = agentId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32) || "agent";
  return `coding_chat_${safeRequest}_${safeAgent}`.slice(0, 80);
};

function buildCodingChatAttachments({
  request,
  selectedRecord,
  events,
  turns,
  error,
  sourcePath,
  sourceText,
}: {
  request: RefineRequest;
  selectedRecord?: ManagedRequest;
  events: StreamEvent[];
  turns: TurnResult[];
  error: string;
  sourcePath: string;
  sourceText: string;
}): ChatAttachment[] {
  const attachments: ChatAttachment[] = [
    {
      kind: "request",
      title: "Coding依頼",
      content: JSON.stringify(request, null, 2),
    },
  ];
  if (selectedRecord?.final_text || selectedRecord?.file_changes || selectedRecord?.diff) {
    attachments.push({
      kind: "context",
      title: "直近の実行結果",
      content: [
        selectedRecord.final_text ? `final_text:\n${truncateText(selectedRecord.final_text, 5000)}` : "",
        selectedRecord.file_changes ? `file_changes:\n${truncateText(selectedRecord.file_changes, 5000)}` : "",
        selectedRecord.diff ? `diff:\n${truncateText(selectedRecord.diff, 5000)}` : "",
      ].filter(Boolean).join("\n\n"),
    });
  }
  if (events.length || turns.length) {
    attachments.push({
      kind: "logs",
      title: "直近ログ",
      content: JSON.stringify({ events: events.slice(-30), turns: turns.slice(-10) }, null, 2),
    });
  }
  if (error) {
    attachments.push({ kind: "error", title: "現在のエラー", content: error });
  }
  if (sourcePath && sourceText) {
    attachments.push({
      kind: "context",
      title: `開いているファイル: ${sourcePath}`,
      content: truncateText(sourceText, 8000),
    });
  }
  return attachments.slice(0, 6);
}

async function addChatImageFiles(
  files: File[],
  setAttachments: Dispatch<SetStateAction<ChatAttachment[]>>,
  setStatus: (status: string) => void,
) {
  const imageFiles = files.filter((file) => file.type.startsWith("image/")).slice(0, 4);
  if (!imageFiles.length) return;
  const tooLarge = imageFiles.find((file) => file.size > 2 * 1024 * 1024);
  if (tooLarge) {
    setStatus(`${tooLarge.name} は 2MB を超えるため添付できません。`);
    return;
  }
  const attachments = await Promise.all(
    imageFiles.map(
      (file) =>
        new Promise<ChatAttachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              kind: "image",
              title: file.name || "pasted-image",
              content: String(reader.result ?? ""),
              content_type: file.type || "image/png",
              description: "ユーザーがCEOチャットへ添付した画像です。",
              size: file.size,
            });
          reader.onerror = () => reject(reader.error ?? new Error("画像を読み込めませんでした。"));
          reader.readAsDataURL(file);
        }),
    ),
  );
  setAttachments((items) => [...items, ...attachments].slice(0, 6));
  setStatus(`${attachments.length} 件の画像を添付しました。`);
}

const buildCodingVersion = ({
  versionNo,
  createdAt,
  requestValue,
  currentRun,
  versionControl,
}: {
  versionNo: number;
  createdAt: string;
  requestValue: RefineRequest;
  currentRun: CodingRunSnapshot;
  versionControl?: CodingWorktreeState;
}): WorkspaceVersion => {
  const title = `実行 ${versionNo} · ${new Date(createdAt).toLocaleString("ja-JP")}`;
  return {
    ...buildBaseVersion({
      id: `code_ver_${Date.now().toString(36)}_${versionNo}`,
      versionNo,
      title,
      createdAt,
      request: clone(requestValue),
      run: currentRun,
    }),
    version_control: versionControl,
  };
};

const isDuplicateCodingVersion = (latest: WorkspaceVersion | undefined, next: WorkspaceVersion) =>
  isDuplicateVersion(latest, next, true);

const findActiveTurnEvent = (events: StreamEvent[]) => {
  for (const event of [...events].reverse()) {
    if (event.type !== "turn_started") continue;
    const completedAfterStart = events.some(
      (candidate) =>
        candidate.type === "turn_completed" &&
        candidate.turn.agent_id === event.agent_id &&
        (candidate.sequence ?? 0) > (event.sequence ?? 0),
    );
    if (!completedAfterStart) return event;
  }
  return undefined;
};

const relativePath = (path: string, root: string) => {
  if (!root || !path.startsWith(root)) return path;
  return path.slice(root.length).replace(/^\/+/, "") || path;
};

const formatEventTime = (event: StreamEvent) => {
  if (!event.received_at) return "";
  return new Date(event.received_at).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatStreamEvent = (event: StreamEvent) => {
  const prefix = formatEventTime(event);
  const at = prefix ? `${prefix} · ` : "";
  if (event.type === "run_started") {
    const turns = event.total_turns ? ` / ${event.total_turns}ターン` : "";
    return `${at}実行開始${turns}`;
  }
  if (event.type === "round_started") {
    return `${at}ラウンド${event.round_index}開始`;
  }
  if (event.type === "turn_started") {
    const turn = event.turn_index ? `#${event.turn_index} ` : "";
    return `${at}${turn}${event.agent_name} が開始 (${PROVIDER_LABEL[event.provider]})`;
  }
  if (event.type === "turn_completed") {
    const turn = event.turn;
    const count =
      event.completed_turns && event.total_turns
        ? ` ${event.completed_turns}/${event.total_turns}`
        : "";
    return `${at}${turn.agent_name} が${turn.error ? "エラーで終了" : "完了"}${count}`;
  }
  if (event.type === "round_completed") {
    return `${at}ラウンド${event.round_index}完了`;
  }
  if (event.type === "run_completed") {
    return `${at}実行完了`;
  }
  if (event.type === "run_failed") {
    return `${at}実行失敗: ${event.error}`;
  }
  return `${at}不明なイベント`;
};
