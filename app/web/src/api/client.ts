import type {
  AgentConfig,
  ChatMessageRequest,
  ChatSession,
  ManagedRequest,
  ProviderKind,
  ProviderModelsResponse,
  Project,
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
};
