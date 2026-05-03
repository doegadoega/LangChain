import { type ReactNode, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Bot,
  FileText,
  Globe2,
  Link,
  Loader2,
  MessageSquareMore,
  Send,
  Trash2,
} from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Label, Select, Textarea } from "../components/ui/Field";
import { PROVIDER_LABEL, ROLE_LABEL } from "../lib/format";
import { useApp } from "../state/store";
import type { AgentConfig, ChatAttachment, ChatSession, StreamEvent } from "../types";

const chatSessionId = (agentId: string) => `chat_${agentId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48) || "agent"}`;

export function AgentChat() {
  const request = useApp((state) => state.request);
  const savedAgents = useApp((state) => state.agents);
  const run = useApp((state) => state.run);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [message, setMessage] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [attachRequest, setAttachRequest] = useState(false);
  const [attachLogs, setAttachLogs] = useState(false);
  const [attachError, setAttachError] = useState(false);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const agents = useMemo(() => mergeAgents(request.agents, savedAgents), [request.agents, savedAgents]);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  const selectedSession = selectedAgent
    ? sessions.find((session) => session.id === chatSessionId(selectedAgent.id))
    : undefined;

  useEffect(() => {
    void api.listChats().then(setSessions).catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    if (!selectedAgentId && agents[0]) setSelectedAgentId(agents[0].id);
  }, [agents, selectedAgentId]);

  const sendMessage = async () => {
    const question = message.trim();
    if (!selectedAgent || !question || sending) return;
    setSending(true);
    setStatus("");
    try {
      const attachments = buildAttachments({
        attachRequest,
        attachLogs,
        attachError,
        request,
        events: run.events,
        error: run.error,
      });
      const session = await api.postChatMessage({
        session_id: chatSessionId(selectedAgent.id),
        agent: selectedAgent,
        question,
        web_search_enabled: useWebSearch,
        attachments,
      });
      setSessions((items) => [session, ...items.filter((item) => item.id !== session.id)]);
      setMessage("");
      setStatus("保存しました。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  };

  const clearSession = async () => {
    if (!selectedSession) return;
    await api.deleteChat(selectedSession.id);
    setSessions((items) => items.filter((item) => item.id !== selectedSession.id));
    setStatus("このエージェントのチャット履歴を削除しました。");
  };

  return (
    <div className="grid h-full grid-cols-[320px_minmax(420px,1fr)] gap-4 overflow-hidden p-4">
      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>相談チャット</CardTitle>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-fg-muted)]">
              エージェントを選んで、普段の相談やエラー確認を直接できます。
            </p>
          </div>
          <MessageSquareMore className="h-4 w-4 text-[var(--color-fg-muted)]" />
        </CardHeader>
        <CardBody className="flex-1 space-y-4 overflow-y-auto">
          <div>
            <Label>チャット相手</Label>
            <Select
              value={selectedAgent?.id ?? ""}
              onChange={(event) => setSelectedAgentId(event.target.value)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} / {ROLE_LABEL[agent.org_role]}
                </option>
              ))}
            </Select>
          </div>

          {selectedAgent && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <div className="flex items-start gap-2">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{selectedAgent.name}</div>
                  <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
                    {ROLE_LABEL[selectedAgent.org_role]} · {PROVIDER_LABEL[selectedAgent.provider]}
                  </div>
                  <div className="mt-2 line-clamp-4 text-xs leading-relaxed text-[var(--color-fg-muted)]">
                    {selectedAgent.persona || "ペルソナ未設定"}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
            <div className="text-xs font-semibold">添付する情報</div>
            <ToggleRow
              checked={attachRequest}
              onChange={setAttachRequest}
              label="依頼内容"
              detail="今の Workspace の入力内容を一緒に渡す"
            />
            <ToggleRow
              checked={attachLogs}
              onChange={setAttachLogs}
              label="直近ログ"
              detail="直近の実行イベントを一緒に渡す"
            />
            <ToggleRow
              checked={attachError}
              onChange={setAttachError}
              label="エラー内容"
              detail="最後のエラーを一緒に渡す"
              disabled={!run.error}
            />
          </div>

          <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
            <ToggleRow
              checked={useWebSearch}
              onChange={setUseWebSearch}
              label="Web検索を使う"
              detail="回答に使ったURLを保存して表示します"
              icon={<Globe2 className="h-4 w-4" />}
            />
          </div>

          <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold">履歴</div>
              {selectedSession && (
                <button
                  type="button"
                  onClick={() => void clearSession()}
                  className="rounded p-1 text-[var(--color-fg-muted)] hover:bg-red-500/20 hover:text-red-300"
                  title="履歴を削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="text-xs text-[var(--color-fg-muted)]">
              {selectedSession
                ? `${selectedSession.messages.length} messages / ${new Date(
                    selectedSession.updated_at ?? selectedSession.created_at,
                  ).toLocaleString("ja-JP")}`
                : "このエージェントとの履歴はまだありません。"}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>{selectedAgent ? selectedAgent.name : "チャット"}</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              通常質問、設計相談、使い方確認、エラー相談に使えます。
            </p>
          </div>
          {sending && <Loader2 className="h-4 w-4 animate-spin text-sky-200" />}
        </CardHeader>
        <CardBody className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            {!selectedSession && (
              <div className="grid h-full place-items-center text-sm text-[var(--color-fg-subtle)]">
                質問を送ると、このエージェントとの会話がここに残ります。
              </div>
            )}
            {selectedSession?.messages.map((item) => (
              <div
                key={item.id}
                className={clsx(
                  "max-w-[86%] rounded-lg border p-3",
                  item.role === "user"
                    ? "ml-auto border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                    : "mr-auto border-[var(--color-border)] bg-[var(--color-surface)]",
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-[var(--color-fg-subtle)]">
                  <span>{item.role === "user" ? "あなた" : item.agent_name ?? "Agent"}</span>
                  <span>{new Date(item.created_at).toLocaleString("ja-JP")}</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--color-fg)]">
                  {item.content}
                </pre>
                {item.attachments && item.attachments.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-2">
                    {item.attachments.map((attachment) => (
                      <div
                        key={`${item.id}-${attachment.kind}-${attachment.title}`}
                        className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {attachment.title}
                      </div>
                    ))}
                  </div>
                )}
                {item.sources && item.sources.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-2">
                    <div className="text-xs font-semibold text-[var(--color-fg-muted)]">
                      参照URL
                    </div>
                    {item.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-1.5 break-all text-xs text-sky-300 hover:text-sky-200"
                      >
                        <Link className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{source.title || source.url}</span>
                      </a>
                    ))}
                  </div>
                )}
                {item.error && (
                  <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                    {item.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Textarea
              rows={4}
              value={message}
              className="font-sans"
              placeholder="聞きたいことを書いてください。例: このエラーは何？ / この設計で大丈夫？ / 初心者向けに説明して"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  void sendMessage();
                }
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-[var(--color-fg-muted)]">{status}</div>
              <Button
                variant="primary"
                disabled={!message.trim() || !selectedAgent || sending}
                onClick={() => void sendMessage()}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                送信
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  detail,
  disabled = false,
  icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  detail: string;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--color-accent)]"
      />
      {icon}
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{label}</span>
        <span className="block text-xs text-[var(--color-fg-muted)]">{detail}</span>
      </span>
    </label>
  );
}

function mergeAgents(teamAgents: AgentConfig[], savedAgents: AgentConfig[]) {
  const merged = new Map<string, AgentConfig>();
  for (const agent of teamAgents) {
    if (agent.enabled !== false) merged.set(agent.id, agent);
  }
  for (const agent of savedAgents) {
    if (!merged.has(agent.id)) merged.set(agent.id, agent);
  }
  return Array.from(merged.values());
}

function buildAttachments({
  attachRequest,
  attachLogs,
  attachError,
  request,
  events,
  error,
}: {
  attachRequest: boolean;
  attachLogs: boolean;
  attachError: boolean;
  request: unknown;
  events: StreamEvent[];
  error?: string;
}): ChatAttachment[] {
  const attachments: ChatAttachment[] = [];
  if (attachRequest) {
    attachments.push({
      kind: "request",
      title: "依頼内容",
      content: JSON.stringify(request, null, 2),
    });
  }
  if (attachLogs) {
    attachments.push({
      kind: "logs",
      title: "直近ログ",
      content: JSON.stringify(events.slice(-20), null, 2),
    });
  }
  if (attachError && error) {
    attachments.push({
      kind: "error",
      title: "エラー内容",
      content: error,
    });
  }
  return attachments;
}
