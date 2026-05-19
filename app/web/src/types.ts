export type OrgRole =
  | "ceo"
  | "manager"
  | "worker"
  | "pmo"
  | "qa"
  | "ui_designer"
  | "system_designer"
  | "ops_designer"
  | "other";

export type ProviderKind =
  | "gemini_cli"
  | "claude_cli"
  | "codex_cli"
  | "android_cli"
  | "openai_api"
  | "anthropic_api"
  | "deepseek_api"
  | "ollama"
  | "lm_studio"
  | "custom_cli";
export type WorkflowMode = "writing" | "coding";
export type OrchestrationMode = "sequential" | "role_based" | "dependency_graph";
export type ModelDecision = "fixed" | "ceo_decides";

export interface AgentConfig {
  id: string;
  name: string;
  org_role: OrgRole;
  provider: ProviderKind;
  persona: string;
  skills: string[];
  skill_refs?: SkillReference[];
  depends_on: string[];
  command_template?: string | null;
  model?: string | null;
  model_decision?: ModelDecision;
  enabled?: boolean;
  allow_web_search: boolean;
  research_sources: string[];
  require_citations: boolean;
  max_search_results: number;
  mcp_enabled: boolean;
  mcp_config_path?: string | null;
  mcp_servers: string[];
  mcp_instruction: string;
  mcp_context_command?: string | null;
  mcp_timeout_sec: number;
  is_custom: boolean;
}

export interface CodeContext {
  repository: string;
  working_directory: string;
  target_paths: string[];
  tech_stack: string;
  acceptance_criteria: string;
  test_command: string;
}

export interface GitStatusResponse {
  repo_root: string;
  current_branch: string;
  base_commit: string;
  dirty: boolean;
  changed_files: string[];
  untracked_files: string[];
}

export interface CodingWorktreeState {
  request_id: string;
  repo_root: string;
  source_working_directory: string;
  worktree_path: string;
  base_branch: string;
  base_commit: string;
  ai_branch: string;
  user_dirty: boolean;
  user_patch_applied: boolean;
  user_changed_files: string[];
  user_untracked_files: string[];
  status: "prepared" | "running" | "completed" | "conflict" | "merged" | "discarded";
}

export type KnowledgeKind = "markdown" | "text" | "image" | "figma" | "mcp" | "link" | "note";

export interface KnowledgeResource {
  id: string;
  title: string;
  kind: KnowledgeKind;
  content: string;
  source: string;
  content_type: string;
  tags: string[];
}

export interface RefineRequest {
  workflow_mode: WorkflowMode;
  orchestration_mode: OrchestrationMode;
  source_text: string;
  objective: string;
  global_instruction: string;
  code_context: CodeContext;
  knowledge_context: KnowledgeResource[];
  rounds: number;
  agents: AgentConfig[];
}

export type ManagedRequestStatus = "draft" | "running" | "completed" | "paused";

export interface WorkspaceVersion {
  id: string;
  version_no: number;
  title: string;
  created_at: string;
  request: RefineRequest;
  parent_version_id?: string;
  review_feedback?: VerificationFeedback;
  final_text?: string;
  diff?: string;
  file_changes?: string;
  error?: string;
  agent_turns?: TurnResult[];
  stream_events?: StreamEvent[];
  flow_json?: SubworkFlowJson;
  version_control?: CodingWorktreeState;
  run_started_at?: string;
  run_ended_at?: string;
}

export type SubworkFlowEventType =
  | "run_started"
  | "round_started"
  | "agent_started"
  | "agent_completed"
  | "round_completed"
  | "run_completed"
  | "run_failed";

export interface SubworkFlowEvent {
  id: string;
  sequence: number;
  type: SubworkFlowEventType;
  timestamp: string;
  round_index?: number;
  batch_index?: number;
  turn_index?: number;
  agent_id?: string;
  agent_name?: string;
  org_role?: OrgRole;
  provider?: ProviderKind;
  summary?: string;
  input?: string;
  output?: string;
  error?: string;
  file_changes?: string;
  raw_event?: StreamEvent;
}

export interface SubworkFlowJson {
  schema_version: 1;
  work_id: string;
  subwork_id: string;
  parent_subwork_id?: string;
  version_no: number;
  title: string;
  created_at: string;
  run_started_at?: string;
  run_ended_at?: string;
  request: RefineRequest;
  agents: AgentConfig[];
  events: SubworkFlowEvent[];
  final_text?: string;
  diff?: string;
  file_changes?: string;
}

export interface ManagedRequest {
  id: string;
  title: string;
  status: ManagedRequestStatus;
  template_id?: string;
  request: RefineRequest;
  original_request?: RefineRequest;
  previous_request?: RefineRequest;
  versions?: WorkspaceVersion[];
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  final_text?: string;
  diff?: string;
  file_changes?: string;
  error?: string;
  agent_turns?: TurnResult[];
  stream_events?: StreamEvent[];
  version_control?: CodingWorktreeState;
  run_started_at?: string;
  run_ended_at?: string;
  verification_feedback?: VerificationFeedback[];
}

export interface VerificationFeedback {
  id: string;
  kind: "more_detail" | "change_direction" | "fix_request" | "approved";
  comment: string;
  created_at: string;
}

export interface ChatAttachment {
  kind: "request" | "logs" | "error" | "context" | "image";
  title: string;
  content: string;
  content_type?: string;
  description?: string;
  size?: number;
}

export interface ChatSource {
  title: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent_id?: string | null;
  agent_name?: string | null;
  web_search_enabled?: boolean;
  sources?: ChatSource[];
  attachments?: ChatAttachment[];
  error?: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  agent_id: string;
  agent_name: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at?: string;
}

export interface ChatMessageRequest {
  session_id?: string;
  agent: AgentConfig;
  question: string;
  web_search_enabled: boolean;
  attachments: ChatAttachment[];
}

export interface ProviderModel {
  id: string;
  name: string;
}

export interface ProviderModelsResponse {
  provider: ProviderKind;
  models: ProviderModel[];
  error?: string | null;
}

export interface ProviderHealth {
  provider: ProviderKind;
  alive: boolean;
  detail: string;
  start_command: string | null;
  docs_url: string | null;
  binary: string | null;
  endpoint: string | null;
}

export interface ProviderHealthResponse {
  providers: ProviderHealth[];
  summary: { total: number; alive: number; dead: number };
}

export interface TurnResult {
  agent_id: string;
  agent_name: string;
  org_role: OrgRole;
  provider: ProviderKind;
  output: string;
  error?: string | null;
  file_changes?: string | null;
  mcp_enabled?: boolean;
  mcp_context_used?: boolean;
  mcp_context_error?: string | null;
  research_enabled?: boolean;
  research_context_used?: boolean;
  research_context_error?: string | null;
  research_results?: ResearchSourceResult[];
}

export interface ResearchSourceResult {
  source: string;
  url: string;
  title?: string;
  snippet?: string;
  error?: string | null;
}

export interface RoundResult {
  round_index: number;
  turns: TurnResult[];
  draft_after_round: string;
}

export interface RefineResponse {
  final_text: string;
  rounds: RoundResult[];
  diff: string;
  file_changes: string;
}

export type StreamEvent = (
  | {
      type: "run_started";
      plan?: unknown;
      workflow_mode?: WorkflowMode;
      orchestration_mode?: OrchestrationMode;
      execution_plan?: string[][];
      rounds?: number;
      agent_count?: number;
      total_turns?: number;
      has_working_dir?: boolean;
    }
  | { type: "round_started"; round_index: number; execution_plan?: string[][] }
  | {
      type: "turn_started";
      agent_id: string;
      agent_name: string;
      org_role: OrgRole;
      provider: ProviderKind;
      round_index?: number;
      batch_index?: number;
      turn_index?: number;
      depends_on?: string[];
      mcp_enabled?: boolean;
    }
  | {
      type: "turn_completed";
      turn: TurnResult;
      round_index?: number;
      batch_index?: number;
      turn_index?: number;
      completed_turns?: number;
      total_turns?: number;
    }
  | { type: "round_completed"; round_index: number; draft_after_round: string }
  | { type: "run_completed"; result: RefineResponse }
  | { type: "run_failed"; error: string }
  | {
      type: "turn_phase";
      agent_id: string;
      agent_name: string;
      round_index?: number;
      batch_index?: number;
      turn_index?: number;
      phase:
        | "research_fetching"
        | "prompt_building"
        | "mcp_loading"
        | "provider_calling"
        | "provider_completed"
        | "provider_failed";
      provider?: ProviderKind;
      prompt_chars?: number;
      model?: string | null;
      elapsed_sec?: number;
      output_chars?: number;
      error?: string;
      servers?: string[];
      sources?: number;
    }
) & { received_at?: string; sequence?: number };

export interface AgentLogSummary {
  agent_id: string;
  path: string;
  size: number;
  modified_at: number;
}

export interface AgentLogResponse {
  agent_id: string;
  path: string;
  exists: boolean;
  size: number;
  content: string;
}

export type QAJudgement = "PASS" | "REWORK" | "ESCALATE";

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  agents: AgentConfig[];
  workflow_mode?: WorkflowMode;
  orchestration_mode?: OrchestrationMode;
  rounds?: number;
  is_builtin?: boolean;
  locked?: boolean;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes?: unknown[];
}

export type ScreenId =
  | "workspace"
  | "coding"
  | "dashboard"
  | "team"
  | "agents"
  | "skills"
  | "knowledge"
  | "execution"
  | "qa"
  | "logs"
  | "settings"
  | "chat";

export type SkillSource = "bundled" | "user" | "imported" | "discovered";

export type SkillVersionKind = "exact" | "latest_compatible" | "latest";

export interface SkillVersionRequirement {
  kind: SkillVersionKind;
  version?: string | null;
}

export interface SkillReference {
  id: string;
  source: SkillSource;
  version_requirement: SkillVersionRequirement;
  enabled: boolean;
}

export interface SourceTreeItem {
  name: string;
  path: string;
  kind: "directory" | "file";
  size: number;
  updated_at: number;
}

export interface SourceTreeResponse {
  name: string;
  path: string;
  kind: "directory";
  children: SourceTreeItem[];
  truncated: boolean;
}

export interface DirectoryPickResponse {
  path: string;
}

export interface SourceFileResponse {
  name: string;
  path: string;
  kind: "file";
  size: number;
  updated_at: number;
  content: string;
}

export interface SkillMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  providers: string[];
  roles: string[];
  tags: string[];
}

export interface SkillDocument {
  metadata: SkillMetadata;
  source: SkillSource;
  markdown: string;
  body: string;
  root_directory?: string | null;
}

export interface CandidateBatch {
  id: string;
  directory: string;
  skills: SkillDocument[];
}

export interface ExternalSkillImportError {
  url: string;
  message: string;
}

export interface ExternalSkillImportResult {
  documents: SkillDocument[];
  errors: ExternalSkillImportError[];
}
