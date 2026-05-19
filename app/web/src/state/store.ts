import { create } from "zustand";
import type {
  AgentConfig,
  ManagedRequest,
  KnowledgeResource,
  ModelDecision,
  OrgRole,
  ProviderHealth,
  ProviderKind,
  Project,
  QAJudgement,
  RefineRequest,
  ScreenId,
  SkillReference,
  StreamEvent,
  Template,
  TurnResult,
  VerificationFeedback,
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
const PROVIDERS: ProviderKind[] = [
  "gemini_cli",
  "claude_cli",
  "codex_cli",
  "android_cli",
  "openai_api",
  "anthropic_api",
  "deepseek_api",
  "ollama",
  "lm_studio",
  "custom_cli",
];
const MODEL_DECISIONS: ModelDecision[] = ["fixed", "ceo_decides"];

const isOrgRole = (value: unknown): value is OrgRole =>
  typeof value === "string" && ORG_ROLES.includes(value as OrgRole);

const isProvider = (value: unknown): value is ProviderKind =>
  typeof value === "string" && PROVIDERS.includes(value as ProviderKind);

const isModelDecision = (value: unknown): value is ModelDecision =>
  typeof value === "string" && MODEL_DECISIONS.includes(value as ModelDecision);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const KNOWLEDGE_KINDS = ["markdown", "text", "image", "figma", "mcp", "link", "note"] as const;

const isKnowledgeKind = (value: unknown): value is KnowledgeResource["kind"] =>
  typeof value === "string" && (KNOWLEDGE_KINDS as readonly string[]).includes(value);

const normalizeKnowledgeResource = (value: unknown): KnowledgeResource => {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `knowledge_${uid()}`,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "Untitled knowledge",
    kind: isKnowledgeKind(raw.kind) ? raw.kind : "markdown",
    content: typeof raw.content === "string" ? raw.content : "",
    source: typeof raw.source === "string" ? raw.source : "",
    content_type: typeof raw.content_type === "string" ? raw.content_type : "",
    tags: asStringArray(raw.tags),
  };
};

const isSkillSource = (value: unknown): value is SkillReference["source"] =>
  value === "bundled" || value === "user" || value === "imported" || value === "discovered";

const isSkillVersionKind = (value: unknown): value is SkillReference["version_requirement"]["kind"] =>
  value === "exact" || value === "latest_compatible" || value === "latest";

const normalizeSkillRefs = (value: unknown): SkillReference[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): SkillReference | undefined => {
      const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      const id = typeof raw.id === "string" ? raw.id.trim() : "";
      if (!id) return undefined;
      const rawRequirement =
        typeof raw.version_requirement === "object" && raw.version_requirement !== null
          ? (raw.version_requirement as Record<string, unknown>)
          : {};
      const kind = isSkillVersionKind(rawRequirement.kind) ? rawRequirement.kind : "latest";
      return {
        id,
        source: isSkillSource(raw.source) ? raw.source : "user",
        version_requirement: {
          kind,
          version:
            typeof rawRequirement.version === "string" && rawRequirement.version.trim()
              ? rawRequirement.version.trim()
              : null,
        },
        enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
      };
    })
    .filter((item): item is SkillReference => Boolean(item));
};

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
    skill_refs: normalizeSkillRefs(raw.skill_refs),
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
    allow_web_search:
      typeof raw.allow_web_search === "boolean"
        ? raw.allow_web_search
        : typeof raw.allowWebSearch === "boolean"
          ? raw.allowWebSearch
          : false,
    research_sources: asStringArray(raw.research_sources).length
      ? asStringArray(raw.research_sources)
      : asStringArray(raw.researchSources),
    require_citations:
      typeof raw.require_citations === "boolean"
        ? raw.require_citations
        : typeof raw.requireCitations === "boolean"
          ? raw.requireCitations
          : true,
    max_search_results:
      typeof raw.max_search_results === "number"
        ? raw.max_search_results
        : typeof raw.maxSearchResults === "number"
          ? raw.maxSearchResults
          : 5,
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

const normalizeTemplate = (value: unknown): Template => {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const workflowMode = raw.workflow_mode === "coding" || raw.workflow_mode === "writing"
    ? raw.workflow_mode
    : undefined;
  const orchestrationMode =
    raw.orchestration_mode === "sequential" ||
    raw.orchestration_mode === "role_based" ||
    raw.orchestration_mode === "dependency_graph"
      ? raw.orchestration_mode
      : undefined;

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `team_${uid()}`,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Untitled Team",
    description: typeof raw.description === "string" ? raw.description : "",
    agents: Array.isArray(raw.agents) ? raw.agents.map(normalizeAgent) : [],
    workflow_mode: workflowMode,
    orchestration_mode: orchestrationMode,
    rounds: typeof raw.rounds === "number" ? raw.rounds : undefined,
    is_builtin:
      typeof raw.is_builtin === "boolean"
        ? raw.is_builtin
        : typeof raw.isBuiltin === "boolean"
          ? raw.isBuiltin
          : false,
    locked: typeof raw.locked === "boolean" ? raw.locked : false,
    category: typeof raw.category === "string" ? raw.category : undefined,
    created_at: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
};

const cloneAgentConfig = (agent: AgentConfig): AgentConfig => ({
  ...agent,
  skills: [...agent.skills],
  skill_refs: agent.skill_refs?.map((ref) => ({
    ...ref,
    version_requirement: { ...ref.version_requirement },
  })),
  depends_on: [...agent.depends_on],
  research_sources: [...agent.research_sources],
  mcp_servers: [...agent.mcp_servers],
});

const teamAgent = ({
  id,
  name,
  org_role,
  provider = "codex_cli",
  persona,
  skills = [],
  depends_on = [],
  model = null,
  model_decision = "ceo_decides",
}: {
  id: string;
  name: string;
  org_role: OrgRole;
  provider?: ProviderKind;
  persona: string;
  skills?: string[];
  depends_on?: string[];
  model?: string | null;
  model_decision?: ModelDecision;
}): AgentConfig => ({
  id,
  name,
  org_role,
  provider,
  persona,
  skills,
  depends_on,
  model,
  model_decision,
  enabled: true,
  allow_web_search: false,
  research_sources: [],
  require_citations: true,
  max_search_results: 5,
  mcp_enabled: false,
  mcp_servers: [],
  mcp_instruction: "",
  mcp_timeout_sec: 60,
  is_custom: false,
});

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
    allow_web_search: false,
    research_sources: [],
    require_citations: true,
    max_search_results: 5,
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
    allow_web_search: false,
    research_sources: [],
    require_citations: true,
    max_search_results: 5,
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
    allow_web_search: false,
    research_sources: [],
    require_citations: true,
    max_search_results: 5,
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
    allow_web_search: false,
    research_sources: [],
    require_citations: true,
    max_search_results: 5,
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
    allow_web_search: false,
    research_sources: [],
    require_citations: true,
    max_search_results: 5,
    mcp_enabled: false,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_timeout_sec: 60,
    is_custom: false,
  })),
];

export const builtinAgents = (): AgentConfig[] => defaultAgents().map(cloneAgentConfig);

const defaultTeamTemplates = (): Template[] => [
  {
    id: "builtin_standard_full",
    name: "標準フルチーム",
    description: "CEO、Manager、PMO、Worker x3、QA x3 の汎用構成。",
    category: "Built-in",
    is_builtin: true,
    locked: true,
    workflow_mode: "writing",
    orchestration_mode: "role_based",
    rounds: 1,
    agents: defaultAgents().map(cloneAgentConfig),
  },
  {
    id: "builtin_local_coding_light",
    name: "軽量ローカルコーディング",
    description: "LM Studio/Ollama で小さな修正方針やdiff案を作る軽量構成。",
    category: "Built-in",
    is_builtin: true,
    locked: true,
    workflow_mode: "coding",
    orchestration_mode: "dependency_graph",
    rounds: 1,
    agents: [
      teamAgent({
        id: "local_manager",
        name: "Local Manager",
        org_role: "manager",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona: "依頼を小さな実装単位に分解し、対象ファイルと制約を明確にする。",
        skills: ["planning", "prompt-compression"],
      }),
      teamAgent({
        id: "local_coder",
        name: "Local Coder",
        org_role: "worker",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona: "軽いコード変更案、最小diff案、Codex向け指示を短く作る。",
        skills: ["coding", "diff-proposal"],
        depends_on: ["local_manager"],
      }),
      teamAgent({
        id: "local_qa",
        name: "Local QA",
        org_role: "qa",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona: "変更案の抜け漏れ、テスト観点、リスクを短く確認する。",
        skills: ["review", "testing"],
        depends_on: ["local_coder"],
      }),
    ],
  },
  {
    id: "builtin_codex_implementation",
    name: "Codex実装チーム",
    description: "ローカルLLMで整理し、Codex Worker が本命実装を行う構成。",
    category: "Built-in",
    is_builtin: true,
    locked: true,
    workflow_mode: "coding",
    orchestration_mode: "dependency_graph",
    rounds: 1,
    agents: [
      teamAgent({
        id: "codex_ceo",
        name: "CEO",
        org_role: "ceo",
        persona: "目的、優先順位、受け入れ条件を決める。",
        skills: ["decision", "acceptance-criteria"],
        model_decision: "fixed",
      }),
      teamAgent({
        id: "codex_manager",
        name: "Manager",
        org_role: "manager",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona: "Codexに渡す実装指示を短く明確に整理する。",
        skills: ["planning", "prompt-compression"],
        depends_on: ["codex_ceo"],
      }),
      teamAgent({
        id: "codex_worker",
        name: "Codex Worker",
        org_role: "worker",
        provider: "codex_cli",
        persona: "対象ファイルを限定し、不要なリファクタを避けて最小diffで実装する。",
        skills: ["implementation", "minimal-diff"],
        depends_on: ["codex_manager"],
      }),
      teamAgent({
        id: "codex_qa",
        name: "QA",
        org_role: "qa",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona: "実装結果のテスト観点、回帰リスク、受け入れ条件を確認する。",
        skills: ["review", "testing"],
        depends_on: ["codex_worker"],
      }),
    ],
  },
  {
    id: "builtin_deepseek_test_review",
    name: "DeepSeek限定テストレビュー",
    description: "DeepSeek API を一般的なテスト観点・非機密レビューだけに使う構成。",
    category: "Built-in",
    is_builtin: true,
    locked: true,
    workflow_mode: "coding",
    orchestration_mode: "dependency_graph",
    rounds: 1,
    agents: [
      teamAgent({
        id: "deepseek_test_reviewer",
        name: "DeepSeek Test Reviewer",
        org_role: "qa",
        provider: "deepseek_api",
        model: "deepseek-v4-flash",
        persona:
          "外部API担当。社内規約、秘密情報、個人情報、未公開仕様は扱わない。一般的なテスト観点、非機密の実装方針、単純な相談だけに回答する。",
        skills: ["test-review", "non-confidential"],
      }),
      teamAgent({
        id: "local_safety_gate",
        name: "Local Safety Gate",
        org_role: "manager",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona:
          "DeepSeekの回答をローカル側で確認し、機密情報や過剰な実装判断が混ざっていないかを確認する。",
        skills: ["safety-review", "scope-control"],
        depends_on: ["deepseek_test_reviewer"],
      }),
    ],
  },
  {
    id: "builtin_design_review",
    name: "設計レビュー",
    description: "UI、システム、PMO、QA 観点で仕様やリファクタ方針を確認する構成。",
    category: "Built-in",
    is_builtin: true,
    locked: true,
    workflow_mode: "writing",
    orchestration_mode: "role_based",
    rounds: 1,
    agents: [
      teamAgent({
        id: "design_system",
        name: "System Designer",
        org_role: "system_designer",
        persona: "アーキテクチャ、責務分離、拡張性、運用リスクを確認する。",
        skills: ["architecture", "refactoring"],
      }),
      teamAgent({
        id: "design_ui",
        name: "UI Designer",
        org_role: "ui_designer",
        persona: "画面構成、情報設計、操作導線、視認性を確認する。",
        skills: ["ui-review", "interaction-design"],
      }),
      teamAgent({
        id: "design_pmo",
        name: "PMO",
        org_role: "pmo",
        persona: "計画の抜け漏れ、依存関係、実装順序を確認する。",
        skills: ["risk", "process"],
      }),
      teamAgent({
        id: "design_qa",
        name: "QA",
        org_role: "qa",
        persona: "検証観点、受け入れ条件、失敗ケースを整理する。",
        skills: ["quality", "acceptance-criteria"],
      }),
    ],
  },
  {
    id: "builtin_superpowers_workflow",
    name: "SuperPowers風ワークフロー",
    description: "Brainstorm、Spec、Plan、Implement、Review の段階で依頼を前進させる構成。",
    category: "Built-in",
    is_builtin: true,
    locked: true,
    workflow_mode: "coding",
    orchestration_mode: "dependency_graph",
    rounds: 1,
    agents: [
      teamAgent({
        id: "sp_brainstorm",
        name: "Brainstorm",
        org_role: "manager",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona: "曖昧な依頼を目的、制約、成功条件に分解する。",
        skills: ["brainstorming"],
      }),
      teamAgent({
        id: "sp_spec",
        name: "Spec Writer",
        org_role: "system_designer",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona: "合意した内容を短く明確な仕様にする。",
        skills: ["specification"],
        depends_on: ["sp_brainstorm"],
      }),
      teamAgent({
        id: "sp_plan",
        name: "Plan Writer",
        org_role: "pmo",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona: "仕様を小さく実装可能な手順に分ける。",
        skills: ["planning"],
        depends_on: ["sp_spec"],
      }),
      teamAgent({
        id: "sp_implementer",
        name: "Implementer",
        org_role: "worker",
        provider: "codex_cli",
        persona: "計画に沿って対象を限定し、最小diffで実装する。",
        skills: ["implementation"],
        depends_on: ["sp_plan"],
      }),
      teamAgent({
        id: "sp_reviewer",
        name: "Reviewer",
        org_role: "qa",
        provider: "lm_studio",
        model: "qwen2.5-coder-3b-instruct",
        persona: "変更差分、テスト、リスク、仕様逸脱を確認する。",
        skills: ["review", "verification"],
        depends_on: ["sp_implementer"],
      }),
    ],
  },
];

const mergeTemplatesWithBuiltIns = (templates: Template[]): Template[] => {
  const builtIns = defaultTeamTemplates();
  const builtInIds = new Set(builtIns.map((template) => template.id));
  return [
    ...builtIns,
    ...templates
      .map(normalizeTemplate)
      .filter((template) => !builtInIds.has(template.id)),
  ];
};

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
  knowledge: KnowledgeResource[];
  loadKnowledge: () => Promise<void>;
  saveKnowledge: (resource: KnowledgeResource) => Promise<KnowledgeResource>;
  deleteKnowledge: (id: string) => Promise<void>;

  selectedProjectId?: string;
  selectProject: (id?: string) => void;

  request: RefineRequest;
  updateRequest: (patch: Partial<RefineRequest>) => void;
  toggleAgentEnabled: (id: string) => void;
  upsertAgent: (a: AgentConfig) => void;
  removeAgent: (id: string) => void;
  deleteSavedAgent: (id: string) => Promise<void>;
  setAgents: (list: AgentConfig[]) => void;
  saveCurrentTeamTemplate: (input: {
    id?: string;
    name: string;
    description?: string;
  }) => Promise<Template>;
  loadTeamTemplate: (id: string) => void;
  deleteTeamTemplate: (id: string) => Promise<void>;

  managedRequests: ManagedRequest[];
  selectedManagedRequestId?: string;
  loadManagedRequests: () => Promise<void>;
  selectManagedRequest: (id?: string) => void;
  saveManagedRequest: (record: ManagedRequest) => Promise<ManagedRequest>;
  deleteManagedRequest: (id: string) => Promise<void>;
  addManagedRequestFeedback: (
    record: ManagedRequest,
    feedback: VerificationFeedback,
  ) => Promise<ManagedRequest>;
  deleteManagedRequestFeedback: (requestId: string, feedbackId: string) => Promise<ManagedRequest>;

  run: RunState;
  abortCtrl?: AbortController;
  startRun: (options?: { force?: boolean }) => Promise<void>;
  stopRun: () => void;
  resetRun: () => void;
  pendingPrecheck?: ProviderHealth[];
  clearPendingPrecheck: () => void;

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
  knowledge_context: [],
  agents: defaultAgents(),
};

export const useApp = create<AppState>((set, get) => ({
  screen: "workspace",
  setScreen: (s) => set({ screen: s }),

  drawerOpen: false,
  setDrawerOpen: (v) => set({ drawerOpen: v }),

  agents: defaultAgents(),
  projects: [],
  templates: defaultTeamTemplates(),
  workflows: [],
  knowledge: [],
  loadKnowledge: async () => {
    try {
      const list = await api.listKnowledge();
      set({ knowledge: list.map(normalizeKnowledgeResource) });
    } catch {
      set({ knowledge: [] });
    }
  },
  saveKnowledge: async (resource) => {
    const normalized = normalizeKnowledgeResource(resource);
    const exists = get().knowledge.some((item) => item.id === normalized.id);
    const saved = normalizeKnowledgeResource(
      exists
        ? await api.updateKnowledge(normalized.id, normalized)
        : await api.createKnowledge(normalized),
    );
    set((state) => ({
      knowledge: [saved, ...state.knowledge.filter((item) => item.id !== saved.id)],
    }));
    return saved;
  },
  deleteKnowledge: async (id) => {
    await api.deleteKnowledge(id);
    set((state) => ({ knowledge: state.knowledge.filter((item) => item.id !== id) }));
  },
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
  saveCurrentTeamTemplate: async ({ id, name, description }) => {
    const state = get();
    const now = new Date().toISOString();
    const existing = id ? state.templates.find((template) => template.id === id) : undefined;
    const canOverwrite = existing && !existing.locked;
    const template: Template = {
      id: canOverwrite ? existing.id : `team_${uid()}`,
      name: name.trim() || `Team ${new Date().toLocaleString("ja-JP")}`,
      description: description?.trim() || "",
      agents: state.request.agents.map(cloneAgentConfig),
      workflow_mode: state.request.workflow_mode,
      orchestration_mode: state.request.orchestration_mode,
      rounds: state.request.rounds,
      created_at: canOverwrite ? existing.created_at : now,
      updated_at: now,
    };
    const saved = normalizeTemplate(await api.createTemplate(template));
    set((current) => ({ templates: [saved, ...current.templates.filter((t) => t.id !== saved.id)] }));
    return saved;
  },
  loadTeamTemplate: (id) => {
    const template = get().templates.find((item) => item.id === id);
    if (!template) return;
    set((state) => ({
      request: {
        ...state.request,
        agents: template.agents.map(cloneAgentConfig),
        workflow_mode: template.workflow_mode ?? state.request.workflow_mode,
        orchestration_mode: template.orchestration_mode ?? state.request.orchestration_mode,
        rounds: template.rounds ?? state.request.rounds,
      },
    }));
  },
  deleteTeamTemplate: async (id) => {
    const target = get().templates.find((template) => template.id === id);
    if (target?.locked) return;
    await api.deleteTemplate(id);
    set((state) => ({ templates: state.templates.filter((template) => template.id !== id) }));
  },

  managedRequests: [],
  selectedManagedRequestId: undefined,
  loadManagedRequests: async () => {
    try {
      const list = await api.listRequests();
      set({
        managedRequests: list.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      });
    } catch {
      // ignore — backend may be unreachable
    }
  },
  selectManagedRequest: (id) => set({ selectedManagedRequestId: id }),
  saveManagedRequest: async (record) => {
    const exists = get().managedRequests.some((item) => item.id === record.id);
    const saved = exists
      ? await api.updateRequest(record.id, record)
      : await api.createRequest(record);
    set((state) => {
      const others = state.managedRequests.filter((item) => item.id !== saved.id);
      return {
        managedRequests: [saved, ...others].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
        selectedManagedRequestId: saved.id,
      };
    });
    return saved;
  },
  deleteManagedRequest: async (id) => {
    await api.deleteRequest(id);
    set((state) => ({
      managedRequests: state.managedRequests.filter((item) => item.id !== id),
      selectedManagedRequestId:
        state.selectedManagedRequestId === id ? undefined : state.selectedManagedRequestId,
    }));
  },
  addManagedRequestFeedback: async (record, feedback) => {
    const existing = get().managedRequests.find((item) => item.id === record.id);
    const base = existing ?? record;
    const now = new Date().toISOString();
    const next: ManagedRequest = {
      ...base,
      ...record,
      updated_at: now,
      verification_feedback: [feedback, ...(base.verification_feedback ?? [])],
    };
    const saved = existing
      ? await api.updateRequest(next.id, next)
      : await api.createRequest(next);
    set((state) => {
      const others = state.managedRequests.filter((item) => item.id !== saved.id);
      return {
        managedRequests: [saved, ...others].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
        selectedManagedRequestId: saved.id,
      };
    });
    return saved;
  },
  deleteManagedRequestFeedback: async (requestId, feedbackId) => {
    const existing = get().managedRequests.find((item) => item.id === requestId);
    if (!existing) throw new Error("依頼が見つかりません。");
    const next: ManagedRequest = {
      ...existing,
      updated_at: new Date().toISOString(),
      verification_feedback: (existing.verification_feedback ?? []).filter(
        (item) => item.id !== feedbackId,
      ),
    };
    const saved = await api.updateRequest(next.id, next);
    set((state) => ({
      managedRequests: [saved, ...state.managedRequests.filter((item) => item.id !== saved.id)].sort(
        (a, b) => b.updated_at.localeCompare(a.updated_at),
      ),
    }));
    return saved;
  },

  run: { status: "idle", events: [], turns: [], currentRound: 0 },

  pendingPrecheck: undefined,
  clearPendingPrecheck: () => set({ pendingPrecheck: undefined }),

  startRun: async (options) => {
    const force = options?.force === true;
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
    const payload: RefineRequest = { ...request, agents: enabledAgents.map((a) => ({ ...a })) };

    if (!force) {
      try {
        const precheck = await api.precheckRun(payload);
        if (!precheck.ok) {
          set({
            pendingPrecheck: precheck.dead,
            run: {
              status: "failed",
              events: [],
              turns: [],
              currentRound: 0,
              error: `事前チェック失敗: 起動していない provider があります (${precheck.dead.map((d) => d.provider).join(", ")})`,
            },
          });
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({
          run: {
            status: "failed",
            events: [],
            turns: [],
            currentRound: 0,
            error: `事前チェックに失敗しました: ${message}`,
          },
        });
        return;
      }
    }

    const ctrl = new AbortController();
    set({
      abortCtrl: ctrl,
      qaVerdicts: [],
      pendingPrecheck: undefined,
      run: {
        status: "running",
        events: [],
        turns: [],
        currentRound: 0,
        startedAt: Date.now(),
      },
    });
    try {
      for await (const ev of streamRefine(payload, ctrl.signal, { force })) {
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
      const [agents, projects, templates, workflows, managedRequests, knowledge] = await Promise.all([
        api.listAgents().catch(() => []),
        api.listProjects().catch(() => []),
        api.listTemplates().catch(() => []),
        api.listWorkflows().catch(() => []),
        api.listRequests().catch(() => [] as ManagedRequest[]),
        api.listKnowledge().catch(() => [] as KnowledgeResource[]),
      ]);
      set({
        agents: agents.map(normalizeAgent),
        projects,
        templates: mergeTemplatesWithBuiltIns(templates),
        workflows,
        knowledge: knowledge.map(normalizeKnowledgeResource),
        managedRequests: managedRequests
          .slice()
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      });
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
  allow_web_search: false,
  research_sources: [],
  require_citations: true,
  max_search_results: 5,
  mcp_enabled: false,
  mcp_servers: [],
  mcp_instruction: "",
  mcp_timeout_sec: 60,
  is_custom: true,
});
