import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
import { newAgent, useApp } from "../state/store";
import { PROVIDER_LABEL, ROLE_ACCENT, ROLE_LABEL } from "../lib/format";
import type { AgentConfig, OrgRole, ProviderKind } from "../types";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, CopyPlus, Plus, Search, UserMinus } from "lucide-react";

const ROLE_OPTIONS = Object.keys(ROLE_LABEL) as OrgRole[];
const uid = () => Math.random().toString(36).slice(2, 8);

export function TeamComposer() {
  const teamAgents = useApp((s) => s.request.agents);
  const savedAgents = useApp((s) => s.agents);
  const upsertAgent = useApp((s) => s.upsertAgent);
  const removeAgent = useApp((s) => s.removeAgent);
  const toggleAgentEnabled = useApp((s) => s.toggleAgentEnabled);

  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<OrgRole | "all">("all");
  const [filterProvider, setFilterProvider] = useState<ProviderKind | "all">("all");

  const enabledAgents = teamAgents.filter((agent) => agent.enabled !== false);
  const qaCount = enabledAgents.filter((agent) => agent.org_role === "qa").length;
  const warnings = getTeamWarnings(teamAgents);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return savedAgents.filter((agent) => {
      if (filterRole !== "all" && agent.org_role !== filterRole) return false;
      if (filterProvider !== "all" && agent.provider !== filterProvider) return false;
      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.persona.toLowerCase().includes(q) ||
        agent.skills.join(",").toLowerCase().includes(q)
      );
    });
  }, [filterProvider, filterRole, query, savedAgents]);

  const addCandidateToTeam = (agent: AgentConfig) => {
    upsertAgent({
      ...agent,
      id: `${agent.id}_team_${uid()}`,
      enabled: true,
      is_custom: true,
      depends_on: [],
    });
  };

  return (
    <div className="grid h-full grid-cols-[320px_minmax(420px,1fr)_320px] gap-4 overflow-hidden p-4">
      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>エージェント候補</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              保存済みエージェントをチームへ追加します。
            </p>
          </div>
        </CardHeader>
        <CardBody className="flex-1 space-y-3 overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-muted)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="名前・ペルソナ・スキルで検索"
              className="pl-7"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>role</Label>
              <Select
                value={filterRole}
                onChange={(event) => setFilterRole(event.target.value as OrgRole | "all")}
              >
                <option value="all">All</option>
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
                value={filterProvider}
                onChange={(event) => setFilterProvider(event.target.value as ProviderKind | "all")}
              >
                <option value="all">All</option>
                {(Object.keys(PROVIDER_LABEL) as ProviderKind[]).map((provider) => (
                  <option key={provider} value={provider}>
                    {PROVIDER_LABEL[provider]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => upsertAgent(newAgent("worker"))}>
            <Plus className="h-4 w-4" />
            空のエージェントを追加
          </Button>
          <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
            {candidates.length === 0 && (
              <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-fg-subtle)]">
                保存済み候補がありません。Agent Studio で保存してください。
              </div>
            )}
            {candidates.map((agent) => (
              <CandidateCard key={agent.id} agent={agent} onAdd={() => addCandidateToTeam(agent)} />
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="flex min-w-0 flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>現在のチーム編成</CardTitle>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              実行に参加するエージェントを柔軟に編集します。
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
        </CardBody>
      </Card>
    </div>
  );
}

function CandidateCard({ agent, onAdd }: { agent: AgentConfig; onAdd: () => void }) {
  return (
    <div className={clsx("rounded-md border bg-gradient-to-br p-3", ROLE_ACCENT[agent.org_role])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{agent.name}</div>
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
            onChange={(event) => onUpdate({ provider: event.target.value as ProviderKind })}
          >
            {(Object.keys(PROVIDER_LABEL) as ProviderKind[]).map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABEL[provider]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>model</Label>
          <Input
            placeholder="gpt-5 / sonnet-4 ..."
            value={agent.model ?? ""}
            onChange={(event) => onUpdate({ model: event.target.value })}
          />
        </div>
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
      {agent.provider === "custom_cli" && (
        <div className="mt-2">
          <Label>command_template</Label>
          <Input
            value={agent.command_template ?? ""}
            placeholder="my-cli --prompt {prompt}"
            onChange={(event) => onUpdate({ command_template: event.target.value })}
          />
        </div>
      )}
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
