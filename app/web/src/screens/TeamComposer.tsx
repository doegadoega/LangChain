// STRAND — Team Composer (artboard 05). Roster + agent detail, real store.
import { useMemo, useState } from "react";
import { useApp, builtinAgents } from "../state/store";
import { StrandShell } from "../components/strand/Chrome";
import {
  Avatar,
  Btn,
  Hairline,
  Icon,
  Pill,
  RoleBadge,
  Toggle,
} from "../components/strand/primitives";
import { PROVIDER_LABEL, ROLE_LABEL } from "../lib/format";
import type { AgentConfig, ModelDecision, OrgRole, ProviderKind } from "../types";

const uid = () => Math.random().toString(36).slice(2, 8);
const PROVIDERS: ProviderKind[] = ["codex_cli", "claude_cli", "gemini_cli", "ollama", "lm_studio", "custom_cli"];
const ROLE_GROUPS: { label: string; roles: OrgRole[] }[] = [
  { label: "Decision", roles: ["ceo"] },
  { label: "Coordination", roles: ["manager", "pmo"] },
  { label: "Implementation", roles: ["worker"] },
  { label: "Quality", roles: ["qa"] },
  { label: "Optional", roles: ["ui_designer", "system_designer", "other"] },
];

export function TeamComposer() {
  const teamAgents = useApp((s) => s.request.agents);
  const request = useApp((s) => s.request);
  const savedAgents = useApp((s) => s.agents);
  const upsertAgent = useApp((s) => s.upsertAgent);
  const removeAgent = useApp((s) => s.removeAgent);
  const toggleAgentEnabled = useApp((s) => s.toggleAgentEnabled);
  const updateRequest = useApp((s) => s.updateRequest);
  const saveCurrentTeamTemplate = useApp((s) => s.saveCurrentTeamTemplate);

  const [teamName, setTeamName] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(teamAgents[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const enabledAgents = teamAgents.filter((a) => a.enabled !== false);
  const selected = teamAgents.find((a) => a.id === selectedId) ?? teamAgents[0] ?? null;

  const candidatePool = useMemo(() => {
    const builtins = builtinAgents().map((a) => ({ ...a, is_custom: false }));
    const savedIds = new Set(savedAgents.map((a) => a.id));
    return [...builtins.filter((a) => !savedIds.has(a.id)), ...savedAgents];
  }, [savedAgents]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidatePool.filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.persona.toLowerCase().includes(q),
    );
  }, [candidatePool, query]);

  const addCandidate = (agent: AgentConfig) => {
    const id = `${agent.id}_team_${uid()}`;
    upsertAgent({ ...agent, id, enabled: true, is_custom: true, depends_on: [] });
    setSelectedId(id);
    setShowAdd(false);
  };

  const patchSelected = (patch: Partial<AgentConfig>) => {
    if (!selected) return;
    upsertAgent({ ...selected, ...patch });
  };

  const saveTeam = async () => {
    setStatus("");
    try {
      const saved = await saveCurrentTeamTemplate({ name: teamName || "新規チーム", description: "" });
      setTeamName(saved.name);
      setStatus("チームを保存しました。");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <StrandShell
      breadcrumb={["workspace", "team-composer", teamName || "new team"]}
      mainStyle={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* Header */}
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "var(--paper-2)", display: "flex", alignItems: "flex-end", gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
            TEAM COMPOSER · TEMPLATE
          </div>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="team_name"
            className="serif"
            style={{
              fontSize: 28,
              fontStyle: "italic",
              letterSpacing: "-0.02em",
              marginTop: 2,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--ink)",
              width: "100%",
            }}
          />
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
            {enabledAgents.length} enabled · {teamAgents.length - enabledAgents.length} disabled
            {status && <span style={{ marginLeft: 12, color: "var(--accent-deep)" }}>{status}</span>}
          </div>
        </div>
        <Btn variant="outline" icon="more" onClick={() => { setSelectedId(null); }}>Duplicate</Btn>
        <Btn variant="solid" tone="accent" icon="check" onClick={() => void saveTeam()}>Save template</Btn>
      </div>

      {/* Config strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <ConfigCell
          label="WORKFLOW MODE"
          options={["writing", "coding"]}
          active={request.workflow_mode}
          onPick={(v) => updateRequest({ workflow_mode: v as typeof request.workflow_mode })}
        />
        <ConfigCell
          label="ORCHESTRATION"
          options={["sequential", "role_based", "dependency_graph"]}
          active={request.orchestration_mode}
          onPick={(v) => updateRequest({ orchestration_mode: v as typeof request.orchestration_mode })}
        />
        <ConfigCell
          label="ROUNDS"
          options={["1", "2", "3", "4", "5"]}
          active={String(request.rounds)}
          onPick={(v) => updateRequest({ rounds: Number(v) })}
        />
        <div style={{ padding: "14px 18px" }}>
          <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>MEMBERS</div>
          <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 4 }}>
            {enabledAgents.length} enabled · {teamAgents.length} total
          </div>
        </div>
      </div>

      {/* Two-column */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1.3fr 1fr", minHeight: 0 }}>
        {/* ROSTER */}
        <div style={{ overflow: "auto", padding: 18, borderRight: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em" }}>ROSTER</span>
            <span style={{ flex: 1 }} />
            <Btn variant="outline" icon="plus" size="sm" onClick={() => setShowAdd((v) => !v)}>
              Add agent
            </Btn>
          </div>

          {showAdd && (
            <div style={{ marginBottom: 16, border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: "1px solid var(--border)" }}>
                <Icon name="search" size={12} color="var(--ink-3)" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="候補を検索…"
                  className="mono"
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--ink)" }}
                />
              </div>
              <div style={{ maxHeight: 220, overflow: "auto" }}>
                {candidates.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => addCandidate(a)}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderBottom: "1px solid var(--border)", textAlign: "left" }}
                  >
                    <Avatar ai size={20} />
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</span>
                    <span style={{ flex: 1 }} />
                    <RoleBadge role={ROLE_LABEL[a.org_role] === a.org_role ? a.org_role : a.org_role} />
                    <Icon name="plus" size={12} color="var(--ink-3)" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {ROLE_GROUPS.map((group, gi) => {
            const groupAgents = teamAgents.filter((a) => group.roles.includes(a.org_role));
            if (groupAgents.length === 0) return null;
            return (
              <div key={group.label} style={{ marginBottom: 22 }}>
                <Hairline label={`${group.label} · ${groupAgents.length}`} n={gi + 1} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {groupAgents.map((a) => (
                    <AgentSlot
                      key={a.id}
                      a={a}
                      selected={a.id === selected?.id}
                      onSelect={() => setSelectedId(a.id)}
                      onToggle={() => toggleAgentEnabled(a.id)}
                      onRemove={() => {
                        removeAgent(a.id);
                        if (selectedId === a.id) setSelectedId(null);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {teamAgents.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              チームが空です。「Add agent」で候補から追加してください。
            </div>
          )}
        </div>

        {/* DETAIL */}
        <div style={{ overflow: "auto", background: "var(--paper-2)" }}>
          {selected ? (
            <div style={{ padding: 18 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>EDITING · {selected.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <Avatar ai size={28} />
                <input
                  value={selected.name}
                  onChange={(e) => patchSelected({ name: e.target.value })}
                  className="mono"
                  style={{ fontSize: 20, fontWeight: 600, background: "transparent", border: "none", outline: "none", color: "var(--ink)", flex: 1 }}
                />
                <RoleBadge role={selected.org_role} />
                <Pill tone={selected.enabled !== false ? "ok" : "neutral"}>{selected.enabled !== false ? "ENABLED" : "DISABLED"}</Pill>
              </div>

              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <FieldRadio
                  label="Provider"
                  options={PROVIDERS}
                  value={selected.provider}
                  onPick={(v) => patchSelected({ provider: v as ProviderKind })}
                />
                <FieldRadio
                  label="Model decision"
                  options={["fixed", "ceo_decides"]}
                  value={selected.model_decision ?? "fixed"}
                  onPick={(v) => patchSelected({ model_decision: v as ModelDecision })}
                  help="ceo_decides の場合、実行直前に CEO がモデルを選定します。"
                />
                <FieldText
                  label="Model (override)"
                  value={selected.model ?? ""}
                  disabled={selected.model_decision === "ceo_decides"}
                  onChange={(v) => patchSelected({ model: v })}
                />
                <FieldArea
                  label="Persona"
                  value={selected.persona}
                  onChange={(v) => patchSelected({ persona: v })}
                />
                <div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>
                    SKILL REFS · {selected.skill_refs?.length ?? 0}
                  </div>
                  {(selected.skill_refs ?? []).length === 0 ? (
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>なし — Agent Studio で追加できます</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(selected.skill_refs ?? []).map((ref) => (
                        <span key={ref.id} className="mono" style={{ fontSize: 11, padding: "2px 8px", background: "var(--agent-bg)", color: "var(--agent-deep)", border: "1px solid var(--agent)", borderRadius: 2 }}>
                          {ref.id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>
                    MCP · {selected.mcp_enabled ? "ON" : "OFF"}
                  </div>
                  <div className="mono" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3, padding: 10, fontSize: 11, color: "var(--ink-2)" }}>
                    <div>servers: [{(selected.mcp_servers ?? []).join(", ") || "—"}]</div>
                    <div style={{ color: "var(--ink-3)" }}>config: {selected.mcp_config_path || "—"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="outline" size="sm" icon={selected.enabled !== false ? "pause" : "play"} onClick={() => toggleAgentEnabled(selected.id)}>
                    {selected.enabled !== false ? "Disable" : "Enable"}
                  </Btn>
                  <Btn variant="outline" size="sm" icon="x" onClick={() => { removeAgent(selected.id); setSelectedId(null); }}>
                    Remove
                  </Btn>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              ロスターからエージェントを選択して編集します。
            </div>
          )}
        </div>
      </div>
    </StrandShell>
  );
}

function AgentSlot({
  a,
  selected,
  onSelect,
  onToggle,
  onRemove,
}: {
  a: AgentConfig;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const enabled = a.enabled !== false;
  return (
    <div
      onClick={onSelect}
      style={{
        background: enabled ? "var(--surface)" : "var(--surface-2)",
        border: "1px solid var(--border)",
        borderLeft: selected ? "3px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: 3,
        padding: 12,
        opacity: enabled ? 1 : 0.6,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Avatar ai size={22} />
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</span>
        <span style={{ flex: 1 }} />
        <RoleBadge role={a.org_role} />
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", display: "flex", gap: 6 }}>
        <span>{PROVIDER_LABEL[a.provider] ?? a.provider}</span>
        <span style={{ color: "var(--ink-4)" }}>·</span>
        <span style={{ color: a.model_decision === "ceo_decides" ? "var(--agent-deep)" : "var(--ink-2)" }}>
          {a.model_decision === "ceo_decides" ? "ceo decides" : `model:${a.model || "—"}`}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {a.persona || "(no persona)"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }} onClick={(e) => e.stopPropagation()}>
        <Toggle on={enabled} onClick={onToggle} />
        <span className="mono" style={{ fontSize: 10, color: enabled ? "var(--ok)" : "var(--ink-3)" }}>
          {enabled ? "ENABLED" : "DISABLED"}
        </span>
        <span style={{ flex: 1 }} />
        <button onClick={onRemove} style={{ width: 22, height: 22, display: "grid", placeItems: "center", border: "1px solid var(--border)", borderRadius: 3, color: "var(--ink-3)" }}>
          <Icon name="x" size={11} />
        </button>
      </div>
    </div>
  );
}

function ConfigCell({ label, options, active, onPick }: { label: string; options: string[]; active: string; onPick: (v: string) => void }) {
  return (
    <div style={{ padding: "14px 18px", borderRight: "1px solid var(--border)" }}>
      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ display: "flex", marginTop: 6, border: "1px solid var(--border)", borderRadius: 3, width: "fit-content", overflow: "hidden", flexWrap: "wrap" }}>
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => onPick(o)}
            className="mono"
            style={{
              padding: "4px 10px",
              fontSize: 11,
              background: o === active ? "var(--ink)" : "var(--surface)",
              color: o === active ? "var(--paper)" : "var(--ink-2)",
              borderRight: i < options.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldRadio({ label, options, value, onPick, help }: { label: string; options: string[]; value: string; onPick: (v: string) => void; help?: string }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)", width: "fit-content", overflow: "hidden" }}>
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => onPick(o)}
            className="mono"
            style={{
              padding: "6px 12px",
              fontSize: 11,
              background: o === value ? "var(--ink)" : "transparent",
              color: o === value ? "var(--paper)" : "var(--ink-2)",
              borderRight: i < options.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            {PROVIDER_LABEL[o as ProviderKind] ?? o}
          </button>
        ))}
      </div>
      {help && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{help}</div>}
    </div>
  );
}

function FieldText({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mono"
        placeholder={disabled ? "ceo_decides のため無効" : "model id"}
        style={{
          width: "100%",
          height: 30,
          padding: "0 10px",
          border: "1px solid var(--border)",
          borderRadius: 3,
          background: disabled ? "var(--surface-2)" : "var(--surface)",
          color: disabled ? "var(--ink-3)" : "var(--ink)",
          fontSize: 12,
          outline: "none",
        }}
      />
    </div>
  );
}

function FieldArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <textarea
        value={value}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          border: "1px solid var(--border)",
          borderRadius: 3,
          background: "var(--surface)",
          color: "var(--ink)",
          fontSize: 12,
          fontFamily: "var(--strand-font-sans)",
          resize: "vertical",
          outline: "none",
          lineHeight: 1.4,
        }}
      />
    </div>
  );
}
