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

export type ProviderKind = "gemini_cli" | "claude_cli" | "codex_cli" | "custom_cli";
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
  depends_on: string[];
  command_template?: string | null;
  model?: string | null;
  model_decision?: ModelDecision;
  enabled?: boolean;
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

export interface RefineRequest {
  workflow_mode: WorkflowMode;
  orchestration_mode: OrchestrationMode;
  source_text: string;
  objective: string;
  global_instruction: string;
  code_context: CodeContext;
  rounds: number;
  agents: AgentConfig[];
}

export type ManagedRequestStatus = "draft" | "running" | "completed" | "paused";

export interface ManagedRequest {
  id: string;
  title: string;
  status: ManagedRequestStatus;
  request: RefineRequest;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  final_text?: string;
  diff?: string;
  file_changes?: string;
  agent_turns?: TurnResult[];
  stream_events?: StreamEvent[];
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
  kind: "request" | "logs" | "error" | "context";
  title: string;
  content: string;
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

export type StreamEvent =
  | { type: "run_started"; plan?: unknown }
  | { type: "round_started"; round_index: number }
  | { type: "turn_started"; agent_id: string; agent_name: string; org_role: OrgRole; provider: ProviderKind }
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
  | { type: "run_failed"; error: string };

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
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes?: unknown[];
}

export type ScreenId =
  | "workspace"
  | "dashboard"
  | "team"
  | "agents"
  | "execution"
  | "qa"
  | "logs"
  | "settings"
  | "chat";
