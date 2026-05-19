import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Empty } from "../components/ui/Empty";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
import { ModelPicker } from "../components/ModelPicker";
import { useApp, builtinAgents } from "../state/store";
import { PROVIDER_LABEL, ROLE_ACCENT, ROLE_LABEL } from "../lib/format";
import type { AgentConfig, OrgRole, ProviderKind, Template } from "../types";
import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  CopyPlus,
  Plus,
  Save,
  Search,
  Trash2,
  UserMinus,
} from "lucide-react";

const ROLE_OPTIONS = Object.keys(ROLE_LABEL) as OrgRole[];
const uid = () => Math.random().toString(36).slice(2, 8);
type TeamTab = "builtin" | "custom";
type SortKey = "name_asc" | "name_desc" | "role" | "provider" | "type";

const timestampPrefix = () => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
};

export function TeamComposer() {
  const teamAgents = useApp((s) => s.request.agents);
  const savedAgents = useApp((s) => s.agents);
  const upsertAgent = useApp((s) => s.upsertAgent);
  const removeAgent = useApp((s) => s.removeAgent);
  const toggleAgentEnabled = useApp((s) => s.toggleAgentEnabled);
  const setAgents = useApp((s) => s.setAgents);
  const templates = useApp((s) => s.templates);
  const saveCurrentTeamTemplate = useApp((s) => s.saveCurrentTeamTemplate);
  const loadTeamTemplate = useApp((s) => s.loadTeamTemplate);
  const deleteTeamTemplate = useApp((s) => s.deleteTeamTemplate);

  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<OrgRole | "all">("all");
  const [filterProvider, setFilterProvider] = useState<ProviderKind | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("type");
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateStatus, setTemplateStatus] = useState("");
  const [teamTab, setTeamTab] = useState<TeamTab>("builtin");
  const [sourceTemplateId, setSourceTemplateId] = useState("");

  const enabledAgents = teamAgents.filter((agent) => agent.enabled !== false);
  const qaCount = enabledAgents.filter((agent) => agent.org_role === "qa").length;
  const warnings = getTeamWarnings(teamAgents);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const builtinTemplates = templates.filter((template) => template.locked || template.is_builtin);
  const customTemplates = templates.filter((template) => !template.locked && !template.is_builtin);
  const visibleTemplates = teamTab === "builtin" ? builtinTemplates : customTemplates;

  const candidatePool = useMemo(() => {
    const builtins = builtinAgents().map((agent) => ({ ...agent, is_custom: false }));
    const savedIds = new Set(savedAgents.map((agent) => agent.id));
    const builtinsNotShadowed = builtins.filter((agent) => !savedIds.has(agent.id));
    return [...builtinsNotShadowed, ...savedAgents];
  }, [savedAgents]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = candidatePool.filter((agent) => {
      if (filterRole !== "all" && agent.org_role !== filterRole) return false;
      if (filterProvider !== "all" && agent.provider !== filterProvider) return false;
      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.persona.toLowerCase().includes(q) ||
        agent.skills.join(",").toLowerCase().includes(q)
      );
    });
    const collator = new Intl.Collator("ja", { sensitivity: "base" });
    const sorted = filtered.slice();
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
          const aBuiltin = a.is_custom === false ? 1 : 0;
          const bBuiltin = b.is_custom === false ? 1 : 0;
          // user (custom) first, then built-in
          return aBuiltin - bBuiltin || collator.compare(a.name, b.name);
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [candidatePool, filterProvider, filterRole, query, sortKey]);

  const addCandidateToTeam = (agent: AgentConfig) => {
    upsertAgent({
      ...agent,
      id: `${agent.id}_team_${uid()}`,
      enabled: true,
      is_custom: true,
      depends_on: [],
    });
  };

  const saveTeam = async (mode: "update" | "copy" = "update") => {
    setTemplateStatus("");
    try {
      const saved = await saveCurrentTeamTemplate({
        id: mode === "update" ? selectedTemplateId || undefined : undefined,
        name: teamName,
        description: teamDescription,
      });
      setSelectedTemplateId(saved.id);
      setTeamName(saved.name);
      setTeamDescription(saved.description ?? "");
      setTeamTab("custom");
      setTemplateStatus(
        selectedTemplate?.locked && mode === "update"
          ? "組み込みテンプレートをユーザーチームとして複製しました。"
          : "チームを保存しました。",
      );
    } catch (error) {
      setTemplateStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const loadTeam = (templateId: string) => {
    loadTeamTemplate(templateId);
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (template) {
      setTeamName(template.name);
      setTeamDescription(template.description ?? "");
      setTemplateStatus("保存済みチームを読み込みました。");
    }
  };

  const startNewTeam = () => {
    setAgents([]);
    setSelectedTemplateId("");
    setTeamName("");
    setTeamDescription("");
    setTeamTab("custom");
    setTemplateStatus("新規チームを開始しました。候補からエージェントを追加してください。");
  };

  const deleteTeam = async () => {
    if (!selectedTemplateId) return;
    if (selectedTemplate?.locked) {
      setTemplateStatus("組み込みテンプレートは削除できません。");
      return;
    }
    setTemplateStatus("");
    try {
      await deleteTeamTemplate(selectedTemplateId);
      setSelectedTemplateId("");
      setTeamName("");
      setTeamDescription("");
      setTemplateStatus("保存済みチームを削除しました。");
    } catch (error) {
      setTemplateStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const startFromTemplate = () => {
    const template = templates.find((item) => item.id === sourceTemplateId);
    if (!template) {
      setTemplateStatus("呼び出すテンプレートを選択してください。");
      return;
    }
    loadTeamTemplate(template.id);
    setSelectedTemplateId("");
    setTeamName(`${timestampPrefix()}_${template.name}`);
    setTeamDescription(template.description ?? "");
    setTeamTab("custom");
    setTemplateStatus(
      `「${template.name}」をテンプレートとして呼び出しました。編集後、新しいチームとして保存できます。`,
    );
  };

  return (
    <div className="grid h-full grid-cols-[320px_minmax(420px,3fr)_minmax(320px,2fr)] gap-4 overflow-hidden p-4">
      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>チーム管理</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              保存済みチームを選び、必要なエージェントを追加します。
            </p>
          </div>
          <span className="text-[10px] text-[var(--color-fg-subtle)]">{templates.length} teams</span>
        </CardHeader>
        <CardBody className="flex-1 space-y-4 overflow-y-auto">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold">保存済みチーム</div>
              <Button variant="outline" size="sm" onClick={startNewTeam}>
                <Plus className="h-3.5 w-3.5" />
                新規
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
              <TeamTabButton
                active={teamTab === "builtin"}
                label="Built-in"
                count={builtinTemplates.length}
                onClick={() => setTeamTab("builtin")}
              />
              <TeamTabButton
                active={teamTab === "custom"}
                label="Custom"
                count={customTemplates.length}
                onClick={() => setTeamTab("custom")}
              />
            </div>
            {visibleTemplates.length === 0 && (
              <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-xs leading-relaxed text-[var(--color-fg-subtle)]">
                {teamTab === "builtin"
                  ? "組み込みテンプレートがありません。"
                  : "カスタムチームはまだありません。中央で編成し、右側で保存してください。"}
              </div>
            )}
            {visibleTemplates.map((template) => (
              <TeamTemplateCard
                key={template.id}
                template={template}
                selected={template.id === selectedTemplateId}
                onLoad={() => loadTeam(template.id)}
                onDelete={() => {
                  if (template.locked) return;
                  setSelectedTemplateId(template.id);
                  void deleteTeamTemplate(template.id);
                  if (template.id === selectedTemplateId) {
                    setSelectedTemplateId("");
                    setTeamName("");
                    setTeamDescription("");
                  }
                }}
              />
            ))}
          </section>

          <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <div>
              <div className="text-xs font-semibold">エージェント候補</div>
              <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                Agent Studio に保存したエージェントを選択中チームへ追加します。
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-muted)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="名前・ペルソナ・スキルで検索"
                className="pl-7"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="mb-0">role</Label>
              <div className="flex flex-wrap gap-1">
                <TCChip
                  active={filterRole === "all"}
                  label="All"
                  onClick={() => setFilterRole("all")}
                />
                {ROLE_OPTIONS.map((role) => (
                  <TCChip
                    key={role}
                    active={filterRole === role}
                    label={ROLE_LABEL[role]}
                    onClick={() => setFilterRole(role)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="mb-0">provider</Label>
              <div className="flex flex-wrap gap-1">
                <TCChip
                  active={filterProvider === "all"}
                  label="All"
                  onClick={() => setFilterProvider("all")}
                />
                {(Object.keys(PROVIDER_LABEL) as ProviderKind[]).map((provider) => (
                  <TCChip
                    key={provider}
                    active={filterProvider === provider}
                    label={PROVIDER_LABEL[provider]}
                    onClick={() => setFilterProvider(provider)}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>並び替え</Label>
              <Select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                <option value="type">種別（Custom → Built-in）</option>
                <option value="name_asc">名前 (昇順)</option>
                <option value="name_desc">名前 (降順)</option>
                <option value="role">role</option>
                <option value="provider">provider</option>
              </Select>
            </div>
            <div className="space-y-2">
              {candidates.length === 0 && (
                <Empty
                  dense
                  title="候補がありません"
                  description="検索キーワード・フィルタを見直すか、Agent Studio で保存してください。"
                />
              )}
              {candidates.map((agent) => (
                <CandidateCard key={agent.id} agent={agent} onAdd={() => addCandidateToTeam(agent)} />
              ))}
            </div>
          </section>
        </CardBody>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>現在のチーム編成</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              {selectedTemplate ? selectedTemplate.name : "未保存の新規チーム"} を編集しています。
            </p>
          </div>
          <span className="text-[10px] text-[var(--color-fg-subtle)]">
            {enabledAgents.length}/{teamAgents.length} enabled
          </span>
        </CardHeader>
        <CardBody className="flex-1 space-y-3 overflow-y-auto">
          {teamAgents.length === 0 && (
            <div className="rounded-md border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-fg-subtle)]">
              チームが空です。左から候補を追加してください。
            </div>
          )}
          {teamAgents.map((agent, index) => (
            <TeamAgentRow
              key={agent.id}
              agent={agent}
              index={index}
              allAgents={teamAgents}
              onToggle={() => toggleAgentEnabled(agent.id)}
              onUpdate={(patch) => upsertAgent({ ...agent, ...patch })}
              onRemove={() => removeAgent(agent.id)}
            />
          ))}
        </CardBody>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>編成チェック</CardTitle>
          {warnings.length === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-300" />
          )}
        </CardHeader>
        <CardBody className="space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="有効" value={`${enabledAgents.length}`} />
            <Kpi label="QA" value={`${qaCount}`} />
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold">ロール内訳</div>
            <div className="space-y-1">
              {ROLE_OPTIONS.map((role) => {
                const count = enabledAgents.filter((agent) => agent.org_role === role).length;
                if (count === 0) return null;
                return (
                  <div
                    key={role}
                    className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs"
                  >
                    <span>{ROLE_LABEL[role]}</span>
                    <span className="text-[var(--color-fg-muted)]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold">警告</div>
            {warnings.length === 0 ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                現在の編成に大きな問題はありません。
              </div>
            ) : (
              <div className="space-y-2">
                {warnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-[var(--color-border)] pt-4">
            <div className="mb-2 text-xs font-semibold">チーム保存</div>
            <div className="space-y-2">
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="mb-2 text-xs font-semibold">テンプレートから開始</div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Select
                    value={sourceTemplateId}
                    onChange={(event) => setSourceTemplateId(event.target.value)}
                  >
                    <option value="">呼び出すチームを選択</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.locked ? "Built-in" : "Custom"} · {template.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!sourceTemplateId}
                    onClick={startFromTemplate}
                  >
                    <CopyPlus className="h-4 w-4" />
                    呼び出し
                  </Button>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-fg-subtle)]">
                  選択したチームの構成をコピーし、日時プレフィックス付きの新規チーム名で編集を開始します。
                </p>
              </div>
              {selectedTemplate && (
                <div className="rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-2 text-xs text-[var(--color-fg-muted)]">
                  選択中: <span className="font-semibold text-[var(--color-fg)]">{selectedTemplate.name}</span>
                </div>
              )}
              <div>
                <Label>team name</Label>
                <Input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="例: ローカルLLM開発チーム"
                />
              </div>
              <div>
                <Label>description</Label>
                <Textarea
                  rows={2}
                  value={teamDescription}
                  onChange={(event) => setTeamDescription(event.target.value)}
                  placeholder="用途や前提を短くメモ"
                  className="min-h-16 font-sans"
                />
              </div>
              <Button className="w-full" onClick={() => void saveTeam("update")}>
                <Save className="h-4 w-4" />
                {selectedTemplate?.locked
                  ? "組み込みを複製して保存"
                  : selectedTemplateId
                    ? "選択中チームを更新"
                    : "新しいチームとして保存"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => void saveTeam("copy")}>
                  <CopyPlus className="h-4 w-4" />
                  別名保存
                </Button>
                <Button
                  variant="danger"
                  disabled={!selectedTemplateId || selectedTemplate?.locked}
                  onClick={() => void deleteTeam()}
                >
                  <Trash2 className="h-4 w-4" />
                  削除
                </Button>
              </div>
              {templateStatus && (
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-xs text-[var(--color-fg-muted)]">
                  {templateStatus}
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function TeamTemplateCard({
  template,
  selected,
  onLoad,
  onDelete,
}: {
  template: Template;
  selected: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const enabledCount = template.agents.filter((agent) => agent.enabled !== false).length;
  return (
    <button
      type="button"
      onClick={onLoad}
      className={clsx(
        "w-full rounded-md border bg-[var(--color-surface-2)] p-3 text-left transition-colors hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-surface-3)]",
        selected ? "border-[var(--color-accent)] shadow-sm shadow-[var(--color-accent)]/10" : "border-[var(--color-border)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-sm font-semibold">{template.name}</div>
            {template.locked && (
              <span className="shrink-0 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[var(--color-accent)]">
                Built-in
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
            {enabledCount}/{template.agents.length} enabled · {template.orchestration_mode ?? "current"}
          </div>
        </div>
        {!template.locked && (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onDelete();
              }
            }}
            className="rounded p-1 text-[var(--color-fg-muted)] hover:bg-red-500/20 hover:text-red-300"
            title="チームを削除"
          >
            <Trash2 className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--color-fg-muted)]">
        {template.description || "説明なし"}
      </div>
    </button>
  );
}

function TCChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-full border px-2.5 py-0.5 font-medium tracking-wider transition-colors",
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

function TeamTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors",
        active
          ? "bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/20"
          : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-fg)]",
      )}
    >
      <span className="font-semibold">{label}</span>
      <span
        className={clsx(
          "rounded-full px-1.5 py-0.5 text-[10px]",
          active ? "bg-white/15 text-white" : "bg-[var(--color-surface-3)] text-[var(--color-fg-subtle)]",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CandidateCard({ agent, onAdd }: { agent: AgentConfig; onAdd: () => void }) {
  const isBuiltin = agent.is_custom === false;
  return (
    <div className={clsx("rounded-md border bg-gradient-to-br p-3", ROLE_ACCENT[agent.org_role])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-sm font-semibold">{agent.name}</div>
            {isBuiltin && (
              <span className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-[1px] text-[9px] uppercase tracking-widest text-[var(--color-fg-muted)]">
                Built-in
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
            {ROLE_LABEL[agent.org_role]} · {PROVIDER_LABEL[agent.provider]}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <CopyPlus className="h-3.5 w-3.5" />
          追加
        </Button>
      </div>
      <div className="mt-2 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
        {agent.persona || "(personaなし)"}
      </div>
    </div>
  );
}

function TeamAgentRow({
  agent,
  index,
  allAgents,
  onToggle,
  onUpdate,
  onRemove,
}: {
  agent: AgentConfig;
  index: number;
  allAgents: AgentConfig[];
  onToggle: () => void;
  onUpdate: (patch: Partial<AgentConfig>) => void;
  onRemove: () => void;
}) {
  const enabled = agent.enabled !== false;
  return (
    <div
      className={clsx(
        "rounded-lg border bg-gradient-to-br p-3 transition-opacity",
        ROLE_ACCENT[agent.org_role],
        !enabled && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        <span className="w-8 text-xs tabular-nums text-[var(--color-fg-subtle)]">#{index + 1}</span>
        <Input
          value={agent.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          className="flex-1"
        />
        <button
          onClick={onRemove}
          className="rounded p-1.5 text-[var(--color-fg-muted)] hover:bg-amber-500/20 hover:text-amber-300"
          title="チームから外す（ライブラリは残ります）"
        >
          <UserMinus className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <div>
          <Label>role</Label>
          <Select
            value={agent.org_role}
            onChange={(event) => onUpdate({ org_role: event.target.value as OrgRole })}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>provider</Label>
          <Select
            value={agent.provider}
            onChange={(event) =>
              onUpdate({ provider: event.target.value as ProviderKind, model: null })
            }
          >
            {(Object.keys(PROVIDER_LABEL) as ProviderKind[]).map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABEL[provider]}
              </option>
            ))}
          </Select>
        </div>
        <ModelPicker
          provider={agent.provider}
          value={agent.model}
          placeholder="gpt-5 / qwen2.5-coder-3b-instruct / qwen3:8b"
          onChange={(model) => onUpdate({ model })}
        />
        <div>
          <Label>decision</Label>
          <Select
            value={agent.model_decision ?? "ceo_decides"}
            onChange={(event) =>
              onUpdate({ model_decision: event.target.value as "fixed" | "ceo_decides" })
            }
          >
            <option value="fixed">fixed</option>
            <option value="ceo_decides">ceo_decides</option>
          </Select>
        </div>
      </div>
      <div className="mt-2">
        <Label>パーソナリティ</Label>
        <Textarea
          rows={3}
          value={agent.persona}
          placeholder="例: 初心者にもわかる言葉で説明する / 厳しめに品質を見る / 実装リスクを重視する"
          className="font-sans"
          onChange={(event) => onUpdate({ persona: event.target.value })}
        />
      </div>
      {(agent.provider === "custom_cli" || agent.provider === "android_cli") && (
        <div className="mt-2">
          <Label>
            command_template {agent.provider === "android_cli" ? "(Android CLI の上書き)" : ""}
          </Label>
          <Input
            value={agent.command_template ?? ""}
            placeholder={agent.provider === "android_cli" ? "android-cli {prompt}" : "my-cli --prompt {prompt}"}
            onChange={(event) => onUpdate({ command_template: event.target.value })}
          />
        </div>
      )}
      <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">Research / ネット検索</div>
            <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
              このエージェントだけに検索許可と必須参照サイトを設定します。
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={agent.allow_web_search}
              onChange={(event) => onUpdate({ allow_web_search: event.target.checked })}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            許可
          </label>
        </div>
        <div className={clsx("grid gap-2 md:grid-cols-2", !agent.allow_web_search && "opacity-50")}>
          <div>
            <Label>max_search_results</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={agent.max_search_results}
              onChange={(event) => onUpdate({ max_search_results: +event.target.value })}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-xs">
            <input
              type="checkbox"
              checked={agent.require_citations}
              onChange={(event) => onUpdate({ require_citations: event.target.checked })}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            参照URLを残す
          </label>
          <div className="md:col-span-2">
            <Label>必ず確認する技術サイト</Label>
            <Textarea
              rows={3}
              value={agent.research_sources.join("\n")}
              placeholder="https://developer.apple.com/documentation/swiftui"
              className="font-mono"
              onChange={(event) =>
                onUpdate({
                  research_sources: event.target.value
                    .split(/\r?\n|,/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      </div>
      <div className="mt-2">
        <Label>depends_on</Label>
        <Select
          value=""
          onChange={(event) => {
            const next = event.target.value;
            if (next && !agent.depends_on.includes(next)) {
              onUpdate({ depends_on: [...agent.depends_on, next] });
            }
          }}
        >
          <option value="">依存先を追加</option>
          {allAgents
            .filter((candidate) => candidate.id !== agent.id)
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
        </Select>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {agent.depends_on.length === 0 && (
            <span className="text-xs text-[var(--color-fg-subtle)]">依存なし</span>
          )}
          {agent.depends_on.map((dependency) => (
            <button
              key={dependency}
              type="button"
              onClick={() =>
                onUpdate({ depends_on: agent.depends_on.filter((item) => item !== dependency) })
              }
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-fg-muted)] hover:border-red-500/40 hover:text-red-300"
              title="クリックで削除"
            >
              {allAgents.find((candidate) => candidate.id === dependency)?.name ?? dependency} ×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function getTeamWarnings(agents: AgentConfig[]): string[] {
  const enabled = agents.filter((agent) => agent.enabled !== false);
  const ids = new Set(agents.map((agent) => agent.id));
  const warnings: string[] = [];

  if (enabled.length === 0) warnings.push("有効なエージェントがありません。");

  const qaCount = enabled.filter((agent) => agent.org_role === "qa").length;
  if (qaCount < 3) warnings.push(`QA が ${qaCount} 名です。既定では 3 名以上を推奨します。`);

  for (const agent of enabled) {
    if (agent.provider === "custom_cli" && !agent.command_template?.trim()) {
      warnings.push(`${agent.name}: custom_cli ですが command_template が空です。`);
    }
    for (const dependency of agent.depends_on) {
      if (!ids.has(dependency)) {
        warnings.push(`${agent.name}: 存在しない依存先 ${dependency} があります。`);
      }
    }
  }

  return warnings;
}
