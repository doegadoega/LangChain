// STRAND — Settings (artboard 09). Providers wired to real health endpoint.
import { useEffect, useState } from "react";
import { useApp } from "../state/store";
import { api } from "../api/client";
import { StrandShell } from "../components/strand/Chrome";
import { Btn, Dot, Icon, Pill, Toggle, type IconName } from "../components/strand/primitives";
import { PROVIDER_LABEL } from "../lib/format";
import type { ProviderHealth } from "../types";

type Section = "providers" | "defaults" | "appearance" | "system";

const SECTIONS: { id: Section; label: string; n: string }[] = [
  { id: "providers", label: "Providers", n: "01" },
  { id: "defaults", label: "Defaults", n: "02" },
  { id: "appearance", label: "Appearance", n: "03" },
  { id: "system", label: "System info", n: "04" },
];

export function Settings() {
  const templates = useApp((s) => s.templates);
  const [section, setSection] = useState<Section>("providers");
  const [health, setHealth] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const res = await api.getProvidersHealth();
      setHealth(res.providers);
    } catch {
      setHealth([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <StrandShell breadcrumb={["workspace", "settings"]} mainStyle={{ display: "flex", overflow: "hidden" }}>
          {/* Sub-nav */}
          <aside
            style={{
              width: 220,
              borderRight: "1px solid var(--border)",
              background: "var(--paper-2)",
              display: "flex",
              flexDirection: "column",
              padding: "16px 0",
            }}
          >
            <div className="mono" style={{ padding: "0 16px 8px", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
              SETTINGS
            </div>
            {SECTIONS.map((s) => {
              const on = s.id === section;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  style={{
                    padding: "8px 16px",
                    background: on ? "var(--ink)" : "transparent",
                    color: on ? "var(--paper)" : "var(--ink-2)",
                    margin: "0 8px",
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                    textAlign: "left",
                  }}
                >
                  <span className="mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>{s.n}</span>
                  <span style={{ fontWeight: on ? 600 : 400 }}>{s.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
            {section === "providers" && (
              <>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                  SETTINGS · 01 · PROVIDERS
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
                  <h1 className="serif" style={{ fontSize: 32, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 4 }}>
                    Provider connections
                  </h1>
                  <span style={{ flex: 1 }} />
                  <Btn variant="outline" icon="terminal" onClick={() => void loadHealth()}>
                    {loading ? "確認中…" : "再チェック"}
                  </Btn>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, maxWidth: 720, lineHeight: 1.55 }}>
                  エージェントが呼び出すローカル CLI / API。各 provider はこのマシン上で稼働します。CEO のモデル決定は有効な provider に対して解決されます。
                </div>
                <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                  {health.map((p) => (
                    <ProviderCard key={p.provider} p={p} />
                  ))}
                  {health.length === 0 && (
                    <div style={{ padding: 18, color: "var(--ink-3)", fontSize: 13 }}>
                      provider 情報を取得できませんでした。
                    </div>
                  )}
                </div>
              </>
            )}

            {section === "defaults" && (
              <>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                  SETTINGS · 02 · DEFAULTS
                </div>
                <h1 className="serif" style={{ fontSize: 32, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 4 }}>
                  Team templates
                </h1>
                <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 3, padding: 16 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="user" size={14} color="var(--ink-2)" />
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                        <span style={{ flex: 1 }} />
                        <Pill tone="agent">{t.agents?.length ?? 0} agents</Pill>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6 }}>{t.description ?? ""}</div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 6 }}>
                        {t.orchestration_mode ?? "role_based"} · rounds {t.rounds ?? 1}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {section === "appearance" && <AppearanceSection />}

            {section === "system" && (
              <>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                  SETTINGS · 04 · SYSTEM
                </div>
                <h1 className="serif" style={{ fontSize: 32, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 4 }}>
                  About this installation
                </h1>
                <div
                  style={{
                    marginTop: 18,
                    padding: 16,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 3,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 18,
                  }}
                >
                  {[
                    ["VERSION", "agent-refinement v2"],
                    ["BACKEND", "fastapi @ 127.0.0.1:8000"],
                    ["DATA", "~/.agent-refinement/"],
                    ["TEMPLATES", `${templates.length} 件`],
                    ["PROVIDERS", `${health.filter((p) => p.alive).length}/${health.length} alive`],
                    ["LOGS", "~/.agent-refinement/logs/"],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{l}</div>
                      <div className="mono" style={{ fontSize: 12, color: "var(--ink)", marginTop: 4 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
                  <Btn variant="outline" icon="log">データディレクトリを開く</Btn>
                  <Btn variant="outline" icon="terminal">バックエンド再起動</Btn>
                </div>
              </>
            )}
          </div>
    </StrandShell>
  );
}

function ProviderCard({ p }: { p: ProviderHealth }) {
  const isOk = p.alive;
  const label = PROVIDER_LABEL[p.provider] ?? p.provider;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${isOk ? "var(--border)" : "var(--border-2)"}`,
        borderLeft: `3px solid ${isOk ? "var(--ok)" : "var(--ink-4)"}`,
        borderRadius: 3,
        padding: 18,
        opacity: isOk ? 1 : 0.85,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            background: "var(--paper-2)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            fontFamily: "var(--strand-font-mono)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          {label.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{p.provider}</span>
            <Pill tone={isOk ? "ok" : "neutral"}>{isOk ? "CONNECTED" : "OFFLINE"}</Pill>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>
            {p.endpoint ?? p.detail}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Toggle on={isOk} />
        </div>
      </div>
      {!isOk && p.start_command && (
        <div
          className="mono"
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--ink-2)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Icon name="terminal" size={12} color="var(--ink-3)" />
          <code style={{ color: "var(--accent-deep)" }}>{p.start_command}</code>
        </div>
      )}
      {isOk && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Dot tone="ok" size={6} />
          <span className="mono" style={{ fontSize: 12, color: "var(--ok)" }}>{p.detail}</span>
        </div>
      )}
    </div>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? "light");
  const [density, setDensity] = useState(() => document.documentElement.dataset.density ?? "normal");

  const applyTheme = (v: string) => {
    document.documentElement.dataset.theme = v;
    setTheme(v);
  };
  const applyDensity = (v: string) => {
    document.documentElement.dataset.density = v;
    setDensity(v);
  };

  const RadioRow = ({ label, value, options, onChange, icon }: { label: string; value: string; options: string[]; onChange: (v: string) => void; icon: IconName }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
      <Icon name={icon} size={14} color="var(--ink-2)" />
      <span style={{ fontSize: 13, color: "var(--ink)", width: 120 }}>{label}</span>
      <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
        {options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="mono"
            style={{
              padding: "0 14px",
              height: 28,
              fontSize: 11,
              background: value === opt ? "var(--ink)" : "var(--surface)",
              color: value === opt ? "var(--paper)" : "var(--ink-2)",
              borderRight: i < options.length - 1 ? "1px solid var(--border)" : "none",
              textTransform: "capitalize",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
        SETTINGS · 03 · APPEARANCE
      </div>
      <h1 className="serif" style={{ fontSize: 32, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 4 }}>
        Appearance
      </h1>
      <div style={{ maxWidth: 560, marginTop: 12 }}>
        <RadioRow label="Theme" value={theme} options={["light", "dark"]} onChange={applyTheme} icon="eye" />
        <RadioRow label="Density" value={density} options={["compact", "normal", "cozy"]} onChange={applyDensity} icon="board" />
      </div>
    </>
  );
}
