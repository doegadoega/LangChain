import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
import { newAgent, useApp } from "../state/store";
import { PROVIDER_LABEL, ROLE_ACCENT, ROLE_LABEL } from "../lib/format";
import { api } from "../api/client";
import type { AgentConfig, OrgRole, ProviderKind } from "../types";
import clsx from "clsx";
import { Plus, Save, Search, Trash2, X } from "lucide-react";

export function AgentStudio() {
  const savedAgents = useApp((s) => s.agents);
  const deleteSavedAgent = useApp((s) => s.deleteSavedAgent);
  const loadAll = useApp((s) => s.loadAll);

  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<OrgRole | "all">("all");
  const [draft, setDraft] = useState<AgentConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(savedAgents[0]?.id ?? null);
  const [editing, setEditing] = useState<AgentConfig | null>(null);
  const [saveMessage, setSaveMessage] = useState("");

  const savedIds = useMemo(() => new Set(savedAgents.map((agent) => agent.id)), [savedAgents]);
  const listAgents = useMemo<AgentConfig[]>(
    () => (draft ? [draft, ...savedAgents] : savedAgents),
    [draft, savedAgents],
  );

  const filtered = useMemo(() => {
    return listAgents.filter((a) => {
      if (filterRole !== "all" && a.org_role !== filterRole) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.persona.toLowerCase().includes(q) ||
        a.skills.join(",").toLowerCase().includes(q)
      );
    });
  }, [listAgents, query, filterRole]);

  const sourceForId = (id: string | null): AgentConfig | undefined => {
    if (!id) return undefined;
    if (draft && draft.id === id) return draft;
    return savedAgents.find((a) => a.id === id);
  };

  const baseSelected = sourceForId(selectedId) ?? filtered[0];
  const selected: AgentConfig | undefined =
    editing && baseSelected && editing.id === baseSelected.id ? editing : baseSelected;
  const isDraft = !!(selected && draft && selected.id === draft.id);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setEditing(null);
    setSaveMessage("");
  };

  const handleChange = (patch: Partial<AgentConfig>) => {
    if (!selected) return;
    const next = { ...selected, ...patch };
    if (isDraft) {
      setDraft(next);
    } else {
      setEditing(next);
    }
  };

  const handleNew = () => {
    const a = newAgent();
    setDraft(a);
    setSelectedId(a.id);
    setEditing(null);
    setSaveMessage("");
  };

  const saveAgent = async (agent: AgentConfig) => {
    const payload: AgentConfig = { ...agent, is_custom: true };
    const exists = savedIds.has(agent.id);
    const saved = exists
      ? await api.updateAgent(agent.id, payload)
      : await api.createAgent(payload);
    await loadAll();
    if (isDraft) setDraft(null);
    setEditing(null);
    setSelectedId(saved.id);
    setSaveMessage(`${saved.name} を保存しました。`);
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (isDraft) {
      setDraft(null);
      setSelectedId(savedAgents[0]?.id ?? null);
      setEditing(null);
      return;
    }
    if (!window.confirm(`「${selected.name}」をライブラリから完全に削除しますか？\nチームに参加中の場合はチームからも自動的に外れます。`)) {
      return;
    }
    await deleteSavedAgent(selected.id);
    setEditing(null);
    setSelectedId(savedAgents.find((a) => a.id !== selected.id)?.id ?? null);
    setSaveMessage("");
  };

  return (
    <div className="grid h-full grid-cols-[420px_minmax(0,1fr)] overflow-hidden">
      {/* List */}
      <div className="flex flex-col overflow-hidden border-r border-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-muted)]" />
              <Input
                placeholder="検索…"
                className="pl-7"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleNew}>
              <Plus className="h-3.5 w-3.5" /> 新規
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            <RoleChip role="all" current={filterRole} setRole={setFilterRole} />
            {(Object.keys(ROLE_LABEL) as OrgRole[]).map((r) => (
              <RoleChip key={r} role={r} current={filterRole} setRole={setFilterRole} />
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => handleSelect(a.id)}
              className={clsx(
                "block w-full rounded-md border bg-gradient-to-br p-2.5 text-left transition-colors",
                ROLE_ACCENT[a.org_role],
                selectedId === a.id && "ring-2 ring-[var(--color-accent)]/60",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{a.name}</div>
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  {ROLE_LABEL[a.org_role]}
                </span>
              </div>
              <div className="mt-0.5 line-clamp-1 text-[11px] text-[var(--color-fg-muted)]">
                {a.persona || "(no persona)"}
              </div>
              <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
                {PROVIDER_LABEL[a.provider]} · {a.skills.length} skills ·{" "}
                {savedIds.has(a.id) ? "ライブラリ" : "未保存ドラフト"}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-4 text-center text-xs text-[var(--color-fg-subtle)]">
              該当なし
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="overflow-y-auto p-4">
        {selected ? (
          <AgentEditor
            agent={selected}
            isSaved={savedIds.has(selected.id)}
            saveMessage={saveMessage}
            onChange={handleChange}
            onSave={() => void saveAgent(selected)}
            onRemove={() => void handleDelete()}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-[var(--color-fg-subtle)]">
            エージェントを選択
          </div>
        )}
      </div>
    </div>
  );
}

function RoleChip({
  role,
  current,
  setRole,
}: {
  role: OrgRole | "all";
  current: OrgRole | "all";
  setRole: (r: OrgRole | "all") => void;
}) {
  const active = role === current;
  const label = role === "all" ? "All" : ROLE_LABEL[role];
  return (
    <button
      onClick={() => setRole(role)}
      className={clsx(
        "rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
        active
          ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/15 text-[var(--color-fg)]"
          : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]",
      )}
    >
      {label}
    </button>
  );
}

function AgentEditor({
  agent,
  isSaved,
  saveMessage,
  onChange,
  onSave,
  onRemove,
}: {
  agent: AgentConfig;
  isSaved: boolean;
  saveMessage: string;
  onChange: (patch: Partial<AgentConfig>) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>基本情報</CardTitle>
            <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
              {isSaved ? "ライブラリ保存済み" : "未保存ドラフト（保存でライブラリに登録）"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={onSave}>
              <Save className="h-3.5 w-3.5" /> 保存
            </Button>
            <Button variant="danger" size="sm" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" /> 削除
            </Button>
          </div>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-3">
          {saveMessage && (
            <div className="col-span-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-200">
              {saveMessage}
            </div>
          )}
          <div>
            <Label>name</Label>
            <Input value={agent.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div>
            <Label>id</Label>
            <Input value={agent.id} disabled className="opacity-60" />
          </div>
          <div>
            <Label>org_role</Label>
            <Select
              value={agent.org_role}
              onChange={(e) => onChange({ org_role: e.target.value as OrgRole })}
            >
              {(Object.keys(ROLE_LABEL) as OrgRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>provider</Label>
            <Select
              value={agent.provider}
              onChange={(e) => onChange({ provider: e.target.value as ProviderKind })}
            >
              {(Object.keys(PROVIDER_LABEL) as ProviderKind[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>model</Label>
            <Input
              value={agent.model ?? ""}
              onChange={(e) => onChange({ model: e.target.value })}
            />
          </div>
          <div>
            <Label>model_decision</Label>
            <Select
              value={agent.model_decision ?? "ceo_decides"}
              onChange={(e) =>
                onChange({ model_decision: e.target.value as "fixed" | "ceo_decides" })
              }
            >
              <option value="fixed">fixed</option>
              <option value="ceo_decides">ceo_decides</option>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>パーソナリティ</Label>
            <Textarea
              value={agent.persona}
              placeholder="例: 初心者にもわかる言葉で説明する / 厳しめに品質を見る / 実装リスクを重視する"
              className="font-sans"
              onChange={(e) => onChange({ persona: e.target.value })}
              rows={3}
            />
          </div>
          {agent.provider === "custom_cli" && (
            <div className="col-span-2">
              <Label>command_template (custom_cli 必須)</Label>
              <Input
                placeholder="my-cli --prompt {prompt}"
                value={agent.command_template ?? ""}
                onChange={(e) => onChange({ command_template: e.target.value })}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スキル & 依存関係</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <ChipsEditor
            label="skills (max 20)"
            values={agent.skills}
            onChange={(skills) => onChange({ skills })}
            placeholder="スキル名 を入力して Enter"
          />
          <ChipsEditor
            label="depends_on (agent_id)"
            values={agent.depends_on}
            onChange={(depends_on) => onChange({ depends_on })}
            placeholder="依存先の agent_id"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MCP 連携</CardTitle>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={agent.mcp_enabled}
              onChange={(e) => onChange({ mcp_enabled: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            有効
          </label>
        </CardHeader>
        <CardBody
          className={clsx("grid grid-cols-2 gap-3", !agent.mcp_enabled && "opacity-50")}
        >
          <div>
            <Label>mcp_config_path</Label>
            <Input
              value={agent.mcp_config_path ?? ""}
              onChange={(e) => onChange({ mcp_config_path: e.target.value })}
            />
          </div>
          <div>
            <Label>mcp_timeout_sec</Label>
            <Input
              type="number"
              value={agent.mcp_timeout_sec}
              onChange={(e) => onChange({ mcp_timeout_sec: +e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <ChipsEditor
              label="mcp_servers"
              values={agent.mcp_servers}
              onChange={(mcp_servers) => onChange({ mcp_servers })}
              placeholder="server-name"
            />
          </div>
          <div className="col-span-2">
            <Label>mcp_instruction</Label>
            <Textarea
              value={agent.mcp_instruction}
              onChange={(e) => onChange({ mcp_instruction: e.target.value })}
              rows={3}
            />
          </div>
          <div className="col-span-2">
            <Label>mcp_context_command</Label>
            <Input
              value={agent.mcp_context_command ?? ""}
              onChange={(e) => onChange({ mcp_context_command: e.target.value })}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function ChipsEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-3)] px-2 py-0.5 text-xs"
          >
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-[var(--color-fg-muted)] hover:text-red-300"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="flex-1 min-w-32 bg-transparent text-xs outline-none placeholder:text-[var(--color-fg-subtle)]"
        />
      </div>
    </div>
  );
}
