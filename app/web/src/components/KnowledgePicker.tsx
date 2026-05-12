import { useEffect, useMemo, useState } from "react";
import { Database, FilePlus2, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api } from "../api/client";
import { Button } from "./ui/Button";
import { Input, Label, Select, Textarea } from "./ui/Field";
import { useApp } from "../state/store";
import type { KnowledgeKind, KnowledgeResource } from "../types";

const uid = () => Math.random().toString(36).slice(2, 10);

const KIND_OPTIONS: KnowledgeKind[] = ["markdown", "text", "image", "figma", "mcp", "link", "note"];

export function KnowledgePicker({
  selected,
  onChange,
  disabled = false,
}: {
  selected: KnowledgeResource[];
  onChange: (items: KnowledgeResource[]) => void;
  disabled?: boolean;
}) {
  const knowledge = useApp((state) => state.knowledge);
  const loadKnowledge = useApp((state) => state.loadKnowledge);
  const saveKnowledge = useApp((state) => state.saveKnowledge);
  const deleteKnowledge = useApp((state) => state.deleteKnowledge);
  const [path, setPath] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<KnowledgeResource>({
    id: `knowledge_${uid()}`,
    title: "",
    kind: "markdown",
    content: "",
    source: "",
    content_type: "text/plain",
    tags: [],
  });

  useEffect(() => {
    void loadKnowledge();
  }, [loadKnowledge]);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);

  const toggle = (item: KnowledgeResource) => {
    if (disabled) return;
    onChange(selectedIds.has(item.id) ? selected.filter((entry) => entry.id !== item.id) : [...selected, item]);
  };

  const importLocal = async () => {
    if (!path.trim()) return;
    try {
      const item = await api.importLocalKnowledge(path.trim());
      await loadKnowledge();
      onChange(selectedIds.has(item.id) ? selected : [...selected, item]);
      setPath("");
      setStatus(`${item.title} を取り込みました。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const saveManual = async () => {
    if (!draft.title.trim()) {
      setStatus("title を入力してください。");
      return;
    }
    try {
      const item = await saveKnowledge({
        ...draft,
        id: draft.id.trim() || `knowledge_${uid()}`,
        title: draft.title.trim(),
      });
      onChange(selectedIds.has(item.id) ? selected : [...selected, item]);
      setDraft({
        id: `knowledge_${uid()}`,
        title: "",
        kind: "markdown",
        content: "",
        source: "",
        content_type: "text/plain",
        tags: [],
      });
      setStatus(`${item.title} を保存して添付しました。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const remove = async (id: string) => {
    await deleteKnowledge(id);
    onChange(selected.filter((item) => item.id !== id));
  };

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-[var(--color-accent)]" />
            学習用リソース
          </div>
          <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
            MD、画像、Figma/FIG、MCPメモをこのワークのコンテキストとして添付します。
          </div>
        </div>
        <span className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-fg-muted)]">
          {selected.length} selected
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Input
              value={path}
              placeholder="/path/to/README.md / image.png / mcp.json"
              disabled={disabled}
              onChange={(event) => setPath(event.target.value)}
            />
            <Button variant="outline" disabled={disabled || !path.trim()} onClick={() => void importLocal()}>
              <FilePlus2 className="h-4 w-4" />
              取込
            </Button>
          </div>

          <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
            {knowledge.length === 0 && (
              <div className="p-3 text-center text-xs text-[var(--color-fg-subtle)]">
                まだリソースがありません。ローカルファイルを取り込むか、右側でメモを作成してください。
              </div>
            )}
            {knowledge.map((item) => (
              <div
                key={item.id}
                className={clsx(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                  selectedIds.has(item.id)
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)]",
                )}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="font-semibold text-[var(--color-fg)]">{item.title}</span>
                  <span className="ml-2 text-[var(--color-fg-subtle)]">{item.kind}</span>
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void remove(item.id)}
                  className="rounded p-1 text-[var(--color-fg-muted)] hover:bg-red-500/20 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
            <div>
              <Label>title</Label>
              <Input
                value={draft.title}
                disabled={disabled}
                placeholder="例: 社内コーディング規約"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>
            <div>
              <Label>kind</Label>
              <Select
                value={draft.kind}
                disabled={disabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))
                }
              >
                {KIND_OPTIONS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Textarea
            rows={5}
            value={draft.content}
            disabled={disabled}
            className="font-sans"
            placeholder="MD本文、MCPメモ、Figma URL、補足メモなど"
            onChange={(event) =>
              setDraft((current) => ({ ...current, content: event.target.value }))
            }
          />
          <Button variant="outline" size="sm" disabled={disabled || !draft.title.trim()} onClick={() => void saveManual()}>
            <Plus className="h-4 w-4" />
            保存して添付
          </Button>
        </div>
      </div>
      {status && <div className="mt-2 text-xs text-[var(--color-fg-muted)]">{status}</div>}
    </div>
  );
}
