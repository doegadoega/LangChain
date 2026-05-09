import type {
  AgentConfig,
  CandidateBatch,
  ChatMessageRequest,
  ChatSession,
  ManagedRequest,
  ProviderKind,
  ProviderModelsResponse,
  DirectoryPickResponse,
  Project,
  SourceFileResponse,
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

  // source files
  pickDirectory: () => req<DirectoryPickResponse>("/api/files/pick-directory"),
  listSourceTree: (path: string) =>
    req<SourceTreeResponse>(`/api/files/tree?path=${encodeURIComponent(path)}`),
  readSourceFile: (path: string) =>
    req<SourceFileResponse>(`/api/files/read?path=${encodeURIComponent(path)}`),

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
  approveSkillCandidate: (batchId: string, skillId: string) =>
    req<SkillDocument>(`/api/skills/candidates/${batchId}/${skillId}/approve`, { method: "POST" }),
  discardSkillCandidate: (batchId: string, skillId: string) =>
    req<void>(`/api/skills/candidates/${batchId}/${skillId}`, { method: "DELETE" }),
};
