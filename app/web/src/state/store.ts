import { create } from "zustand";
import type {
  AgentConfig,
  ModelDecision,
  OrgRole,
  ProviderKind,
  Project,
  QAJudgement,
  RefineRequest,
  ScreenId,
  StreamEvent,
  Template,
  TurnResult,
  Workflow,
} from "../types";
import { api } from "../api/client";
import { streamRefine } from "../api/stream";

const uid = () => Math.random().toString(36).slice(2, 10);

const ORG_ROLES: OrgRole[] = [
  "ceo",
  "manager",
  "worker",
  "pmo",
  "qa",
  "ui_designer",
  "system_designer",
  "ops_designer",
  "other",
];
const PROVIDERS: ProviderKind[] = ["gemini_cli", "claude_cli", "codex_cli", "custom_cli"];
const MODEL_DECISIONS: ModelDecision[] = ["fixed", "ceo_decides"];

const isOrgRole = (value: unknown): value is OrgRole =>
  typeof value === "string" && ORG_ROLES.includes(value as OrgRole);

const isProvider = (value: unknown): value is ProviderKind =>
  typeof value === "string" && PROVIDERS.includes(value as ProviderKind);

const isModelDecision = (value: unknown): value is ModelDecision =>
  typeof value === "string" && MODEL_DECISIONS.includes(value as ModelDecision);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const normalizeAgent = (value: unknown): AgentConfig => {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const orgRoles = asStringArray(raw.orgRoles);
  const orgRole = isOrgRole(raw.org_role)
    ? raw.org_role
    : isOrgRole(orgRoles[0])
      ? orgRoles[0]
      : "worker";
  const provider = isProvider(raw.provider) ? raw.provider : "codex_cli";
  const modelDecision = isModelDecision(raw.model_decision)
    ? raw.model_decision
    : isModelDecision(raw.modelDecision)
      ? raw.modelDecision
      : "ceo_decides";

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `agent_${uid()}`,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "New Agent",
    org_role: orgRole,
    provider,
    persona:
      typeof raw.persona === "string"
        ? raw.persona
        : typeof raw.personality === "string"
          ? raw.personality
          : typeof raw.system_prompt === "string"
            ? raw.system_prompt
            : typeof raw.systemPrompt === "string"
              ? raw.systemPrompt
              : "",
    skills: asStringArray(raw.skills),
    depends_on: asStringArray(raw.depends_on).length
      ? asStringArray(raw.depends_on)
      : asStringArray(raw.dependsOn),
    command_template:
      typeof raw.command_template === "string"
        ? raw.command_template
        : typeof raw.commandTemplate === "string"
          ? raw.commandTemplate
          : null,
    model: typeof raw.model === "string" ? raw.model : null,
    model_decision: modelDecision,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    mcp_enabled:
      typeof raw.mcp_enabled === "boolean"
        ? raw.mcp_enabled
        : typeof raw.mcpEnabled === "boolean"
          ? raw.mcpEnabled
          : false,
    mcp_config_path:
      typeof raw.mcp_config_path === "string"
        ? raw.mcp_config_path
        : typeof raw.mcpConfigPath === "string"
          ? raw.mcpConfigPath
          : null,
    mcp_servers: asStringArray(raw.mcp_servers).length
      ? asStringArray(raw.mcp_servers)
      : asStringArray(raw.mcpServers),
    mcp_instruction:
      typeof raw.mcp_instruction === "string"
        ? raw.mcp_instruction
        : typeof raw.mcpInstruction === "string"
          ? raw.mcpInstruction
          : "",
    mcp_context_command:
      typeof raw.mcp_context_command === "string"
        ? raw.mcp_context_command
        : typeof raw.mcpContextCommand === "string"
          ? raw.mcpContextCommand
          : null,
    mcp_timeout_sec:
      typeof raw.mcp_timeout_sec === "number"
        ? raw.mcp_timeout_sec
        : typeof raw.mcpTimeoutSec === "number"
          ? raw.mcpTimeoutSec
          : 60,
    is_custom: typeof raw.is_custom === "boolean" ? raw.is_custom : true,
  };
};

const defaultAgents = (): AgentConfig[] => [
  {
    id: "ceo",
    name: "CEO",
    org_role: "ceo",
    provider: "codex_cli",
    persona: "最終意思決定とモデル選定を行う。",
    skills: ["decision", "prioritization"],
    depends_on: [],
    model_decision: "fixed",
    enabled: true,
    mcp_enabled: false,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_timeout_sec: 60,
    is_custom: false,
  },
  {
    id: "manager",
    name: "Manager",
    org_role: "manager",
    provider: "codex_cli",
    persona: "タスク分解と進行管理。",
    skills: ["planning"],
    depends_on: ["ceo"],
    model_decision: "ceo_decides",
    enabled: true,
    mcp_enabled: false,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_timeout_sec: 60,
    is_custom: false,
  },
  {
    id: "pmo",
    name: "PMO",
    org_role: "pmo",
    provider: "codex_cli",
    persona: "計画整合性とリスク監視。",
    skills: ["risk", "process"],
    depends_on: ["manager"],
    model_decision: "ceo_decides",
    enabled: true,
    mcp_enabled: false,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_timeout_sec: 60,
    is_custom: false,
  },
  ...[1, 2, 3].map<AgentConfig>((i) => ({
    id: `worker_${i}`,
    name: `Worker ${i}`,
    org_role: "worker",
    provider: "codex_cli",
    persona: "設計・実装担当。",
    skills: [],
    depends_on: ["manager"],
    model_decision: "ceo_decides",
    enabled: true,
    mcp_enabled: false,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_timeout_sec: 60,
    is_custom: false,
  })),
  ...[1, 2, 3].map<AgentConfig>((i) => ({
    id: `qa_${i}`,
    name: `QA ${i}`,
    org_role: "qa",
    provider: "codex_cli",
    persona: "成果物の独立レビューと判定。",
    skills: ["test", "review"],
    depends_on: [`worker_${i}`],
    model_decision: "ceo_decides",
    enabled: true,
    mcp_enabled: false,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_timeout_sec: 60,
    is_custom: false,
  })),
];

export interface RunState {
  status: "idle" | "running" | "completed" | "failed";
  events: StreamEvent[];
  turns: TurnResult[];
  currentRound: number;
  error?: string;
  finalText?: string;
  diff?: string;
  fileChanges?: string;
  startedAt?: number;
  endedAt?: number;
}

interface QAVerdict {
  qaId: string;
  judgement: QAJudgement;
  reason: string;
}

interface AppState {
  screen: ScreenId;
  setScreen: (s: ScreenId) => void;

  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;

  agents: AgentConfig[];
  projects: Project[];
  templates: Template[];
  workflows: Workflow[];

  selectedProjectId?: string;
  selectProject: (id?: string) => void;

  request: RefineRequest;
  updateRequest: (patch: Partial<RefineRequest>) => void;
  toggleAgentEnabled: (id: string) => void;
  upsertAgent: (a: AgentConfig) => void;
  removeAgent: (id: string) => void;
  deleteSavedAgent: (id: string) => Promise<void>;
  setAgents: (list: AgentConfig[]) => void;

  run: RunState;
  abortCtrl?: AbortController;
  startRun: () => Promise<void>;
  stopRun: () => void;
  resetRun: () => void;

  qaVerdicts: QAVerdict[];
  setQaVerdict: (v: QAVerdict) => void;

  loadAll: () => Promise<void>;
}

const initialRequest: RefineRequest = {
  workflow_mode: "writing",
  orchestration_mode: "role_based",
  source_text: "",
  objective: "",
  global_instruction: "",
  rounds: 1,
  code_context: {
    repository: "",
    working_directory: "",
    target_paths: [],
    tech_stack: "",
    acceptance_criteria: "",
    test_command: "",
  },
  agents: defaultAgents(),
};

export const useApp = create<AppState>((set, get) => ({
  screen: "workspace",
  setScreen: (s) => set({ screen: s }),

  drawerOpen: false,
  setDrawerOpen: (v) => set({ drawerOpen: v }),

  agents: defaultAgents(),
  projects: [],
  templates: [],
  workflows: [],
  selectedProjectId: undefined,
  selectProject: (id) => set({ selectedProjectId: id }),

  request: initialRequest,
  updateRequest: (patch) => set({ request: { ...get().request, ...patch } }),
  toggleAgentEnabled: (id) =>
    set({
      request: {
        ...get().request,
        agents: get().request.agents.map((a) =>
          a.id === id ? { ...a, enabled: !(a.enabled ?? true) } : a,
        ),
      },
    }),
  upsertAgent: (a) =>
    set((state) => {
      const exists = state.request.agents.some((x) => x.id === a.id);
      const agents = exists
        ? state.request.agents.map((x) => (x.id === a.id ? a : x))
        : [...state.request.agents, a];
      return { request: { ...state.request, agents } };
    }),
  removeAgent: (id) =>
    set({
      request: {
        ...get().request,
        agents: get().request.agents.filter((a) => a.id !== id),
      },
    }),
  deleteSavedAgent: async (id) => {
    await api.deleteAgent(id);
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
      request: {
        ...state.request,
        agents: state.request.agents.filter((a) => a.id !== id),
      },
    }));
  },
  setAgents: (list) => set({ request: { ...get().request, agents: list } }),

  run: { status: "idle", events: [], turns: [], currentRound: 0 },

  startRun: async () => {
    const { request } = get();
    const enabledAgents = request.agents.filter((a) => a.enabled !== false);
    if (enabledAgents.length === 0) {
      set({ run: { status: "failed", events: [], turns: [], currentRound: 0, error: "有効なエージェントがありません" } });
      return;
    }
    if (!request.source_text.trim()) {
      set({ run: { status: "failed", events: [], turns: [], currentRound: 0, error: "要件 (source_text) を入力してください" } });
      return;
    }
    const ctrl = new AbortController();
    set({
      abortCtrl: ctrl,
      qaVerdicts: [],
      run: {
        status: "running",
        events: [],
        turns: [],
        currentRound: 0,
        startedAt: Date.now(),
      },
    });
    try {
      const payload: RefineRequest = { ...request, agents: enabledAgents.map((a) => ({ ...a })) };
      for await (const ev of streamRefine(payload, ctrl.signal)) {
        const cur = get().run;
        const next: RunState = { ...cur, events: [...cur.events, ev] };
        if (ev.type === "round_started") next.currentRound = ev.round_index;
        if (ev.type === "turn_completed") next.turns = [...cur.turns, ev.turn];
        if (ev.type === "run_completed") {
          next.status = "completed";
          next.finalText = ev.result.final_text;
          next.diff = ev.result.diff;
          next.fileChanges = ev.result.file_changes;
          next.endedAt = Date.now();
        }
        if (ev.type === "run_failed") {
          next.status = "failed";
          next.error = ev.error;
          next.endedAt = Date.now();
        }
        set({ run: next });
      }
      const cur = get().run;
      if (cur.status === "running") {
        set({ run: { ...cur, status: "completed", endedAt: Date.now() } });
      }
    } catch (e: unknown) {
      const cur = get().run;
      const message = e instanceof Error ? e.message : String(e);
      set({ run: { ...cur, status: "failed", error: message, endedAt: Date.now() } });
    } finally {
      set({ abortCtrl: undefined });
    }
  },
  stopRun: () => {
    get().abortCtrl?.abort();
  },
  resetRun: () =>
    set({ run: { status: "idle", events: [], turns: [], currentRound: 0 } }),

  qaVerdicts: [],
  setQaVerdict: (v) =>
    set((state) => {
      const others = state.qaVerdicts.filter((x) => x.qaId !== v.qaId);
      return { qaVerdicts: [...others, v] };
    }),

  loadAll: async () => {
    try {
      const [agents, projects, templates, workflows] = await Promise.all([
        api.listAgents().catch(() => []),
        api.listProjects().catch(() => []),
        api.listTemplates().catch(() => []),
        api.listWorkflows().catch(() => []),
      ]);
      set({ agents: agents.map(normalizeAgent), projects, templates, workflows });
    } catch {
      // ignore
    }
  },
}));

export const newAgent = (org_role: AgentConfig["org_role"] = "worker"): AgentConfig => ({
  id: `agent_${uid()}`,
  name: "New Agent",
  org_role,
  provider: "codex_cli",
  persona: "",
  skills: [],
  depends_on: [],
  model_decision: "ceo_decides",
  enabled: true,
  mcp_enabled: false,
  mcp_servers: [],
  mcp_instruction: "",
  mcp_timeout_sec: 60,
  is_custom: true,
});
