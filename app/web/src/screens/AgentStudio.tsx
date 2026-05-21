// STRAND — Agent Studio (artboard 06). Master catalog + skill_refs editor.
import { useCallback, useEffect, useMemo, useState } from "react";
import { StrandShell } from "../components/strand/Chrome";
import { Avatar, Btn, Icon, Pill, RoleBadge, Toggle } from "../components/strand/primitives";
import { builtinAgents, newAgent, useApp } from "../state/store";
import { PROVIDER_LABEL, ROLE_LABEL } from "../lib/format";
import { api } from "../api/client";
import type {
  AgentConfig,
  ModelDecision,
  OrgRole,
  ProviderKind,
  SkillDocument,
  SkillReference,
  SkillVersionKind,
} from "../types";

type SortKey = "name_asc" | "name_desc" | "role" | "provider" | "type";
const PROVIDERS: ProviderKind[] = ["codex_cli", "claude_cli", "gemini_cli", "ollama", "lm_studio", "custom_cli"];
const VERSION_MODES: { v: SkillVersionKind; l: string }[] = [
  { v: "latest", l: "latest" },
  { v: "latest_compatible", l: "compat" },
  { v: "exact", l: "exact" },
];

export function AgentStudio() {
  const savedAgents = useApp((s) => s.agents);
  const deleteSavedAgent = useApp((s) => s.deleteSavedAgent);
  const loadAll = useApp((s) => s.loadAll);

  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<OrgRole | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("type");
  const [draft, setDraft] = useState<AgentConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(savedAgents[0]?.id ?? null);
  const [editing, setEditing] = useState<AgentConfig | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [installedSkills, setInstalledSkills] = useState<SkillDocument[]>([]);

  useEffect(() => {
    api.listSkills().then(setInstalledSkills).catch(() => setInstalledSkills([]));
  }, []);

  const savedIds = useMemo(() => new Set(savedAgents.map((a) => a.id)), [savedAgents]);
  const builtins = useMemo(() => builtinAgents(), []);
  const builtinIds = useMemo(() => new Set(builtins.map((a) => a.id)), [builtins]);
  const builtinsNotShadowed = useMemo(() => builtins.filter((a) => !savedIds.has(a.id)), [builtins, savedIds]);
  const isBuiltin = useCallback((id: string) => builtinIds.has(id) && !savedIds.has(id), [builtinIds, savedIds]);
  const listAgents = useMemo<AgentConfig[]>(
    () => [...(draft ? [draft] : []), ...savedAgents, ...builtinsNotShadowed],
    [draft, savedAgents, builtinsNotShadowed],
  );

  const filtered = useMemo(() => {
    const list = listAgents.filter((a) => {
      if (filterRole !== "all" && a.org_role !== filterRole) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.persona.toLowerCase().includes(q) || a.skills.join(",").toLowerCase().includes(q);
    });
    const collator = new Intl.Collator("ja", { sensitivity: "base" });
    return list.slice().sort((a, b) => {
      switch (sortKey) {
        case "name_asc": return collator.compare(a.name, b.name);
        case "name_desc": return collator.compare(b.name, a.name);
        case "role": return collator.compare(a.org_role, b.org_role) || collator.compare(a.name, b.name);
        case "provider": return collator.compare(a.provider, b.provider) || collator.compare(a.name, b.name);
        case "type": return (isBuiltin(a.id) ? 1 : 0) - (isBuiltin(b.id) ? 1 : 0) || collator.compare(a.name, b.name);
        default: return 0;
      }
    });
  }, [listAgents, query, filterRole, sortKey, isBuiltin]);

  const sourceForId = (id: string | null): AgentConfig | undefined => {
    if (!id) return undefined;
    if (draft && draft.id === id) return draft;
    return savedAgents.find((a) => a.id === id) ?? builtins.find((a) => a.id === id);
  };
  const baseSelected = sourceForId(selectedId) ?? filtered[0];
  const selected: AgentConfig | undefined =
    editing && baseSelected && editing.id === baseSelected.id ? editing : baseSelected;
  const isDraft = !!(selected && draft && selected.id === draft.id);
  const isSelectedBuiltin = !!selected && isBuiltin(selected.id);

  const handleSelect = (id: string) => { setSelectedId(id); setEditing(null); setSaveMessage(""); };
  const handleChange = (patch: Partial<AgentConfig>) => {
    if (!selected || isSelectedBuiltin) return;
    const next = { ...selected, ...patch };
    if (isDraft) setDraft(next);
    else setEditing(next);
  };
  const handleNew = () => { const a = newAgent(); setDraft(a); setSelectedId(a.id); setEditing(null); setSaveMessage(""); };
  const handleClone = () => {
    if (!selected) return;
    const copy: AgentConfig = { ...selected, id: `${selected.id}_user_${Math.random().toString(36).slice(2, 8)}`, name: `${selected.name} (コピー)`, is_custom: true };
    setDraft(copy); setSelectedId(copy.id); setEditing(null); setSaveMessage("Built-in をコピーしました。編集して保存してください。");
  };
  const saveAgent = async (agent: AgentConfig) => {
    const payload: AgentConfig = { ...agent, is_custom: true };
    const saved = savedIds.has(agent.id) ? await api.updateAgent(agent.id, payload) : await api.createAgent(payload);
    await loadAll();
    if (isDraft) setDraft(null);
    setEditing(null); setSelectedId(saved.id); setSaveMessage(`${saved.name} を保存しました。`);
  };
  const handleDelete = async () => {
    if (!selected) return;
    if (isDraft) { setDraft(null); setSelectedId(savedAgents[0]?.id ?? null); setEditing(null); return; }
    if (!window.confirm(`「${selected.name}」をライブラリから削除しますか？`)) return;
    await deleteSavedAgent(selected.id);
    setEditing(null); setSelectedId(savedAgents.find((a) => a.id !== selected.id)?.id ?? null); setSaveMessage("");
  };

  return (
    <StrandShell breadcrumb={["workspace", "agent-studio"]} mainStyle={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-end", gap: 18, background: "var(--paper-2)" }}>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>AGENT STUDIO · MASTER CATALOG</div>
          <h1 className="serif" style={{ fontSize: 28, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 2 }}>
            Master agents · {savedAgents.length + builtinsNotShadowed.length}
          </h1>
        </div>
        <Btn variant="outline" icon="more" size="md" onClick={handleClone}>Duplicate</Btn>
        <Btn variant="solid" tone="accent" icon="plus" size="md" onClick={handleNew}>New agent</Btn>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "8px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--paper)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 28, padding: "0 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3, minWidth: 280 }}>
          <Icon name="search" size={12} color="var(--ink-3)" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search by name / persona / skill…" className="mono" style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 11, color: "var(--ink)" }} />
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>role:</span>
        <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)", overflow: "hidden", flexWrap: "wrap" }}>
          {(["all", ...(Object.keys(ROLE_LABEL) as OrgRole[])] as (OrgRole | "all")[]).map((r, i, arr) => (
            <button key={r} onClick={() => setFilterRole(r)} className="mono" style={{
              padding: "4px 8px", fontSize: 10, letterSpacing: "0.06em",
              background: r === filterRole ? "var(--ink)" : "transparent",
              color: r === filterRole ? "var(--paper)" : "var(--ink-2)",
              borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
            }}>{r === "all" ? "ALL" : ROLE_LABEL[r].toUpperCase()}</button>
          ))}
        </div>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="mono" style={{ height: 28, border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)", color: "var(--ink-2)", fontSize: 11, padding: "0 6px" }}>
          <option value="type">種別</option>
          <option value="name_asc">名前↑</option>
          <option value="name_desc">名前↓</option>
          <option value="role">role</option>
          <option value="provider">provider</option>
        </select>
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>showing {filtered.length} of {listAgents.length}</span>
      </div>

      {/* Two-panel */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.2fr", minHeight: 0 }}>
        {/* TABLE */}
        <div style={{ overflow: "auto", borderRight: "1px solid var(--border)" }}>
          <div className="mono" style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 1fr 0.5fr", padding: "8px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 9, letterSpacing: "0.1em", color: "var(--ink-3)" }}>
            <span>NAME</span><span>ROLE</span><span>PROVIDER</span><span>SKILLS</span>
          </div>
          {filtered.map((a) => {
            const sel = a.id === selected?.id;
            return (
              <div key={a.id} onClick={() => handleSelect(a.id)} style={{
                display: "grid", gridTemplateColumns: "1.6fr 0.8fr 1fr 0.5fr", padding: "10px 14px",
                borderBottom: "1px solid var(--border)", background: sel ? "var(--surface)" : "transparent",
                borderLeft: sel ? "2px solid var(--accent)" : "2px solid transparent", fontSize: 11, alignItems: "center", cursor: "pointer",
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Avatar ai size={20} />
                  <span className="mono" style={{ fontSize: 12, fontWeight: sel ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                  {isBuiltin(a.id) && <Pill tone="neutral">BUILT-IN</Pill>}
                  {draft && a.id === draft.id && <Pill tone="warn">DRAFT</Pill>}
                </span>
                <span><RoleBadge role={a.org_role} /></span>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {PROVIDER_LABEL[a.provider] ?? a.provider}
                  <span style={{ color: a.model_decision === "ceo_decides" ? "var(--agent-deep)" : "var(--ink-3)", marginLeft: 6 }}>· {a.model_decision === "ceo_decides" ? "ceo" : "fixed"}</span>
                </span>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-2)" }}>{(a.skill_refs?.length ?? 0) + a.skills.length}</span>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>該当なし</div>}
        </div>

        {/* DETAIL */}
        <div style={{ overflow: "auto", background: "var(--paper-2)" }}>
          {selected ? (
            <AgentDetail
              agent={selected}
              isBuiltin={isSelectedBuiltin}
              saveMessage={saveMessage}
              installedSkills={installedSkills}
              onChange={handleChange}
              onSave={() => void saveAgent(selected)}
              onDelete={() => void handleDelete()}
              onClone={handleClone}
            />
          ) : (
            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--ink-3)", fontSize: 13 }}>エージェントを選択</div>
          )}
        </div>
      </div>
    </StrandShell>
  );
}

function AgentDetail({
  agent, isBuiltin, saveMessage, installedSkills, onChange, onSave, onDelete, onClone,
}: {
  agent: AgentConfig;
  isBuiltin: boolean;
  saveMessage: string;
  installedSkills: SkillDocument[];
  onChange: (patch: Partial<AgentConfig>) => void;
  onSave: () => void;
  onDelete: () => void;
  onClone: () => void;
}) {
  const [tag, setTag] = useState("");
  const refs = agent.skill_refs ?? [];
  const usedRefIds = new Set(refs.map((r) => r.id));
  const available = installedSkills.filter((s) => !usedRefIds.has(s.metadata.id));

  const setRefs = (next: SkillReference[]) => onChange({ skill_refs: next });
  const addRef = (id: string) =>
    setRefs([...refs, { id, source: "user", version_requirement: { kind: "latest" }, enabled: true }]);
  const patchRef = (id: string, patch: Partial<SkillReference>) =>
    setRefs(refs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRef = (id: string) => setRefs(refs.filter((r) => r.id !== id));

  return (
    <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18, opacity: isBuiltin ? 0.92 : 1 }}>
      {/* Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar ai size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <input value={agent.name} disabled={isBuiltin} onChange={(e) => onChange({ name: e.target.value })} className="mono"
            style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", background: "transparent", border: "none", outline: "none", color: "var(--ink)", width: "100%" }} />
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
            {(PROVIDER_LABEL[agent.provider] ?? agent.provider)} · {agent.model_decision === "ceo_decides" ? "ceo_decides" : agent.model || "fixed"}
          </div>
        </div>
        <RoleBadge role={agent.org_role} />
        {isBuiltin ? (
          <Btn variant="solid" tone="accent" size="sm" icon="more" onClick={onClone}>Clone to edit</Btn>
        ) : (
          <>
            <Btn variant="outline" size="sm" icon="x" onClick={onDelete}>Delete</Btn>
            <Btn variant="solid" tone="accent" size="sm" icon="check" onClick={onSave}>Save</Btn>
          </>
        )}
      </div>
      {saveMessage && <div className="mono" style={{ fontSize: 11, color: "var(--accent-deep)" }}>{saveMessage}</div>}

      {/* Role / provider / decision */}
      <DetailField label="ROLE">
        <select disabled={isBuiltin} value={agent.org_role} onChange={(e) => onChange({ org_role: e.target.value as OrgRole })} className="mono" style={selectStyle}>
          {(Object.keys(ROLE_LABEL) as OrgRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </DetailField>
      <DetailField label="PROVIDER">
        <Segmented disabled={isBuiltin} options={PROVIDERS} value={agent.provider} labels={PROVIDERS.map((p) => PROVIDER_LABEL[p] ?? p)} onPick={(v) => onChange({ provider: v as ProviderKind })} />
      </DetailField>
      <DetailField label="MODEL DECISION" help="ceo_decides の場合、実行直前に CEO がモデル選定します。">
        <Segmented disabled={isBuiltin} options={["fixed", "ceo_decides"]} value={agent.model_decision ?? "fixed"} onPick={(v) => onChange({ model_decision: v as ModelDecision })} />
      </DetailField>
      <DetailField label="MODEL (OVERRIDE)">
        <input value={agent.model ?? ""} disabled={isBuiltin || agent.model_decision === "ceo_decides"} onChange={(e) => onChange({ model: e.target.value })} className="mono"
          placeholder={agent.model_decision === "ceo_decides" ? "ceo_decides のため無効" : "model id"} style={inputStyle(isBuiltin || agent.model_decision === "ceo_decides")} />
      </DetailField>

      {/* Legacy tags */}
      <DetailField label="LEGACY TAGS · skills: string[]">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {agent.skills.map((t) => (
            <span key={t} className="mono" style={{ padding: "3px 8px", fontSize: 11, background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border-2)", borderRadius: 2, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {t}
              {!isBuiltin && <button onClick={() => onChange({ skills: agent.skills.filter((x) => x !== t) })} style={{ color: "var(--ink-3)" }}>×</button>}
            </span>
          ))}
          {!isBuiltin && (
            <input value={tag} onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && tag.trim()) { onChange({ skills: [...agent.skills, tag.trim()] }); setTag(""); } }}
              placeholder="+ tag" className="mono" style={{ width: 90, padding: "3px 8px", fontSize: 11, border: "1px dashed var(--border-2)", borderRadius: 2, background: "transparent", color: "var(--ink)", outline: "none" }} />
          )}
        </div>
      </DetailField>

      {/* Skill refs editor */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em" }}>インストール済みスキル</span>
          <Pill tone="agent">skill_refs · {refs.length}</Pill>
        </div>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {refs.length === 0 && <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>skill_refs はありません。</div>}
          {refs.map((ref) => {
            const doc = installedSkills.find((s) => s.metadata.id === ref.id);
            return (
              <div key={ref.id} style={{ border: "1px solid var(--border)", borderRadius: 3, background: ref.enabled ? "var(--paper)" : "var(--surface-2)", opacity: ref.enabled ? 1 : 0.6, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{ref.id}</div>
                    {doc && <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>{doc.metadata.description}</div>}
                  </div>
                  <Toggle on={ref.enabled} onClick={() => !isBuiltin && patchRef(ref.id, { enabled: !ref.enabled })} />
                  {!isBuiltin && <button onClick={() => removeRef(ref.id)} style={{ width: 24, height: 24, display: "grid", placeItems: "center", color: "var(--ink-3)", border: "1px solid var(--border)", borderRadius: 3 }}><Icon name="x" size={11} /></button>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.08em" }}>VERSION</span>
                  <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    {VERSION_MODES.map((o, i) => (
                      <button key={o.v} disabled={isBuiltin} onClick={() => patchRef(ref.id, { version_requirement: { kind: o.v, version: o.v === "exact" ? doc?.metadata.version ?? ref.version_requirement.version : null } })} className="mono" style={{
                        padding: "3px 8px", fontSize: 10,
                        background: o.v === ref.version_requirement.kind ? "var(--ink)" : "transparent",
                        color: o.v === ref.version_requirement.kind ? "var(--paper)" : "var(--ink-2)",
                        borderRight: i < 2 ? "1px solid var(--border)" : "none",
                      }}>{o.l}</button>
                    ))}
                  </div>
                  {ref.version_requirement.kind === "exact" && (
                    <span className="mono" style={{ fontSize: 10, padding: "2px 6px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 2 }}>
                      {ref.version_requirement.version ?? doc?.metadata.version ?? "?"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {!isBuiltin && available.length > 0 && (
            <details>
              <summary className="mono" style={{ cursor: "pointer", height: 32, display: "flex", alignItems: "center", gap: 8, border: "1px dashed var(--border-2)", borderRadius: 3, color: "var(--ink-3)", fontSize: 11, padding: "0 12px" }}>
                <Icon name="plus" size={11} /> Library から選択… ({available.length} installed)
              </summary>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {available.map((s) => (
                  <button key={s.metadata.id} onClick={() => addRef(s.metadata.id)} className="mono" style={{ textAlign: "left", padding: "6px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)", color: "var(--ink)" }}>
                    {s.metadata.id} <span style={{ color: "var(--ink-3)" }}>· {s.metadata.version}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Persona */}
      <DetailField label="PERSONA">
        <textarea value={agent.persona} disabled={isBuiltin} rows={4} onChange={(e) => onChange({ persona: e.target.value })}
          style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 3, background: isBuiltin ? "var(--surface-2)" : "var(--surface)", color: "var(--ink)", fontSize: 12, fontFamily: "var(--strand-font-sans)", lineHeight: 1.5, resize: "vertical", outline: "none" }} />
      </DetailField>
    </div>
  );
}

const selectStyle = { height: 30, padding: "0 8px", border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)", color: "var(--ink)", fontSize: 12, outline: "none", width: "fit-content" } as const;
const inputStyle = (disabled: boolean) => ({ width: "100%", height: 30, padding: "0 10px", border: "1px solid var(--border)", borderRadius: 3, background: disabled ? "var(--surface-2)" : "var(--surface)", color: disabled ? "var(--ink-3)" : "var(--ink)", fontSize: 12, outline: "none" });

function DetailField({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      {children}
      {help && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{help}</div>}
    </div>
  );
}

function Segmented({ options, value, labels, onPick, disabled }: { options: string[]; value: string; labels?: string[]; onPick: (v: string) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid var(--border)", borderRadius: 3, background: "var(--surface)", width: "fit-content", overflow: "hidden" }}>
      {options.map((o, i) => (
        <button key={o} disabled={disabled} onClick={() => onPick(o)} className="mono" style={{
          padding: "6px 12px", fontSize: 11,
          background: o === value ? "var(--ink)" : "transparent",
          color: o === value ? "var(--paper)" : "var(--ink-2)",
          borderRight: i < options.length - 1 ? "1px solid var(--border)" : "none",
        }}>{labels?.[i] ?? o}</button>
      ))}
    </div>
  );
}
