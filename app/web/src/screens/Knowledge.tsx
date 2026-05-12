import { useEffect, useState } from "react";
import { Database, FilePlus2, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
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

  return (
    <div className="grid h-full grid-cols-[360px_minmax(0,1fr)] overflow-hidden">
      <aside className="border-r border-[var(--color-border)] p-3">
        <div className="mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-[var(--color-accent)]" />
            Knowledge
          </div>
          <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
            Workspace と Coding に添付する学習用リソースを管理します。
          </div>
        </div>
        <div className="space-y-1">
          {knowledge.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDraft(item)}
              className="block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-left hover:border-[var(--color-border-strong)]"
            >
              <div className="truncate text-sm font-semibold">{item.title}</div>
              <div className="mt-1 text-xs text-[var(--color-fg-subtle)]">{item.kind}</div>
            </button>
          ))}
          {knowledge.length === 0 && (
            <div className="rounded-md border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-fg-subtle)]">
              リソースはまだありません。
            </div>
          )}
        </div>
      </aside>

      <main className="overflow-y-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>リソース登録 / 編集</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDraft(emptyResource())}>
                新規
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!knowledge.some((item) => item.id === draft.id)}
                onClick={() => void deleteKnowledge(draft.id)}
              >
                <Trash2 className="h-4 w-4" />
                削除
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
              <div>
                <Label>title</Label>
                <Input
                  value={draft.title}
                  placeholder="例: iOSコーディング規約"
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div>
                <Label>kind</Label>
                <Select
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))
                  }
                >
                  {kinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>source</Label>
              <Input
                value={draft.source}
                placeholder="URL / file path / figma file note / MCP config"
                onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
              />
            </div>
            <div>
              <Label>content</Label>
              <Textarea
                rows={14}
                value={draft.content}
                className="font-sans"
                placeholder="MD本文、MCPメモ、Figma連携情報、補足メモなど"
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px]">
              <Input
                value={path}
                placeholder="/path/to/README.md"
                onChange={(event) => setPath(event.target.value)}
              />
              <Button variant="outline" onClick={() => void importLocal()}>
                <FilePlus2 className="h-4 w-4" />
                ファイル取込
              </Button>
            </div>
            <Button onClick={() => void save()}>保存</Button>
            {status && <div className="text-xs text-[var(--color-fg-muted)]">{status}</div>}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
