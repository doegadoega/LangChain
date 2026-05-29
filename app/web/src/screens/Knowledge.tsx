// STRAND — Knowledge / Library. Resource list | center register-edit form.
// Presentation migrated to the strand design system; behavior preserved verbatim.
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { Database, FilePlus2, Trash2 } from "lucide-react";
import { StrandShell } from "../components/strand/Chrome";
import { Btn, Icon, Panel } from "../components/strand/primitives";
import { api } from "../api/client";
import { useApp } from "../state/store";
import type { KnowledgeKind, KnowledgeResource } from "../types";

const uid = () => Math.random().toString(36).slice(2, 10);
const kinds: KnowledgeKind[] = ["markdown", "text", "image", "figma", "mcp", "link", "note"];

const emptyResource = (): KnowledgeResource => ({
  id: `knowledge_${uid()}`,
  title: "",
  kind: "markdown",
  content: "",
  source: "",
  content_type: "text/plain",
  tags: [],
});

// ---------- shared strand input styles (mirrors Coding / AgentStudio) ----------
const inputStyle = (disabled = false): CSSProperties => ({
  width: "100%",
  height: 30,
  padding: "0 10px",
  border: "1px solid var(--border)",
  borderRadius: 3,
  background: disabled ? "var(--surface-2)" : "var(--surface)",
  color: disabled ? "var(--ink-3)" : "var(--ink)",
  fontSize: 12,
  outline: "none",
});

const textareaStyle = (disabled = false): CSSProperties => ({
  width: "100%",
  padding: 10,
  border: "1px solid var(--border)",
  borderRadius: 3,
  background: disabled ? "var(--surface-2)" : "var(--surface)",
  color: disabled ? "var(--ink-3)" : "var(--ink)",
  fontSize: 12,
  fontFamily: "var(--strand-font-sans)",
  lineHeight: 1.5,
  resize: "vertical",
  outline: "none",
});

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

const fieldLabelStyle: CSSProperties = {
  fontSize: 9,
  color: "var(--ink-3)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 6,
  display: "block",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mono" style={fieldLabelStyle}>
        {label}
      </span>
      {children}
    </div>
  );
}

export function Knowledge() {
  const knowledge = useApp((state) => state.knowledge);
  const loadKnowledge = useApp((state) => state.loadKnowledge);
  const saveKnowledge = useApp((state) => state.saveKnowledge);
  const deleteKnowledge = useApp((state) => state.deleteKnowledge);
  const [draft, setDraft] = useState<KnowledgeResource>(() => emptyResource());
  const [path, setPath] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    void loadKnowledge();
  }, [loadKnowledge]);

  const save = async () => {
    if (!draft.title.trim()) {
      setStatus("title を入力してください。");
      return;
    }
    const saved = await saveKnowledge({ ...draft, title: draft.title.trim() });
    setDraft(emptyResource());
    setStatus(`${saved.title} を保存しました。`);
  };

  const importLocal = async () => {
    if (!path.trim()) return;
    try {
      const item = await api.importLocalKnowledge(path.trim());
      await loadKnowledge();
      setPath("");
      setStatus(`${item.title} を取り込みました。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const canDelete = knowledge.some((item) => item.id === draft.id);

  return (
    <StrandShell breadcrumb={["library", "knowledge"]} mainStyle={{ display: "flex", overflow: "hidden" }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "360px minmax(0,1fr)",
          background: "var(--paper)",
          overflow: "hidden",
        }}
      >
        {/* LEFT — resource list */}
        <aside
          style={{
            display: "flex",
            minWidth: 0,
            flexDirection: "column",
            borderRight: "1px solid var(--border)",
            background: "var(--paper)",
          }}
        >
          <div style={{ borderBottom: "1px solid var(--border)", padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              <Database style={{ width: 16, height: 16, color: "var(--accent)" }} />
              Knowledge
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 }}>
              Workspace と Coding に添付する学習用リソースを管理します。
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {knowledge.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "24px 16px",
                  textAlign: "center",
                  border: "1px dashed var(--border-2)",
                  borderRadius: 4,
                  background: "var(--surface-2)",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>リソースはまだありません。</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {knowledge.map((item) => {
                  const sel = draft.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraft(item)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: 10,
                        borderRadius: 3,
                        border: "1px solid var(--border)",
                        borderLeft: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: sel ? "var(--surface)" : "var(--surface-2)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: sel ? 600 : 500,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title}
                      </div>
                      <div className="mono" style={{ marginTop: 6, fontSize: 10, color: "var(--ink-4)" }}>
                        {item.kind}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER — register / edit form */}
        <main style={{ minWidth: 0, overflowY: "auto", padding: 16 }}>
          <Panel
            title="リソース登録 / 編集"
            action={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Btn variant="outline" size="sm" onClick={() => setDraft(emptyResource())}>
                  新規
                </Btn>
                <Btn
                  variant="outline"
                  size="sm"
                  disabled={!canDelete}
                  onClick={() => void deleteKnowledge(draft.id)}
                  style={{ color: canDelete ? "var(--danger)" : "var(--ink-3)" }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                  削除
                </Btn>
              </span>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr) 160px", alignItems: "start" }}>
                <Field label="title">
                  <input
                    value={draft.title}
                    placeholder="例: iOSコーディング規約"
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    style={inputStyle()}
                  />
                </Field>
                <Field label="kind">
                  <select
                    value={draft.kind}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))
                    }
                    className="mono"
                    style={selectStyle}
                  >
                    {kinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="source">
                <input
                  value={draft.source}
                  placeholder="URL / file path / figma file note / MCP config"
                  onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
                  style={inputStyle()}
                />
              </Field>
              <Field label="content">
                <textarea
                  rows={14}
                  value={draft.content}
                  placeholder="MD本文、MCPメモ、Figma連携情報、補足メモなど"
                  onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                  style={textareaStyle()}
                />
              </Field>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) 160px", alignItems: "end" }}>
                <input
                  value={path}
                  placeholder="/path/to/README.md"
                  onChange={(event) => setPath(event.target.value)}
                  className="mono"
                  style={{ ...inputStyle(), fontFamily: "var(--strand-font-mono)" }}
                />
                <Btn variant="outline" onClick={() => void importLocal()} style={{ justifyContent: "center" }}>
                  <FilePlus2 style={{ width: 14, height: 14 }} />
                  ファイル取込
                </Btn>
              </div>
              <div>
                <Btn variant="solid" tone="accent" onClick={() => void save()}>
                  <Icon name="check" size={12} />
                  保存
                </Btn>
              </div>
              {status && <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{status}</div>}
            </div>
          </Panel>
        </main>
      </div>
    </StrandShell>
  );
}
