import type {
  AgentConfig,
  CodeContext,
  OrchestrationMode,
  RefineRequest,
  WorkflowMode,
} from "../../types";

export type RequestPresetId =
  | "improve_writing"
  | "organize_ideas"
  | "review"
  | "discussion"
  | "debate"
  | "implementation"
  | "fix_code"
  | "local_coding_light"
  | "superpowers_local"
  | "custom";

export interface RequestPreset {
  id: RequestPresetId;
  label: string;
  description: string;
  workflowMode: WorkflowMode;
  orchestrationMode?: OrchestrationMode;
  rounds?: number;
  defaultObjective: string;
  defaultInstruction: string;
  resultOptions: string[];
  agents?: AgentConfig[];
  codeContextDefaults?: Partial<CodeContext>;
}

const LOCAL_CODING_MODEL = "qwen2.5-coder-3b-instruct";
const LOCAL_REVIEW_MODEL = "qwen2.5-coder-7b-instruct";
const researchDefaults = {
  allow_web_search: false,
  research_sources: [],
  require_citations: true,
  max_search_results: 5,
};

const localCodingLightAgents: AgentConfig[] = [
  {
    id: "local_coder_light",
    name: "Local Coder Light",
    org_role: "worker",
    provider: "lm_studio",
    model: LOCAL_CODING_MODEL,
    model_decision: "fixed",
    persona:
      "Generate small, targeted code changes. Prefer minimal diffs, explicit target files, and concrete test commands. Do not broaden scope.",
    skills: ["coding", "minimal-diff", "test-focused"],
    depends_on: [],
    command_template: null,
    enabled: true,
    ...researchDefaults,
    mcp_enabled: false,
    mcp_config_path: null,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_context_command: null,
    mcp_timeout_sec: 60,
    is_custom: true,
  },
  {
    id: "local_code_qa",
    name: "Local Code QA",
    org_role: "qa",
    provider: "lm_studio",
    model: LOCAL_CODING_MODEL,
    model_decision: "fixed",
    persona:
      "Review the proposed local code change for missing tests, risky assumptions, and unrelated edits. Keep feedback short and actionable.",
    skills: ["code-review", "test-review", "scope-control"],
    depends_on: ["local_coder_light"],
    command_template: null,
    enabled: true,
    ...researchDefaults,
    mcp_enabled: false,
    mcp_config_path: null,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_context_command: null,
    mcp_timeout_sec: 60,
    is_custom: true,
  },
];

const localSuperPowersAgents: AgentConfig[] = [
  {
    id: "superpowers_brainstorm",
    name: "Brainstorm",
    org_role: "manager",
    provider: "lm_studio",
    model: LOCAL_CODING_MODEL,
    model_decision: "fixed",
    persona:
      "Clarify the request before implementation. Identify assumptions, target files, constraints, and open questions. Keep output concise.",
    skills: ["brainstorm", "scope-control", "prompt-compression"],
    depends_on: [],
    command_template: null,
    enabled: true,
    ...researchDefaults,
    mcp_enabled: false,
    mcp_config_path: null,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_context_command: null,
    mcp_timeout_sec: 60,
    is_custom: true,
  },
  {
    id: "superpowers_spec",
    name: "Spec Writer",
    org_role: "system_designer",
    provider: "lm_studio",
    model: LOCAL_CODING_MODEL,
    model_decision: "fixed",
    persona:
      "Turn the clarified request into a short implementation spec. Include goal, target files, constraints, acceptance criteria, and non-goals.",
    skills: ["spec-writing", "requirements", "scope-control"],
    depends_on: ["superpowers_brainstorm"],
    command_template: null,
    enabled: true,
    ...researchDefaults,
    mcp_enabled: false,
    mcp_config_path: null,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_context_command: null,
    mcp_timeout_sec: 60,
    is_custom: true,
  },
  {
    id: "superpowers_plan",
    name: "TDD Planner",
    org_role: "worker",
    provider: "lm_studio",
    model: LOCAL_CODING_MODEL,
    model_decision: "fixed",
    persona:
      "Create a minimal TDD implementation plan for Codex. Prefer small tasks, target files, tests, and verification commands.",
    skills: ["tdd-plan", "implementation-plan", "codex-instruction"],
    depends_on: ["superpowers_spec"],
    command_template: null,
    enabled: true,
    ...researchDefaults,
    mcp_enabled: false,
    mcp_config_path: null,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_context_command: null,
    mcp_timeout_sec: 60,
    is_custom: true,
  },
  {
    id: "superpowers_qa",
    name: "QA Reviewer",
    org_role: "qa",
    provider: "lm_studio",
    model: LOCAL_REVIEW_MODEL,
    model_decision: "fixed",
    persona:
      "Review the plan for ambiguity, missing tests, excessive scope, and risks. End with a compressed English Codex instruction.",
    skills: ["qa-review", "risk-review", "prompt-compression"],
    depends_on: ["superpowers_plan"],
    command_template: null,
    enabled: true,
    ...researchDefaults,
    mcp_enabled: false,
    mcp_config_path: null,
    mcp_servers: [],
    mcp_instruction: "",
    mcp_context_command: null,
    mcp_timeout_sec: 60,
    is_custom: true,
  },
];

const cloneAgents = (agents: AgentConfig[]): AgentConfig[] =>
  agents.map((agent) => ({
    ...agent,
    skills: [...agent.skills],
    depends_on: [...agent.depends_on],
    mcp_servers: [...agent.mcp_servers],
  }));

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
    id: "discussion",
    label: "議論したい",
    description: "各エージェントが互いの発言に反応し、合意点と次の行動をまとめます。",
    workflowMode: "writing",
    orchestrationMode: "sequential",
    rounds: 3,
    defaultObjective: "議論して、論点・懸念・合意点・次の行動をまとめる",
    defaultInstruction:
      "縦割りの意見出しは禁止。各エージェントは他者の発言に同意・反論・補強し、目的に沿って論点を収束させる。合意点、未解決点、次の行動を最後にまとめる。",
    resultOptions: ["合意点を出す", "論点を整理する", "未解決点を出す", "次の行動にする"],
  },
  {
    id: "debate",
    label: "ディベートしたい",
    description: "賛成・反対をぶつけ、反論と判断材料から暫定結論をまとめます。",
    workflowMode: "writing",
    orchestrationMode: "sequential",
    rounds: 3,
    defaultObjective: "ディベートして、賛否・反論・判断材料・暫定結論をまとめる",
    defaultInstruction:
      "縦割りの意見出しは禁止。各エージェントは他者の主張に同意・反論・補強し、目的に照らして採用すべき判断材料と捨てる論点を明確にする。最後に暫定結論をまとめる。",
    resultOptions: ["賛否を出す", "反論を出す", "判断材料にする", "暫定結論を出す"],
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
    id: "local_coding_light",
    label: "Local Coding Light",
    description: "軽量コードモデルで小さな修正案、diff案、テスト方針を作ります。",
    workflowMode: "coding",
    orchestrationMode: "dependency_graph",
    rounds: 1,
    defaultObjective:
      "ローカルLLMで小さなコード修正案を作り、必要ならCodexに渡せる最小diff指示にする",
    defaultInstruction:
      "対象ファイル、変更内容、diff案、テストコマンドを短く具体化する。無関係なリファクタは禁止。ローカルLLMは直接ファイル編集せず、実装案とdiff案を出す。",
    resultOptions: [
      "最小diff案を出す",
      "テスト方針を出す",
      "Codex向け指示にする",
      "リスクを確認する",
    ],
    agents: localCodingLightAgents,
    codeContextDefaults: {
      acceptance_criteria:
        "変更が対象ファイルに限定され、最小diff案と確認コマンドが明確であること。",
      test_command: "該当する最小テストコマンドを指定",
    },
  },
  {
    id: "superpowers_local",
    label: "SuperPowers Local",
    description: "ローカルLLMで設計、仕様、TDD計画、Codex向け指示を短く作ります。",
    workflowMode: "coding",
    orchestrationMode: "dependency_graph",
    rounds: 1,
    defaultObjective:
      "Codexに渡す前に、依頼を短い実装仕様と最小スコープの英語指示へ圧縮する",
    defaultInstruction:
      "SuperPowersWUIの流れに沿って brainstorm -> spec -> TDD plan -> QA review を行う。コード全体を読ませず、対象ファイル、目的、制約、テスト、出力形式だけに絞る。最後にCodexへ渡す短い英語指示を出す。",
    resultOptions: [
      "Codex向け指示にする",
      "TDD計画にする",
      "対象ファイルを絞る",
      "設計リスクを見る",
    ],
    agents: localSuperPowersAgents,
    codeContextDefaults: {
      acceptance_criteria:
        "Codexが対象ファイル、目的、制約、テストコマンドを迷わず判断できること。",
      test_command: "pytest / npm test / swift test など、該当する最小コマンドを指定",
    },
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
): Partial<RefineRequest> => {
  const shouldReplaceInstruction =
    preset.id === "superpowers_local" || preset.id === "discussion" || preset.id === "debate";
  const next: Partial<RefineRequest> = {
    workflow_mode: preset.workflowMode,
    objective: shouldReplaceInstruction
      ? preset.defaultObjective
      : request.objective || preset.defaultObjective,
    global_instruction:
      shouldReplaceInstruction
        ? preset.defaultInstruction
        : request.global_instruction || preset.defaultInstruction,
    code_context: preset.codeContextDefaults
      ? { ...request.code_context, ...preset.codeContextDefaults }
      : request.code_context,
  };

  if (preset.orchestrationMode) {
    next.orchestration_mode = preset.orchestrationMode;
  }

  if (preset.rounds) {
    next.rounds = preset.rounds;
  }

  if (preset.agents) {
    next.agents = cloneAgents(preset.agents);
  }

  return next;
};
