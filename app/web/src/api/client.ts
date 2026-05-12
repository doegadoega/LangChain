import type {
  AgentConfig,
  CandidateBatch,
  ChatMessageRequest,
  ChatSession,
  CodingWorktreeState,
  ManagedRequest,
  KnowledgeResource,
  ExternalSkillImportResult,
  ProviderKind,
  ProviderModelsResponse,
  DirectoryPickResponse,
  Project,
  SourceFileResponse,
  GitStatusResponse,
  SourceTreeResponse,
  SkillDocument,
  SkillSource,
  Template,
  Workflow,
} from "../types";

const BASE = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // agents
  listAgents: () => req<AgentConfig[]>("/api/agents"),
  createAgent: (a: AgentConfig) =>
    req<AgentConfig>("/api/agents", { method: "POST", body: JSON.stringify(a) }),
  updateAgent: (id: string, a: AgentConfig) =>
    req<AgentConfig>(`/api/agents/${id}`, { method: "PUT", body: JSON.stringify(a) }),
  deleteAgent: (id: string) => req<void>(`/api/agents/${id}`, { method: "DELETE" }),

  // providers
  listProviderModels: (provider: ProviderKind) =>
    req<ProviderModelsResponse>(`/api/providers/${provider}/models`),

  // projects
  listProjects: () => req<Project[]>("/api/projects"),
  createProject: (p: Project) =>
    req<Project>("/api/projects", { method: "POST", body: JSON.stringify(p) }),
  deleteProject: (id: string) => req<void>(`/api/projects/${id}`, { method: "DELETE" }),

  // requests
  listRequests: () => req<ManagedRequest[]>("/api/requests"),
  createRequest: (r: ManagedRequest) =>
    req<ManagedRequest>("/api/requests", { method: "POST", body: JSON.stringify(r) }),
  updateRequest: (id: string, r: ManagedRequest) =>
    req<ManagedRequest>(`/api/requests/${id}`, { method: "PUT", body: JSON.stringify(r) }),
  deleteRequest: (id: string) => req<void>(`/api/requests/${id}`, { method: "DELETE" }),

  // knowledge
  listKnowledge: () => req<KnowledgeResource[]>("/api/knowledge"),
  createKnowledge: (r: KnowledgeResource) =>
    req<KnowledgeResource>("/api/knowledge", { method: "POST", body: JSON.stringify(r) }),
  updateKnowledge: (id: string, r: KnowledgeResource) =>
    req<KnowledgeResource>(`/api/knowledge/${id}`, { method: "PUT", body: JSON.stringify(r) }),
  deleteKnowledge: (id: string) => req<void>(`/api/knowledge/${id}`, { method: "DELETE" }),
  importLocalKnowledge: (path: string, tags: string[] = []) =>
    req<KnowledgeResource>("/api/knowledge/import-local", {
      method: "POST",
      body: JSON.stringify({ path, tags }),
    }),

  // source files
  pickDirectory: () => req<DirectoryPickResponse>("/api/files/pick-directory"),
  listSourceTree: (path: string) =>
    req<SourceTreeResponse>(`/api/files/tree?path=${encodeURIComponent(path)}`),
  readSourceFile: (path: string) =>
    req<SourceFileResponse>(`/api/files/read?path=${encodeURIComponent(path)}`),

  // git / coding worktrees
  getGitStatus: (path: string) =>
    req<GitStatusResponse>(`/api/git/status?path=${encodeURIComponent(path)}`),
  prepareCodingWorktree: (payload: { request_id: string; working_directory: string }) =>
    req<CodingWorktreeState>("/api/git/worktrees/prepare", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // chats
  listChats: () => req<ChatSession[]>("/api/chats"),
  getChat: (id: string) => req<ChatSession>(`/api/chats/${id}`),
  postChatMessage: (payload: ChatMessageRequest) =>
    req<ChatSession>("/api/chats/message", { method: "POST", body: JSON.stringify(payload) }),
  deleteChat: (id: string) => req<void>(`/api/chats/${id}`, { method: "DELETE" }),

  // templates
  listTemplates: () => req<Template[]>("/api/templates"),
  createTemplate: (t: Template) =>
    req<Template>("/api/templates", { method: "POST", body: JSON.stringify(t) }),
  deleteTemplate: (id: string) => req<void>(`/api/templates/${id}`, { method: "DELETE" }),

  // workflows
  listWorkflows: () => req<Workflow[]>("/api/workflows"),
  createWorkflow: (w: Workflow) =>
    req<Workflow>("/api/workflows", { method: "POST", body: JSON.stringify(w) }),
  deleteWorkflow: (id: string) => req<void>(`/api/workflows/${id}`, { method: "DELETE" }),

  // skills
  listSkills: () => req<SkillDocument[]>("/api/skills"),
  listLocalInstalledSkills: (path?: string) =>
    req<SkillDocument[]>(
      path?.trim()
        ? `/api/skills/installed-local?path=${encodeURIComponent(path.trim())}`
        : "/api/skills/installed-local",
    ),
  installSkill: (markdown: string, source: SkillSource = "user") =>
    req<SkillDocument>("/api/skills/install", {
      method: "POST",
      body: JSON.stringify({ markdown, source }),
    }),
  deleteSkill: (id: string) => req<void>(`/api/skills/${id}`, { method: "DELETE" }),
  deleteSkillVersion: (id: string, version: string) =>
    req<void>(`/api/skills/${id}/versions/${encodeURIComponent(version)}`, { method: "DELETE" }),
  listSkillCandidates: () => req<CandidateBatch[]>("/api/skills/candidates"),
  importLocalSkills: (path: string) =>
    req<SkillDocument[]>("/api/skills/candidates/import-local", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  importExternalSkill: (url: string) =>
    req<SkillDocument>("/api/skills/candidates/import-url", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  importExternalSkills: (urls: string[]) =>
    req<ExternalSkillImportResult>("/api/skills/candidates/import-urls", {
      method: "POST",
      body: JSON.stringify({ urls }),
    }),
  approveSkillCandidate: (batchId: string, skillId: string) =>
    req<SkillDocument>(`/api/skills/candidates/${batchId}/${skillId}/approve`, { method: "POST" }),
  discardSkillCandidate: (batchId: string, skillId: string) =>
    req<void>(`/api/skills/candidates/${batchId}/${skillId}`, { method: "DELETE" }),
};
