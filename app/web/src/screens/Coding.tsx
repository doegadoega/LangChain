import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
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
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { ResizeHandle } from "../components/ui/ResizeHandle";
import { KnowledgePicker } from "../components/KnowledgePicker";
import { ProviderHealthBar } from "../components/ProviderHealthBar";
import { useToast } from "../components/ui/Toast";
import { Empty } from "../components/ui/Empty";
import { Alert } from "../components/ui/Alert";
import { Skeleton } from "../components/ui/Skeleton";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
import { api } from "../api/client";
import { PROVIDER_LABEL, ROLE_LABEL, formatDuration } from "../lib/format";
import { useApp } from "../state/store";
import type {
  AgentConfig,
  ChatAttachment,
  ChatSession,
  CodingWorktreeState,
  ManagedRequest,
  ManagedRequestStatus,
  RefineRequest,
  SourceTreeItem,
  StreamEvent,
  Template,
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
    const baseWorkingDirectory =
      selectedRecord?.version_control?.source_working_directory ||
      requestValue.code_context.repository ||
      requestValue.code_context.working_directory;
    if (!baseWorkingDirectory.trim()) {
      return { requestValue };
    }
    const versionControl = await api.prepareCodingWorktree({
      request_id: `${recordId}-${Date.now().toString(36)}`,
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
    <div
      className="grid h-full overflow-hidden bg-[var(--color-bg)]"
      style={{
        gridTemplateColumns: `${layout.requestList}px 6px minmax(560px,1fr) 6px ${layout.statusPanel}px`,
      }}
    >
      <aside className="flex min-w-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-semibold" style={{ fontSize: "var(--text-sm)" }}>Coding</div>
              <div className="text-[var(--color-fg-muted)]" style={{ fontSize: "var(--text-xs)" }}>
                実装依頼とソースを管理します。
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={newRequest}>
              新規
            </Button>
          </div>
          <div role="tablist" className="inline-flex w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === "requests"}
              onClick={() => setLeftTab("requests")}
              className={clsx(
                "flex-1 rounded px-2 py-1 transition-colors",
                leftTab === "requests"
                  ? "bg-[var(--color-surface-3)] text-[var(--color-fg)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
              style={{ fontSize: "var(--text-sm)" }}
            >
              依頼一覧
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === "tree"}
              onClick={() => setLeftTab("tree")}
              className={clsx(
                "flex-1 rounded px-2 py-1 transition-colors",
                leftTab === "tree"
                  ? "bg-[var(--color-surface-3)] text-[var(--color-fg)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
              style={{ fontSize: "var(--text-sm)" }}
            >
              ソース
            </button>
          </div>
        </div>

        {leftTab === "requests" ? (
          <>
            <div className="border-b border-[var(--color-border)] p-3">
              <Button size="sm" variant="danger" className="w-full" disabled={!activeId} onClick={() => void removeActive()}>
                選択中の依頼を削除
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {codingRequests.length === 0 ? (
                <Empty dense title="コーディング依頼はまだありません" description="右上の「新規」から作成してください。" />
              ) : (
                <div className="space-y-1">
                  {codingRequests.map((item) => (
                    <button
                      key={item.id}
                      className={clsx(
                        "w-full rounded-md border p-2 text-left transition-colors",
                        activeId === item.id
                          ? "border-[var(--color-accent)] bg-[var(--color-surface-3)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]",
                      )}
                      onClick={() => selectRecord(item)}
                    >
                      <div className="truncate font-semibold" style={{ fontSize: "var(--text-sm)" }}>{item.title}</div>
                      <div
                        className="mt-1 flex items-center justify-between text-[var(--color-fg-subtle)]"
                        style={{ fontSize: "var(--text-xs)" }}
                      >
                        <span>{STATUS_LABEL[item.status]}</span>
                        <span>{new Date(item.updated_at).toLocaleString("ja-JP")}</span>
                      </div>
                      <div
                        className="mt-1 truncate text-[var(--color-fg-muted)]"
                        style={{ fontSize: "var(--text-xs)" }}
                      >
                        {item.request.code_context.working_directory || "working_directory 未設定"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-[var(--color-border)] p-3">
              <Label>作業ディレクトリ</Label>
              <div className="space-y-2">
                <Input
                  value={draft.code_context.working_directory}
                  placeholder="/path/to/repo"
                  onChange={(event) => updateCodeContext({ working_directory: event.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => void pickDirectory()}>
                    フォルダを選択
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void loadTree()}>
                    読込
                  </Button>
                </div>
              </div>
              {sourceError && <Alert kind="error" className="mt-2">{sourceError}</Alert>}
              {(displayedVersionControl || versionMessage) && (
                <VersionControlSummary state={displayedVersionControl} message={versionMessage} />
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
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
                <Empty
                  dense
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

      <main className="flex min-w-0 flex-col overflow-hidden">
        <section className="flex min-w-0 flex-col overflow-hidden">
          <div className="border-b border-[var(--color-border)] p-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <Label>コーディング依頼名</Label>
                <Input value={title} placeholder="例: TODOリスト実装" onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div>
                <Label>実行チーム</Label>
                <Select
                  value={selectedTeamTemplateId}
                  onChange={(event) => applyTemplate(event.target.value)}
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
                </Select>
              </div>
            </div>
          </div>

          <div
            className="grid min-h-0 flex-1 overflow-hidden"
            style={{ gridTemplateRows: `${layout.formPane}px 6px minmax(220px,1fr)` }}
          >
            <div className="overflow-y-auto border-b border-[var(--color-border)] p-3">
              <div className="grid gap-3 xl:grid-cols-2">
                <div>
                  <Label>依頼内容</Label>
                  <Textarea
                    rows={8}
                    className="font-sans"
                    value={draft.source_text}
                    placeholder="何を作る・直すかを書いてください"
                    onChange={(event) => updateDraft({ source_text: event.target.value })}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <Label>対象ファイル</Label>
                    <Textarea
                      rows={3}
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
                    />
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <div>
                      <Label>テストコマンド</Label>
                      <Input
                        value={draft.code_context.test_command}
                        placeholder="npm run build"
                        onChange={(event) => updateCodeContext({ test_command: event.target.value })}
                      />
                    </div>
                    <div>
                      <Label>技術スタック</Label>
                      <Input
                        value={draft.code_context.tech_stack}
                        placeholder="Swift / React / FastAPI"
                        onChange={(event) => updateCodeContext({ tech_stack: event.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>受け入れ条件</Label>
                    <Textarea
                      rows={3}
                      className="font-sans"
                      value={draft.code_context.acceptance_criteria}
                      placeholder="完了条件、避けたい変更、確認観点"
                      onChange={(event) => updateCodeContext({ acceptance_criteria: event.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {run.status === "running" ? (
                  <Button variant="danger" className="flex-1" onClick={stopRun}>
                    <Square className="h-4 w-4" />
                    停止
                  </Button>
                ) : (
                  <Button className="flex-1" disabled={!canRun} onClick={() => void runCoding()}>
                    <Play className="h-4 w-4" />
                    この依頼を実行
                  </Button>
                )}
                <Button variant="outline" onClick={() => void saveDraft()}>
                  保存
                </Button>
                <Button variant="ghost" onClick={resetRun}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3">
                <KnowledgePicker
                  selected={draft.knowledge_context ?? []}
                  onChange={(knowledge_context) => updateDraft({ knowledge_context })}
                />
              </div>
              <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">追加機能</div>
                    <div className="text-[11px] text-[var(--color-fg-muted)]">
                      選択中の依頼と直近結果を前提に、続きの実装を走らせます。
                    </div>
                  </div>
                  <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-fg-muted)]">
                    {selectedRecord?.versions?.length ?? 0} history
                  </span>
                </div>
                <Textarea
                  rows={3}
                  className="font-sans"
                  value={featureRequest}
                  placeholder="例: TODOに期限と完了フィルタを追加する"
                  onChange={(event) => setFeatureRequest(event.target.value)}
                />
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <Button
                    variant="outline"
                    disabled={!activeId || !featureRequest.trim() || run.status === "running" || !canRun}
                    onClick={() => void runFeatureAddition()}
                  >
                    <Play className="h-4 w-4" />
                    追加機能として実行
                  </Button>
                  <Button variant="ghost" disabled={!featureRequest} onClick={() => setFeatureRequest("")}>
                    クリア
                  </Button>
                </div>
              </div>
              {saveMessage && <div className="mt-2 text-xs text-[var(--color-fg-muted)]">{saveMessage}</div>}
            </div>
            <ResizeHandle
              axis="y"
              label="依頼フォームとソース表示の高さを調整"
              onPointerDown={(event) => beginResize("formPane", event)}
              onAdjust={(delta) => adjustResize("formPane", delta)}
            />

            <div className="flex min-h-0 flex-col overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-fg-muted)]">
                <FileCode2 className="h-4 w-4" />
                <span className="truncate">{sourcePath || "ソースコード"}</span>
              </div>
              <div className="flex-1 overflow-auto bg-[var(--color-bg)] p-4">
                {sourceError ? (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                    {sourceError}
                  </div>
                ) : sourceText ? (
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--color-fg)]">
                    {sourceText}
                  </pre>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-[var(--color-fg-subtle)]">
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

      <aside className="flex min-w-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]">
        <CardHeader>
          <div>
            <CardTitle>作業状況</CardTitle>
            <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
              {run.status} · {formatDuration(run.startedAt, run.endedAt)}
            </div>
          </div>
          {run.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-sky-300" />}
        </CardHeader>
        <div className="border-b border-[var(--color-border)] px-3 pb-3">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
            <span>{completedTurnCount}/{totalTurnCount} turns</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
            <div className="h-full rounded-full bg-[var(--color-accent)] transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-xs text-[var(--color-fg-muted)]">
            {displayedError
              ? `停止: ${displayedError}`
              : run.status === "completed"
                ? "完了しました。"
                : activeTurnEvent
                  ? `現在: ${activeTurnEvent.agent_name} が実行中`
                  : "実行待ちです。"}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 border-b border-[var(--color-border)] p-2 text-xs">
          {(["agents", "diff", "logs", "chat"] as ResultTab[]).map((tab) => (
            <button
              key={tab}
              className={clsx(
                "rounded px-2 py-2 font-semibold",
                resultTab === tab
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]",
              )}
              onClick={() => setResultTab(tab)}
            >
              {tab === "agents" ? "Agents" : tab === "diff" ? "Code" : tab === "logs" ? "Logs" : "CEO"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {displayedError && (
            <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs leading-relaxed text-red-200">
              {displayedError}
            </div>
          )}
          {resultTab === "agents" && (
            <div className="space-y-3">
              <ProviderHealthBar providers={draft.agents.map((a) => a.provider)} />
              <AgentWorkList agents={draft.agents} turns={displayedTurns} events={displayedEvents} />
            </div>
          )}
          {resultTab === "diff" && (
            <div className="space-y-3">
              <Info label="最終出力" value={displayedFinal || "まだ結果はありません。"} icon={<ListChecks className="h-4 w-4" />} />
              <Info label="diff / file changes" value={displayedDiff || "まだファイル変更はありません。"} icon={<Code2 className="h-4 w-4" />} mono />
            </div>
          )}
          {resultTab === "logs" && (
            <div className="space-y-3">
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
    <div className="space-y-0.5 text-xs">
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
    <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-[11px] text-[var(--color-fg-muted)]">
      <div className="mb-1 font-semibold text-[var(--color-fg)]">Git / worktree</div>
      {message && <div className="mb-1 text-sky-200">{message}</div>}
      {state ? (
        <div className="space-y-1">
          <div className="truncate">元repo: {state.source_working_directory}</div>
          <div className="truncate">AI作業: {state.worktree_path}</div>
          <div className="truncate">branch: {state.ai_branch}</div>
          <div className="truncate">base: {state.base_branch} / {state.base_commit.slice(0, 10)}</div>
          {state.user_dirty && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-1 text-amber-200">
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
  return (
    <div>
      <button
        className={clsx(
          "flex w-full items-center gap-1 rounded px-1.5 py-1 text-left hover:bg-[var(--color-surface-2)]",
          activeFile === item.path && "bg-[var(--color-surface-3)] text-[var(--color-fg)]",
        )}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={() => (isDir ? onToggleDir(item.path) : onOpenFile(item.path))}
      >
        {isDir ? (
          <>
            <ChevronRight className={clsx("h-3 w-3 transition-transform", open && "rotate-90")} />
            {open ? <FolderOpen className="h-3.5 w-3.5 text-sky-300" /> : <Folder className="h-3.5 w-3.5 text-sky-300" />}
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileCode2 className="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
          </>
        )}
        <span className="min-w-0 truncate">{item.name}</span>
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
    <div className="space-y-2">
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
        return (
          <div key={agent.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{agent.name}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  {ROLE_LABEL[agent.org_role]} · {PROVIDER_LABEL[agent.provider]}
                </div>
              </div>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-fg-muted)]">
                {status}
              </span>
            </div>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs text-[var(--color-fg-muted)]">
              {latest?.error ? (
                <pre className="whitespace-pre-wrap text-red-300">{latest.error}</pre>
              ) : latest?.output ? (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-sans leading-relaxed">{latest.output}</pre>
              ) : (
                "このエージェントの出力はまだありません。"
              )}
            </div>
            <div className="mt-2 space-y-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[11px] text-[var(--color-fg-muted)]">
              <div className="font-semibold text-[var(--color-fg)]">実行ログ</div>
              {agentEvents.length ? (
                agentEvents.map((event, index) => (
                  <div key={`${event.sequence ?? index}-${event.type}`} className="leading-relaxed">
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
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-[var(--color-fg)]">サーバーログ</div>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1 text-[var(--color-fg-muted)]">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              自動更新
            </label>
            <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
              {loading ? "読込中" : "更新"}
            </Button>
          </div>
        </div>
        {path && (
          <div className="text-[var(--color-fg-muted)]" style={{ fontSize: "var(--text-xs)" }}>{path}</div>
        )}
        {error && <Alert kind="error" title="ログ取得に失敗">{error}</Alert>}
        {loading && !content ? (
          <Skeleton variant="text" lines={6} />
        ) : content ? (
          <pre
            className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 font-mono text-[var(--color-fg-muted)]"
            style={{ fontSize: "var(--text-code)", lineHeight: "var(--text-code--line-height)" }}
          >
            {content}
          </pre>
        ) : (
          <Empty title="ログはまだありません" description="実行を開始するとここに表示されます。" dense />
        )}
      </CardBody>
    </Card>
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
    <div className="space-y-3">
      <Card>
        <CardBody className="space-y-2">
          <div className="text-xs font-semibold text-[var(--color-fg)]">時系列ログ</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-fg-muted)]">
            <InfoPill label="イベント" value={`${events.length}件`} />
            <InfoPill label="ターン" value={`${completed}/${Math.max(total, completed, 1)}`} />
          </div>
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
              {error}
            </div>
          )}
          <div className="max-h-72 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-xs text-[var(--color-fg-muted)]">
            {events.length ? (
              events.map((event, index) => (
                <div key={`${event.sequence ?? index}-${event.type}`} className="border-b border-[var(--color-border)] py-1.5 last:border-b-0">
                  {formatStreamEvent(event)}
                </div>
              ))
            ) : (
              <div>{error || "ログはまだありません。"}</div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <div className="text-xs font-semibold text-[var(--color-fg)]">エージェント出力ログ</div>
          {turns.length ? (
            turns.map((turn, index) => (
              <div key={`${turn.agent_id}-${index}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[var(--color-fg)]">{turn.agent_name}</span>
                  <span className={clsx("rounded-full border px-2 py-0.5 text-[10px]", turn.error ? "border-red-500/40 text-red-200" : "border-[var(--color-border)] text-[var(--color-fg-muted)]")}>
                    {turn.error ? "エラー" : "完了"}
                  </span>
                </div>
                <pre className={clsx("max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-relaxed", turn.error ? "text-red-200" : "text-[var(--color-fg-muted)]")}>
                  {turn.error || turn.output || "出力はありません。"}
                </pre>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-fg-muted)]">
              エージェント出力はまだありません。
            </div>
          )}
        </CardBody>
      </Card>

      <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-[var(--color-fg)]">生JSON</summary>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[var(--color-fg-muted)]">
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
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-fg-muted)]">
        チャットできるエージェントがありません。実行チームに CEO か有効なエージェントを追加してください。
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-3">
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <div className="flex items-start gap-2">
          <MessageSquareMore className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{agent.name}</div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
              {ROLE_LABEL[agent.org_role]} · {PROVIDER_LABEL[agent.provider]}
            </div>
            <div className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--color-fg-muted)]">
              {agent.persona || "この依頼の判断・方針相談を担当します。"}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[260px] flex-1 space-y-3 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        {!session?.messages.length && (
          <div className="grid h-full place-items-center text-center text-xs leading-relaxed text-[var(--color-fg-subtle)]">
            CEOに方針確認、追加機能の切り方、エラー原因、次に何をすべきかを相談できます。
          </div>
        )}
        {session?.messages.map((item) => (
          <div
            key={item.id}
            className={clsx(
              "rounded-md border p-2",
              item.role === "user"
                ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10"
                : "border-[var(--color-border)] bg-[var(--color-surface)]",
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--color-fg-subtle)]">
              <span>{item.role === "user" ? "あなた" : item.agent_name ?? agent.name}</span>
              <span>{new Date(item.created_at).toLocaleString("ja-JP")}</span>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--color-fg)]">
              {item.content}
            </pre>
            {item.attachments && item.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 border-t border-[var(--color-border)] pt-2">
                {item.attachments.map((attachment, index) => (
                  <span
                    key={`${item.id}-${attachment.title}-${index}`}
                    className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-muted)]"
                  >
                    <ImageIcon className="h-3 w-3" />
                    {attachment.title}
                  </span>
                ))}
              </div>
            )}
            {item.error && (
              <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                {item.error}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Textarea
          rows={4}
          className="font-sans"
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
        />
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]">
              <ImageIcon className="h-4 w-4" />
              画像を添付
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void addChatImageFiles(files, onImageAttachmentsChange, onStatusChange);
                }}
              />
            </label>
            <div className="text-[11px] text-[var(--color-fg-subtle)]">貼り付けでも追加できます。</div>
          </div>
          {imageAttachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {imageAttachments.map((attachment, index) => (
                <div
                  key={`${attachment.title}-${index}`}
                  className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs"
                >
                  {attachment.content.startsWith("data:image/") ? (
                    <img
                      src={attachment.content}
                      alt={attachment.title}
                      className="h-8 w-8 rounded border border-[var(--color-border)] object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-[var(--color-fg-muted)]" />
                  )}
                  <span className="max-w-36 truncate">{attachment.title}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onImageAttachmentsChange((items) => items.filter((_, i) => i !== index))
                    }
                    className="rounded p-0.5 text-[var(--color-fg-muted)] hover:bg-red-500/20 hover:text-red-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-xs text-[var(--color-fg-muted)]">{status}</div>
          <Button disabled={!message.trim()} loading={sending} onClick={onSend}>
            {!sending && <Send className="h-4 w-4" />}
            送信
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">{label}</div>
      <div className="mt-1 text-[var(--color-fg)]">{value}</div>
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
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-fg)]">
          {icon}
          {label}
        </div>
        <pre
          className={clsx(
            "whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-fg-muted)]",
            mono ? "font-mono" : "font-sans",
          )}
        >
          {value}
        </pre>
      </CardBody>
    </Card>
  );
}

const STATUS_LABEL: Record<ManagedRequestStatus, string> = {
  draft: "下書き",
  running: "実行中",
  completed: "完了",
  paused: "停止/失敗",
};

const teamLabel = (template: Template) =>
  `${template.locked || template.is_builtin ? "Built-in" : "Custom"} · ${template.name}`;

const enabledAgentsCount = (agents: AgentConfig[]) =>
  agents.filter((agent) => agent.enabled !== false).length;

const truncateText = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}\n...` : value;

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
    id: `code_ver_${Date.now().toString(36)}_${versionNo}`,
    version_no: versionNo,
    title,
    created_at: createdAt,
    request: clone(requestValue),
    final_text: currentRun.finalText,
    diff: currentRun.diff,
    file_changes: currentRun.fileChanges,
    error: currentRun.error,
    agent_turns: currentRun.turns.length > 0 ? currentRun.turns : undefined,
    stream_events: currentRun.events.length > 0 ? currentRun.events : undefined,
    version_control: versionControl,
    run_started_at: currentRun.startedAt ? new Date(currentRun.startedAt).toISOString() : undefined,
    run_ended_at: currentRun.endedAt ? new Date(currentRun.endedAt).toISOString() : undefined,
  };
};

const isDuplicateCodingVersion = (latest: WorkspaceVersion | undefined, next: WorkspaceVersion) =>
  Boolean(
    latest &&
      latest.run_started_at === next.run_started_at &&
      latest.run_ended_at === next.run_ended_at &&
      latest.final_text === next.final_text &&
      latest.diff === next.diff &&
      latest.file_changes === next.file_changes,
  );

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
