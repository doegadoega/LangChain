import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Empty } from "../components/ui/Empty";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
import { ModelPicker } from "../components/ModelPicker";
import { builtinAgents, newAgent, useApp } from "../state/store";
import { PROVIDER_LABEL, ROLE_ACCENT, ROLE_LABEL } from "../lib/format";
import { api } from "../api/client";
import type {
  AgentConfig,
  OrgRole,
  ProviderKind,
  SkillDocument,
  SkillReference,
  SkillVersionRequirement,
} from "../types";
import clsx from "clsx";
import { AlertTriangle, CopyPlus, Plus, Save, Search, Trash2, X } from "lucide-react";

type SortKey = "name_asc" | "name_desc" | "role" | "provider" | "type";

export function AgentStudio() {
  const savedAgents = useApp((s) => s.agents);
  const deleteSavedAgent = useApp((s) => s.deleteSavedAgent);
  const loadAll = useApp((s) => s.loadAll);

  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<OrgRole | "all">("all");
  const [filterProvider, setFilterProvider] = useState<ProviderKind | "all">("all");
  const [filterType, setFilterType] = useState<"all" | "draft" | "saved" | "builtin">("all");
  const [sortKey, setSortKey] = useState<SortKey>("type");
  const [draft, setDraft] = useState<AgentConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(savedAgents[0]?.id ?? null);
  const [editing, setEditing] = useState<AgentConfig | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [installedSkills, setInstalledSkills] = useState<SkillDocument[]>([]);

  useEffect(() => {
    api
      .listSkills()
      .then(setInstalledSkills)
      .catch(() => setInstalledSkills([]));
  }, []);

  const savedIds = useMemo(() => new Set(savedAgents.map((agent) => agent.id)), [savedAgents]);
  const builtins = useMemo(() => builtinAgents(), []);
  const builtinIds = useMemo(() => new Set(builtins.map((agent) => agent.id)), [builtins]);
  const builtinsNotShadowed = useMemo(
    () => builtins.filter((agent) => !savedIds.has(agent.id)),
    [builtins, savedIds],
  );
  const isBuiltin = useCallback(
    (id: string) => builtinIds.has(id) && !savedIds.has(id),
    [builtinIds, savedIds],
  );
  const listAgents = useMemo<AgentConfig[]>(
    () => [...(draft ? [draft] : []), ...savedAgents, ...builtinsNotShadowed],
    [draft, savedAgents, builtinsNotShadowed],
  );

  const filtered = useMemo(() => {
    const filteredList = listAgents.filter((a) => {
      if (filterRole !== "all" && a.org_role !== filterRole) return false;
      if (filterProvider !== "all" && a.provider !== filterProvider) return false;
      if (filterType !== "all") {
        const isAgentBuiltin = isBuiltin(a.id);
        const isAgentDraft = !!draft && a.id === draft.id;
        const isAgentSaved = savedIds.has(a.id);
        if (filterType === "builtin" && !isAgentBuiltin) return false;
        if (filterType === "draft" && !isAgentDraft) return false;
        if (filterType === "saved" && !isAgentSaved) return false;
      }
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.persona.toLowerCase().includes(q) ||
        a.skills.join(",").toLowerCase().includes(q)
      );
    });
    const collator = new Intl.Collator("ja", { sensitivity: "base" });
    const sorted = filteredList.slice();
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name_asc":
          return collator.compare(a.name, b.name);
        case "name_desc":
          return collator.compare(b.name, a.name);
        case "role":
          return (
            collator.compare(a.org_role, b.org_role) ||
            collator.compare(a.name, b.name)
          );
        case "provider":
          return (
            collator.compare(a.provider, b.provider) ||
            collator.compare(a.name, b.name)
          );
        case "type": {
          const aBuiltin = isBuiltin(a.id) ? 1 : 0;
          const bBuiltin = isBuiltin(b.id) ? 1 : 0;
          return aBuiltin - bBuiltin || collator.compare(a.name, b.name);
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [listAgents, query, filterRole, filterProvider, filterType, sortKey, isBuiltin, draft, savedIds]);

  const availableProviders = useMemo(
    () => Array.from(new Set(listAgents.map((a) => a.provider))) as ProviderKind[],
    [listAgents],
  );

  const sourceForId = (id: string | null): AgentConfig | undefined => {
    if (!id) return undefined;
    if (draft && draft.id === id) return draft;
    const saved = savedAgents.find((a) => a.id === id);
    if (saved) return saved;
    return builtins.find((a) => a.id === id);
  };

  const baseSelected = sourceForId(selectedId) ?? filtered[0];
  const selected: AgentConfig | undefined =
    editing && baseSelected && editing.id === baseSelected.id ? editing : baseSelected;
  const isDraft = !!(selected && draft && selected.id === draft.id);
  const isSelectedBuiltin = !!selected && isBuiltin(selected.id);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setEditing(null);
    setSaveMessage("");
  };

  const handleChange = (patch: Partial<AgentConfig>) => {
    if (!selected) return;
    if (isSelectedBuiltin) return;
    const next = { ...selected, ...patch };
    if (isDraft) {
      setDraft(next);
    } else {
      setEditing(next);
    }
  };

  const handleCloneFromBuiltin = () => {
    if (!selected) return;
    const copy: AgentConfig = {
      ...selected,
      id: `${selected.id}_user_${Math.random().toString(36).slice(2, 8)}`,
      name: `${selected.name} (コピー)`,
      is_custom: true,
    };
    setDraft(copy);
    setSelectedId(copy.id);
    setEditing(null);
    setSaveMessage("Built-in をコピーしました。編集して保存してください。");
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
          <div className="flex flex-wrap gap-1">
            <TypeChip value="all" label="種別: 全て" current={filterType} setValue={setFilterType} />
            <TypeChip value="draft" label="ドラフト" current={filterType} setValue={setFilterType} />
            <TypeChip value="saved" label="保存済み" current={filterType} setValue={setFilterType} />
            <TypeChip value="builtin" label="Built-in" current={filterType} setValue={setFilterType} />
          </div>
          {availableProviders.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <ProviderChip
                value="all"
                label="provider: 全て"
                current={filterProvider}
                setValue={setFilterProvider}
              />
              {availableProviders.map((p) => (
                <ProviderChip
                  key={p}
                  value={p}
                  label={PROVIDER_LABEL[p] ?? p}
                  current={filterProvider}
                  setValue={setFilterProvider}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label className="mb-0 shrink-0">並び替え</Label>
            <Select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="text-xs"
            >
              <option value="type">種別（Custom → Built-in）</option>
              <option value="name_asc">名前 (昇順)</option>
              <option value="name_desc">名前 (降順)</option>
              <option value="role">role</option>
              <option value="provider">provider</option>
            </Select>
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
                <div className="flex min-w-0 items-center gap-1.5">
                  <div className="truncate text-sm font-semibold">{a.name}</div>
                  {isBuiltin(a.id) && (
                    <span className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-[1px] text-[9px] uppercase tracking-widest text-[var(--color-fg-muted)]">
                      Built-in
                    </span>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
                  {ROLE_LABEL[a.org_role]}
                </span>
              </div>
              <div className="mt-0.5 line-clamp-1 text-[11px] text-[var(--color-fg-muted)]">
                {a.persona || "(no persona)"}
              </div>
              <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
                {PROVIDER_LABEL[a.provider]} · {a.skills.length} skills ·{" "}
                {isBuiltin(a.id)
                  ? "Built-in"
                  : savedIds.has(a.id)
                    ? "ライブラリ"
                    : "未保存ドラフト"}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <Empty
              dense
              title="該当するエージェントがありません"
              description="検索ワードかフィルタを変更してください。"
            />
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="overflow-y-auto p-4">
        {selected ? (
          <AgentEditor
            agent={selected}
            isSaved={savedIds.has(selected.id)}
            isBuiltin={isSelectedBuiltin}
            saveMessage={saveMessage}
            installedSkills={installedSkills}
            onChange={handleChange}
            onSave={() => void saveAgent(selected)}
            onRemove={() => void handleDelete()}
            onClone={handleCloneFromBuiltin}
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
  return <Chip active={active} onClick={() => setRole(role)} label={label} />;
}

function TypeChip({
  value,
  label,
  current,
  setValue,
}: {
  value: "all" | "draft" | "saved" | "builtin";
  label: string;
  current: "all" | "draft" | "saved" | "builtin";
  setValue: (v: "all" | "draft" | "saved" | "builtin") => void;
}) {
  return <Chip active={value === current} onClick={() => setValue(value)} label={label} />;
}

function ProviderChip({
  value,
  label,
  current,
  setValue,
}: {
  value: ProviderKind | "all";
  label: string;
  current: ProviderKind | "all";
  setValue: (v: ProviderKind | "all") => void;
}) {
  return <Chip active={value === current} onClick={() => setValue(value)} label={label} />;
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-full border px-2.5 py-0.5 font-medium uppercase tracking-wider transition-colors",
        active
          ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/15 text-[var(--color-fg)]"
          : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]",
      )}
      style={{ fontSize: "var(--text-xs)" }}
    >
      {label}
    </button>
  );
}

function AgentEditor({
  agent,
  isSaved,
  isBuiltin,
  saveMessage,
  installedSkills,
  onChange,
  onSave,
  onRemove,
  onClone,
}: {
  agent: AgentConfig;
  isSaved: boolean;
  isBuiltin: boolean;
  saveMessage: string;
  installedSkills: SkillDocument[];
  onChange: (patch: Partial<AgentConfig>) => void;
  onSave: () => void;
  onRemove: () => void;
  onClone: () => void;
}) {
  const status = isBuiltin
    ? "Built-in（読み取り専用 / コピーして編集できます）"
    : isSaved
      ? "ライブラリ保存済み"
      : "未保存ドラフト（保存でライブラリに登録）";

  return (
    <div className={clsx("space-y-4", isBuiltin && "pointer-events-none opacity-90")}>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>基本情報</CardTitle>
            <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
              {status}
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            {isBuiltin ? (
              <Button variant="primary" size="sm" onClick={onClone}>
                <CopyPlus className="h-3.5 w-3.5" /> コピーして編集
              </Button>
            ) : (
              <>
                <Button variant="primary" size="sm" onClick={onSave}>
                  <Save className="h-3.5 w-3.5" /> 保存
                </Button>
                <Button variant="danger" size="sm" onClick={onRemove}>
                  <Trash2 className="h-3.5 w-3.5" /> 削除
                </Button>
              </>
            )}
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
              onChange={(e) => onChange({ provider: e.target.value as ProviderKind, model: null })}
            >
              {(Object.keys(PROVIDER_LABEL) as ProviderKind[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>
          <ModelPicker
            provider={agent.provider}
            value={agent.model}
            placeholder="例: qwen2.5-coder-3b-instruct / qwen3:8b"
            onChange={(model) => onChange({ model })}
          />
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
          {(agent.provider === "custom_cli" || agent.provider === "android_cli") && (
            <div className="col-span-2">
              <Label>
                command_template {agent.provider === "custom_cli" ? "(custom_cli 必須)" : "(Android CLI の上書き)"}
              </Label>
              <Input
                placeholder={agent.provider === "android_cli" ? "android-cli {prompt}" : "my-cli --prompt {prompt}"}
                value={agent.command_template ?? ""}
                onChange={(e) => onChange({ command_template: e.target.value })}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>タグ & 依存関係</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <ChipsEditor
            label="skill tags (prompt注入なし)"
            values={agent.skills}
            onChange={(skills) => onChange({ skills })}
            placeholder="検索・分類用タグを入力して Enter"
          />
          <ChipsEditor
            label="depends_on (agent_id)"
            values={agent.depends_on}
            onChange={(depends_on) => onChange({ depends_on })}
            placeholder="依存先の agent_id"
          />
        </CardBody>
      </Card>

      <SkillRefsSection
        agent={agent}
        installedSkills={installedSkills}
        onChange={(skill_refs) => onChange({ skill_refs })}
      />

      <Card>
        <CardHeader>
          <CardTitle>Research / ネット検索</CardTitle>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={agent.allow_web_search}
              onChange={(e) => onChange({ allow_web_search: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            ネット検索を許可
          </label>
        </CardHeader>
        <CardBody
          className={clsx("grid grid-cols-2 gap-3", !agent.allow_web_search && "opacity-50")}
        >
          <div>
            <Label>max_search_results</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={agent.max_search_results}
              onChange={(e) => onChange({ max_search_results: +e.target.value })}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-xs">
            <input
              type="checkbox"
              checked={agent.require_citations}
              onChange={(e) => onChange({ require_citations: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            回答に参照URLを残す
          </label>
          <div className="col-span-2">
            <ChipsEditor
              label="必ず確認する技術サイト / source URL"
              values={agent.research_sources}
              onChange={(research_sources) => onChange({ research_sources })}
              placeholder="https://developer.apple.com/documentation/swiftui"
            />
          </div>
          <div className="col-span-2 text-xs leading-relaxed text-[var(--color-fg-subtle)]">
            OFF のエージェントには検索許可と登録ソースをプロンプトへ渡しません。ON の場合は登録ソースを優先し、回答時に参照URLを残すよう指示します。
          </div>
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

function SkillRefsSection({
  agent,
  installedSkills,
  onChange,
}: {
  agent: AgentConfig;
  installedSkills: SkillDocument[];
  onChange: (refs: SkillReference[]) => void;
}) {
  const refs = agent.skill_refs ?? [];

  const installedById = useMemo(() => {
    const map = new Map<string, SkillDocument[]>();
    for (const doc of installedSkills) {
      const list = map.get(doc.metadata.id) ?? [];
      list.push(doc);
      map.set(doc.metadata.id, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => b.metadata.version.localeCompare(a.metadata.version));
    }
    return map;
  }, [installedSkills]);

  const availableToAdd = useMemo(() => {
    const usedIds = new Set(refs.map((ref) => ref.id));
    return Array.from(installedById.keys()).filter((id) => !usedIds.has(id));
  }, [installedById, refs]);

  const addRef = (id: string) => {
    if (!id) return;
    const next: SkillReference[] = [
      ...refs,
      {
        id,
        source: "user",
        version_requirement: { kind: "latest" },
        enabled: true,
      },
    ];
    onChange(next);
  };

  const updateRef = (index: number, patch: Partial<SkillReference>) => {
    const next = refs.map((ref, i) => (i === index ? { ...ref, ...patch } : ref));
    onChange(next);
  };

  const removeRef = (index: number) => {
    onChange(refs.filter((_, i) => i !== index));
  };

  const updateVersion = (index: number, requirement: SkillVersionRequirement) => {
    updateRef(index, { version_requirement: requirement });
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>このエージェントに持たせるスキル</CardTitle>
          <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
            スキル管理で登録した SKILL.md をこのエージェントへ紐づけます。実行時に system prompt へ注入されます。
          </div>
        </div>
        <div className="pointer-events-auto">
          <Select
            value=""
            onChange={(event) => {
              addRef(event.target.value);
              event.target.value = "";
            }}
            disabled={availableToAdd.length === 0}
            className="text-xs"
          >
            <option value="">
              {availableToAdd.length === 0
                ? installedSkills.length === 0
                  ? "スキル管理が空です"
                  : "全て追加済み"
                : "+ 持たせるスキルを追加"}
            </option>
            {availableToAdd.map((id) => {
              const doc = installedById.get(id)?.[0];
              return (
                <option key={id} value={id}>
                  {doc?.metadata.name ?? id}
                </option>
              );
            })}
          </Select>
        </div>
      </CardHeader>
      <CardBody className="space-y-2 text-xs">
        {refs.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-center text-[11px] text-[var(--color-fg-subtle)]">
            このエージェントに持たせるスキルはまだありません。
          </div>
        )}
        {refs.map((ref, index) => {
          const versions = installedById.get(ref.id) ?? [];
          const latest = versions[0];
          const warning = computeSkillWarning(latest, agent);
          return (
            <div
              key={`${ref.id}-${index}`}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {latest?.metadata.name ?? ref.id}
                  </span>
                  {warning && (
                    <span
                      title={warning}
                      className="flex items-center gap-0.5 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1 py-[1px] text-[9px] uppercase tracking-widest text-amber-300"
                    >
                      <AlertTriangle className="h-3 w-3" /> mismatch
                    </span>
                  )}
                  {!latest && (
                    <span className="rounded-sm border border-red-500/40 bg-red-500/10 px-1 py-[1px] text-[9px] uppercase tracking-widest text-red-300">
                      未登録
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[10px]">
                    <input
                      type="checkbox"
                      checked={ref.enabled}
                      onChange={(event) =>
                        updateRef(index, { enabled: event.target.checked })
                      }
                      className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                    />
                    enabled
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => removeRef(index)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">version 要求</Label>
                  <Select
                    value={ref.version_requirement.kind}
                    onChange={(event) =>
                      updateVersion(index, {
                        kind: event.target.value as SkillVersionRequirement["kind"],
                        version:
                          event.target.value === "exact"
                            ? ref.version_requirement.version ?? latest?.metadata.version ?? ""
                            : null,
                      })
                    }
                    className="text-xs"
                  >
                    <option value="latest">latest</option>
                    <option value="latest_compatible">latest_compatible</option>
                    <option value="exact">exact</option>
                  </Select>
                </div>
                {ref.version_requirement.kind === "exact" && (
                  <div>
                    <Label className="text-[10px]">version</Label>
                    <Select
                      value={ref.version_requirement.version ?? ""}
                      onChange={(event) =>
                        updateVersion(index, {
                          kind: "exact",
                          version: event.target.value,
                        })
                      }
                      className="text-xs"
                    >
                      <option value="">選択</option>
                      {versions.map((doc) => (
                        <option key={doc.metadata.version} value={doc.metadata.version}>
                          v{doc.metadata.version}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
              {warning && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-1.5 text-[10px] text-amber-200">
                  {warning}
                </div>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function computeSkillWarning(doc: SkillDocument | undefined, agent: AgentConfig): string | null {
  if (!doc) return null;
  const providers = doc.metadata.providers ?? [];
  const roles = doc.metadata.roles ?? [];
  const issues: string[] = [];
  if (providers.length > 0 && !providers.includes(agent.provider)) {
    issues.push(`provider ${agent.provider} 非対応 (対応: ${providers.join(", ")})`);
  }
  if (roles.length > 0 && !roles.includes(agent.org_role)) {
    issues.push(`role ${agent.org_role} 非対応 (対応: ${roles.join(", ")})`);
  }
  return issues.length > 0 ? issues.join(" / ") : null;
}
