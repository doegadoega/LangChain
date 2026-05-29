// STRAND — 相談チャット. Left: partner + attachments + history | Right: conversation + composer.
// Presentation migrated to the strand design system; behavior preserved verbatim.
import { type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from "react";
import {
  Bot,
  FileText,
  Globe2,
  Image as ImageIcon,
  Link,
  Loader2,
  MessageSquareMore,
  Send,
  Trash2,
} from "lucide-react";
import { StrandShell } from "../components/strand/Chrome";
import { Btn } from "../components/strand/primitives";
import { api } from "../api/client";
import { PROVIDER_LABEL, ROLE_LABEL } from "../lib/format";
import { useApp } from "../state/store";
import type { AgentConfig, ChatAttachment, ChatSession, StreamEvent } from "../types";

const chatSessionId = (agentId: string) => `chat_${agentId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48) || "agent"}`;

// ---------- shared strand input styles (mirrors Coding) ----------
const selectStyle: CSSProperties = {
  width: "100%",
  height: 30,
  padding: "0 8px",
  border: "1px solid var(--border)",
  borderRadius: 3,
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 12,
  outline: "none",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  padding: 10,
  border: "1px solid var(--border)",
  borderRadius: 3,
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 12,
  fontFamily: "var(--strand-font-sans)",
  lineHeight: 1.5,
  resize: "vertical",
  outline: "none",
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 9,
  color: "var(--ink-3)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 6,
  display: "block",
};

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
  const [imageAttachments, setImageAttachments] = useState<ChatAttachment[]>([]);
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
        attachments: [...attachments, ...imageAttachments],
      });
      setSessions((items) => [session, ...items.filter((item) => item.id !== session.id)]);
      setMessage("");
      setImageAttachments([]);
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
    <StrandShell breadcrumb={["work", "相談チャット"]} mainStyle={{ display: "flex", overflow: "hidden" }}>
      <style>{"@keyframes chat-spin{to{transform:rotate(360deg)}}.chat .spin{animation:chat-spin 0.8s linear infinite}"}</style>
      <div
        className="chat"
        style={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "320px minmax(420px,1fr)",
          background: "var(--paper)",
          overflow: "hidden",
        }}
      >
        {/* LEFT — partner / attachments / history */}
        <aside
          style={{
            display: "flex",
            minWidth: 0,
            flexDirection: "column",
            borderRight: "1px solid var(--border)",
            background: "var(--paper)",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              background: "var(--paper-2)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                WORK · CHAT
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>相談チャット</div>
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5, color: "var(--ink-3)" }}>
                エージェントを選んで、普段の相談やエラー確認を直接できます。
              </div>
            </div>
            <MessageSquareMore style={{ width: 16, height: 16, flexShrink: 0, color: "var(--ink-3)" }} />
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <span className="mono" style={fieldLabelStyle}>
                チャット相手
              </span>
              <select
                value={selectedAgent?.id ?? ""}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                style={selectStyle}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} / {ROLE_LABEL[agent.org_role]}
                  </option>
                ))}
              </select>
            </div>

            {selectedAgent && (
              <div style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Bot style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, color: "var(--accent-deep)" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedAgent.name}
                    </div>
                    <div className="mono" style={{ marginTop: 4, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
                      {ROLE_LABEL[selectedAgent.org_role]} · {PROVIDER_LABEL[selectedAgent.provider]}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        fontSize: 11,
                        lineHeight: 1.6,
                        color: "var(--ink-2)",
                      }}
                    >
                      {selectedAgent.persona || "ペルソナ未設定"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>添付する情報</div>
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

            <div style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <ToggleRow
                checked={useWebSearch}
                onChange={setUseWebSearch}
                label="Web検索を使う"
                detail="回答に使ったURLを保存して表示します"
                icon={<Globe2 style={{ width: 16, height: 16, color: "var(--ink-2)" }} />}
              />
            </div>

            <div style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>履歴</div>
                {selectedSession && (
                  <button
                    type="button"
                    onClick={() => void clearSession()}
                    title="履歴を削除"
                    style={{ borderRadius: 3, padding: 4, color: "var(--ink-3)", background: "transparent", border: "1px solid transparent" }}
                  >
                    <Trash2 style={{ width: 16, height: 16 }} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {selectedSession
                  ? `${selectedSession.messages.length} messages / ${new Date(
                      selectedSession.updated_at ?? selectedSession.created_at,
                    ).toLocaleString("ja-JP")}`
                  : "このエージェントとの履歴はまだありません。"}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT — conversation + composer */}
        <main style={{ display: "flex", minWidth: 0, flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              background: "var(--paper-2)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedAgent ? selectedAgent.name : "チャット"}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
                通常質問、設計相談、使い方確認、エラー相談に使えます。
              </div>
            </div>
            {sending && <Loader2 style={{ width: 16, height: 16, color: "var(--ok)" }} className="spin" />}
          </div>

          <div style={{ flex: 1, display: "flex", minHeight: 0, flexDirection: "column", overflow: "hidden", padding: 14, gap: 12 }}>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {!selectedSession && (
                <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center", fontSize: 12, lineHeight: 1.6, color: "var(--ink-3)" }}>
                  質問を送ると、このエージェントとの会話がここに残ります。
                </div>
              )}
              {selectedSession?.messages.map((item) => (
                <div
                  key={item.id}
                  style={{
                    maxWidth: "86%",
                    marginLeft: item.role === "user" ? "auto" : undefined,
                    marginRight: item.role === "user" ? undefined : "auto",
                    borderRadius: 4,
                    border: item.role === "user" ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: item.role === "user" ? "var(--accent-soft)" : "var(--surface)",
                    padding: 12,
                  }}
                >
                  <div className="mono" style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 9, color: "var(--ink-4)" }}>
                    <span>{item.role === "user" ? "あなた" : item.agent_name ?? "Agent"}</span>
                    <span>{new Date(item.created_at).toLocaleString("ja-JP")}</span>
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--strand-font-sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink)", margin: 0 }}>
                    {item.content}
                  </pre>
                  {item.attachments && item.attachments.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      {item.attachments.map((attachment) => (
                        <div
                          key={`${item.id}-${attachment.kind}-${attachment.title}`}
                          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-3)" }}
                        >
                          {attachment.kind === "image" ? (
                            <ImageIcon style={{ width: 14, height: 14 }} />
                          ) : (
                            <FileText style={{ width: 14, height: 14 }} />
                          )}
                          {attachment.title}
                        </div>
                      ))}
                    </div>
                  )}
                  {item.sources && item.sources.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>参照URL</div>
                      {item.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: "flex", alignItems: "flex-start", gap: 6, wordBreak: "break-all", fontSize: 11, color: "var(--info)" }}
                        >
                          <Link style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0 }} />
                          <span>{source.title || source.url}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {item.error && (
                    <div style={{ marginTop: 12, borderRadius: 3, border: "1px solid var(--warn)", background: "var(--warn-bg)", padding: 8, fontSize: 11, color: "var(--warn)" }}>
                      {item.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                rows={4}
                value={message}
                placeholder="聞きたいことを書いてください。例: このエラーは何？ / この設計で大丈夫？ / 初心者向けに説明して"
                onChange={(event) => setMessage(event.target.value)}
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files).filter((file) =>
                    file.type.startsWith("image/"),
                  );
                  if (files.length) {
                    event.preventDefault();
                    void addImageFiles(files, setImageAttachments, setStatus);
                  }
                }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    void sendMessage();
                  }
                }}
                style={textareaStyle}
              />
              <div style={{ borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface-2)", padding: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <label
                    style={{
                      display: "inline-flex",
                      cursor: "pointer",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 3,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      padding: "5px 8px",
                      fontSize: 11,
                      color: "var(--ink-2)",
                    }}
                  >
                    <ImageIcon style={{ width: 16, height: 16 }} />
                    画像を添付
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        event.target.value = "";
                        void addImageFiles(files, setImageAttachments, setStatus);
                      }}
                    />
                  </label>
                  <div style={{ fontSize: 10, color: "var(--ink-4)" }}>スクショは貼り付けでも追加できます。</div>
                </div>
                {imageAttachments.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {imageAttachments.map((attachment, index) => (
                      <div
                        key={`${attachment.title}-${index}`}
                        style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 3, border: "1px solid var(--border)", background: "var(--surface)", padding: "5px 8px", fontSize: 11 }}
                      >
                        {attachment.content.startsWith("data:image/") ? (
                          <img
                            src={attachment.content}
                            alt={attachment.title}
                            style={{ width: 32, height: 32, borderRadius: 3, border: "1px solid var(--border)", objectFit: "cover" }}
                          />
                        ) : (
                          <ImageIcon style={{ width: 16, height: 16, color: "var(--ink-3)" }} />
                        )}
                        <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>
                          {attachment.title}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setImageAttachments((items) => items.filter((_, i) => i !== index))
                          }
                          style={{ borderRadius: 3, padding: 2, color: "var(--ink-3)", background: "transparent", border: "1px solid transparent" }}
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0, fontSize: 11, color: "var(--ink-3)" }}>{status}</div>
                <Btn
                  variant="solid"
                  tone="accent"
                  disabled={!message.trim() || !selectedAgent || sending}
                  onClick={() => void sendMessage()}
                >
                  {sending ? <Loader2 style={{ width: 14, height: 14 }} className="spin" /> : <Send style={{ width: 14, height: 14 }} />}
                  送信
                </Btn>
              </div>
            </div>
          </div>
        </main>
      </div>
    </StrandShell>
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
      style={{
        display: "flex",
        cursor: disabled ? "not-allowed" : "pointer",
        alignItems: "center",
        gap: 12,
        borderRadius: 3,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 16, height: 16, accentColor: "var(--accent)", flexShrink: 0 }}
      />
      {icon}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--ink-3)" }}>{detail}</span>
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

async function addImageFiles(
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
              description: "ユーザーがチャットへ添付した画像です。",
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
