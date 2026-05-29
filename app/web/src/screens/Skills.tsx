// STRAND — Library / Skills. Left list (library | local | candidates) + detail pane.
// Presentation migrated to the strand design system; behavior preserved verbatim.
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FolderInput, Library, Trash2, Upload, X } from "lucide-react";
import { StrandShell } from "../components/strand/Chrome";
import { Btn, Pill } from "../components/strand/primitives";
import { api } from "../api/client";
import type { CandidateBatch, SkillDocument } from "../types";

type Tab = "library" | "local" | "candidates";

const SAMPLE_MARKDOWN = `---
id: my-skill
name: My Skill
version: 1.0.0
description: Example skill
providers: [openai_api, codex_cli]
roles: [worker]
tags: [example]
---

共通ガイダンス本文。

## Provider: openai_api

OpenAI 固有の指示。

## Role: worker

worker 固有の指示。
`;

// ---------- shared strand input styles (mirrors AgentStudio/Coding) ----------
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

const fieldLabelStyle: CSSProperties = {
  fontSize: 9,
  color: "var(--ink-3)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  marginBottom: 6,
  display: "block",
};

function splitExternalUrls(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n\r,]+/)
    .map((url) => url.trim())
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function groupSkills(docs: SkillDocument[]) {
  const groups = new Map<string, SkillDocument[]>();
  for (const doc of docs) {
    const arr = groups.get(doc.metadata.id) ?? [];
    arr.push(doc);
    groups.set(doc.metadata.id, arr);
  }
  return Array.from(groups.entries()).map(([id, docs]) => ({
    id,
    latest: docs.slice().sort((a, b) => b.metadata.version.localeCompare(a.metadata.version))[0],
    versions: docs.slice().sort((a, b) => b.metadata.version.localeCompare(a.metadata.version)),
  }));
}

function frontMatterArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function managedSkillMarkdown(skill: SkillDocument): string {
  const metadata = skill.metadata;
  const frontMatter = [
    "---",
    `id: ${metadata.id}`,
    `name: ${JSON.stringify(metadata.name)}`,
    `version: ${metadata.version || "0.0.0"}`,
    metadata.description ? `description: ${JSON.stringify(metadata.description)}` : "",
    metadata.providers.length ? `providers: ${frontMatterArray(metadata.providers)}` : "",
    metadata.roles.length ? `roles: ${frontMatterArray(metadata.roles)}` : "",
    metadata.tags.length ? `tags: ${frontMatterArray(metadata.tags)}` : "",
    "---",
    "",
  ].filter(Boolean);
  return `${frontMatter.join("\n")}${skill.body || skill.markdown}`;
}

export function Skills() {
  const [tab, setTab] = useState<Tab>("library");
  const [installed, setInstalled] = useState<SkillDocument[]>([]);
  const [localInstalled, setLocalInstalled] = useState<SkillDocument[]>([]);
  const [candidates, setCandidates] = useState<CandidateBatch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null);
  const [importPath, setImportPath] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [installMarkdown, setInstallMarkdown] = useState("");
  const [showInstaller, setShowInstaller] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const refresh = async () => {
    setError("");
    try {
      const [docs, discovered, batches] = await Promise.all([
        api.listSkills(),
        api.listLocalInstalledSkills(localPath),
        api.listSkillCandidates(),
      ]);
      setInstalled(docs);
      setLocalInstalled(discovered);
      setCandidates(batches);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const groupedInstalled = useMemo(() => groupSkills(installed), [installed]);
  const groupedLocalInstalled = useMemo(() => groupSkills(localInstalled), [localInstalled]);

  const selectedSkill = useMemo(
    () => groupedInstalled.find((entry) => entry.id === selectedId)?.latest,
    [groupedInstalled, selectedId],
  );
  const selectedLocalSkill = useMemo(
    () => groupedLocalInstalled.find((entry) => entry.id === selectedLocalId)?.latest,
    [groupedLocalInstalled, selectedLocalId],
  );

  const handleInstall = async () => {
    setError("");
    if (!installMarkdown.trim()) {
      setError("SKILL.md の内容を貼り付けてください。");
      return;
    }
    try {
      const installed = await api.installSkill(installMarkdown, "user");
      setStatus(`${installed.metadata.name} v${installed.metadata.version} を登録済みに追加しました。`);
      setInstallMarkdown("");
      setShowInstaller(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleImportLocal = async () => {
    setError("");
    if (!importPath.trim()) {
      setError("ローカルディレクトリのパスを入力してください。");
      return;
    }
    try {
      const docs = await api.importLocalSkills(importPath.trim());
      setStatus(`${docs.length} 件の候補を取り込みました。Candidates タブで承認してください。`);
      setImportPath("");
      setTab("candidates");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleImportExternal = async () => {
    setError("");
    const urls = splitExternalUrls(externalUrl);
    if (urls.length === 0) {
      setError("外部 SKILL.md の URL を入力してください。");
      return;
    }
    if (urls.length > 20) {
      setError("一度に取り込める URL は 20 件までです。");
      return;
    }
    try {
      const result = await api.importExternalSkills(urls);
      const names = result.documents.map((doc) => doc.metadata.name).join(", ");
      const errorSummary =
        result.errors.length > 0
          ? ` / 失敗 ${result.errors.length} 件: ${result.errors.map((item) => item.url).join(", ")}`
          : "";
      setStatus(`${result.documents.length} 件を外部URLから候補へ取り込みました: ${names}${errorSummary}`);
      setExternalUrl("");
      setTab("candidates");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRefreshLocalInstalled = async () => {
    setError("");
    try {
      const docs = await api.listLocalInstalledSkills(localPath);
      setLocalInstalled(docs);
      setStatus(`${docs.length} 件のローカルインストール済み Skill を読み込みました。`);
      if (selectedLocalId && !docs.some((doc) => doc.metadata.id === selectedLocalId)) {
        setSelectedLocalId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleInstallLocalSkill = async (skill: SkillDocument) => {
    setError("");
    try {
      const installedSkill = await api.installSkill(managedSkillMarkdown(skill), "imported");
      setStatus(`${installedSkill.metadata.name} を Web アプリ内の登録済み Skill に追加しました。`);
      setSelectedId(installedSkill.metadata.id);
      setTab("library");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleApprove = async (batchId: string, skillId: string) => {
    setError("");
    try {
      const installed = await api.approveSkillCandidate(batchId, skillId);
      setStatus(`${installed.metadata.name} を登録済みに追加しました。`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDiscardCandidate = async (batchId: string, skillId: string) => {
    if (!window.confirm(`候補 ${skillId} を破棄しますか？`)) return;
    setError("");
    try {
      await api.discardSkillCandidate(batchId, skillId);
      setStatus(`候補 ${skillId} を破棄しました。`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (!window.confirm(`Skill ${skillId} の全バージョンを削除しますか？`)) return;
    setError("");
    try {
      await api.deleteSkill(skillId);
      setStatus(`Skill ${skillId} を削除しました。`);
      if (selectedId === skillId) setSelectedId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteVersion = async (skillId: string, version: string) => {
    if (!window.confirm(`Skill ${skillId} の v${version} を削除しますか？`)) return;
    setError("");
    try {
      await api.deleteSkillVersion(skillId, version);
      setStatus(`v${version} を削除しました。`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const candidateCount = candidates.reduce((sum, b) => sum + b.skills.length, 0);

  return (
    <StrandShell breadcrumb={["library", "skills"]} mainStyle={{ display: "flex", overflow: "hidden" }}>
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
        {/* LEFT — list + import controls */}
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
            <div style={{ marginBottom: 12 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                LIBRARY · SKILLS
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>スキル管理</div>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
                SKILL.md の登録、候補承認、エージェントへの参照元を管理します。
              </div>
            </div>
            <div
              role="tablist"
              style={{
                display: "flex",
                gap: 4,
              }}
            >
              <TabButton
                label={`登録済み (${groupedInstalled.length})`}
                active={tab === "library"}
                onClick={() => setTab("library")}
                icon={<Library style={{ width: 14, height: 14 }} />}
              />
              <TabButton
                label={`ローカル (${groupedLocalInstalled.length})`}
                active={tab === "local"}
                onClick={() => setTab("local")}
                icon={<Library style={{ width: 14, height: 14 }} />}
              />
              <TabButton
                label={`候補 (${candidateCount})`}
                active={tab === "candidates"}
                onClick={() => setTab("candidates")}
                icon={<FolderInput style={{ width: 14, height: 14 }} />}
              />
            </div>
            {tab === "library" && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <Btn
                  variant="solid"
                  tone="accent"
                  size="sm"
                  onClick={() => setShowInstaller((value) => !value)}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Upload style={{ width: 14, height: 14 }} /> SKILL.md を直接登録
                </Btn>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    borderRadius: 3,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    padding: 8,
                  }}
                >
                  <span className="mono" style={fieldLabelStyle}>
                    外部 URL から候補へ取り込み
                  </span>
                  <textarea
                    placeholder={"https://github.com/org/repo/blob/main/path/SKILL.md\nhttps://raw.githubusercontent.com/org/repo/main/other/SKILL.md"}
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value)}
                    rows={3}
                    style={textareaStyle()}
                  />
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={() => void handleImportExternal()}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Upload style={{ width: 14, height: 14 }} /> URLを一括取り込み
                  </Btn>
                </div>
              </div>
            )}
            {tab === "candidates" && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    borderRadius: 3,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    padding: 8,
                  }}
                >
                  <span className="mono" style={fieldLabelStyle}>
                    外部 URL から取り込み
                  </span>
                  <textarea
                    placeholder={"https://github.com/org/repo/blob/main/path/SKILL.md\nhttps://raw.githubusercontent.com/org/repo/main/other/SKILL.md"}
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value)}
                    rows={3}
                    style={textareaStyle()}
                  />
                  <Btn
                    variant="solid"
                    tone="accent"
                    size="sm"
                    onClick={() => void handleImportExternal()}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Upload style={{ width: 14, height: 14 }} /> URLを一括取り込み
                  </Btn>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    borderRadius: 3,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    padding: 8,
                  }}
                >
                  <span className="mono" style={fieldLabelStyle}>
                    ローカルディレクトリから取り込み
                  </span>
                  <input
                    placeholder="例: /Users/me/skills"
                    value={importPath}
                    onChange={(event) => setImportPath(event.target.value)}
                    className="mono"
                    style={{ ...inputStyle(), fontFamily: "var(--strand-font-mono)" }}
                  />
                  <Btn
                    variant="solid"
                    tone="accent"
                    size="sm"
                    onClick={() => void handleImportLocal()}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <FolderInput style={{ width: 14, height: 14 }} /> 取り込み
                  </Btn>
                </div>
              </div>
            )}
            {tab === "local" && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 3,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  padding: 8,
                }}
              >
                <span className="mono" style={fieldLabelStyle}>
                  ローカル Skill ディレクトリ
                </span>
                <input
                  placeholder="空なら ~/.codex/skills"
                  value={localPath}
                  onChange={(event) => setLocalPath(event.target.value)}
                  className="mono"
                  style={{ ...inputStyle(), fontFamily: "var(--strand-font-mono)" }}
                />
                <Btn
                  variant="solid"
                  tone="accent"
                  size="sm"
                  onClick={() => void handleRefreshLocalInstalled()}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Library style={{ width: 14, height: 14 }} /> インストール済みを再読込
                </Btn>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {tab === "library" && groupedInstalled.length === 0 && (
              <EmptyState message="登録済みスキルはありません。SKILL.md を直接登録するか、候補から承認してください。" />
            )}
            {tab === "library" &&
              groupedInstalled.map((entry) => {
                const skill = entry.latest;
                const sel = selectedId === entry.id;
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: 10,
                      borderRadius: 3,
                      border: "1px solid var(--border)",
                      borderLeft: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: sel ? "var(--surface)" : "var(--surface-2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{skill.metadata.name}</div>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                        v{skill.metadata.version}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: "var(--ink-3)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {skill.metadata.description || "(説明なし)"}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {skill.metadata.providers.map((p) => (
                        <Pill key={p} tone="neutral">
                          {p}
                        </Pill>
                      ))}
                      {skill.metadata.roles.map((r) => (
                        <Pill key={r} tone="ok">
                          {r}
                        </Pill>
                      ))}
                    </div>
                  </button>
                );
              })}
            {tab === "local" && groupedLocalInstalled.length === 0 && (
              <EmptyState message="ローカルにインストール済みの Skill が見つかりません。既定では ~/.codex/skills を読みます。" />
            )}
            {tab === "local" &&
              groupedLocalInstalled.map((entry) => {
                const skill = entry.latest;
                const sel = selectedLocalId === entry.id;
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedLocalId(entry.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: 10,
                      borderRadius: 3,
                      border: "1px solid var(--border)",
                      borderLeft: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: sel ? "var(--surface)" : "var(--surface-2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {skill.metadata.name}
                      </div>
                      <span className="mono" style={{ flexShrink: 0, fontSize: 10, color: "var(--ink-3)" }}>
                        v{skill.metadata.version}
                      </span>
                    </div>
                    <div
                      className="mono"
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        color: "var(--ink-3)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {skill.root_directory || skill.metadata.description || "(説明なし)"}
                    </div>
                  </button>
                );
              })}
            {tab === "candidates" && candidates.length === 0 && (
              <EmptyState message="候補はありません。外部URLまたはローカルディレクトリから取り込んでください。" />
            )}
            {tab === "candidates" &&
              candidates.map((batch) => (
                <div
                  key={batch.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    borderRadius: 3,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    padding: 8,
                  }}
                >
                  <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                    {batch.id}
                  </div>
                  {batch.skills.map((skill) => (
                    <div
                      key={skill.metadata.id}
                      style={{
                        borderRadius: 3,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        padding: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{skill.metadata.name}</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Btn variant="solid" tone="accent" size="sm" onClick={() => void handleApprove(batch.id, skill.metadata.id)}>
                            <CheckCircle2 style={{ width: 14, height: 14 }} /> 承認
                          </Btn>
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDiscardCandidate(batch.id, skill.metadata.id)}
                            style={{ padding: "0 8px" }}
                          >
                            <X style={{ width: 14, height: 14 }} />
                          </Btn>
                        </div>
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: "var(--ink-3)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {skill.metadata.description || "(説明なし)"} · v{skill.metadata.version}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </aside>

        {/* RIGHT — detail / installer */}
        <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {(status || error) && (
            <div
              style={{
                borderRadius: 3,
                border: `1px solid ${error ? "var(--danger)" : "var(--ok)"}`,
                background: error ? "var(--danger-bg)" : "var(--ok-bg)",
                color: error ? "var(--danger)" : "var(--ok)",
                padding: 8,
                fontSize: 11,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {error || status}
            </div>
          )}

          {showInstaller && (
            <section
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <header
                className="mono"
                style={{
                  height: 32,
                  padding: "0 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--ink-2)",
                  fontWeight: 500,
                }}
              >
                SKILL.md を登録済みに追加
                <span style={{ flex: 1 }} />
                <Btn variant="ghost" size="sm" onClick={() => setShowInstaller(false)} style={{ padding: "0 6px" }}>
                  <X style={{ width: 14, height: 14 }} />
                </Btn>
              </header>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <textarea
                  rows={14}
                  value={installMarkdown || SAMPLE_MARKDOWN}
                  onChange={(event) => setInstallMarkdown(event.target.value)}
                  className="mono"
                  style={{ ...textareaStyle(), fontFamily: "var(--strand-font-mono)" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="solid" tone="accent" onClick={() => void handleInstall()}>
                    <Upload style={{ width: 14, height: 14 }} /> 登録済みに追加
                  </Btn>
                  <Btn variant="ghost" onClick={() => setInstallMarkdown(SAMPLE_MARKDOWN)}>
                    サンプルを挿入
                  </Btn>
                </div>
              </div>
            </section>
          )}

          {selectedSkill && tab === "library" ? (
            <SkillDetail
              skill={selectedSkill}
              versions={groupedInstalled.find((entry) => entry.id === selectedSkill.metadata.id)?.versions ?? []}
              onDeleteSkill={() => void handleDeleteSkill(selectedSkill.metadata.id)}
              onDeleteVersion={(version) => void handleDeleteVersion(selectedSkill.metadata.id, version)}
            />
          ) : selectedLocalSkill && tab === "local" ? (
            <SkillDetail
              skill={selectedLocalSkill}
              versions={groupedLocalInstalled.find((entry) => entry.id === selectedLocalSkill.metadata.id)?.versions ?? []}
              readOnly
              onInstallLocal={() => void handleInstallLocalSkill(selectedLocalSkill)}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "32px 16px",
                textAlign: "center",
                border: "1px dashed var(--border-2)",
                borderRadius: 4,
                background: "var(--surface-2)",
                fontSize: 12,
                color: "var(--ink-3)",
              }}
            >
              {tab === "library"
                ? "Skill を選択して詳細を表示"
                : tab === "local"
                  ? "ローカル Skill を選択して詳細を表示"
                  : "候補を承認すると登録済みに移動します。"}
            </div>
          )}
        </div>
      </div>
    </StrandShell>
  );
}

function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="mono"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "6px 8px",
        fontSize: 11,
        letterSpacing: "0.02em",
        borderRadius: 3,
        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
        background: active ? "var(--accent-soft)" : "var(--surface)",
        color: active ? "var(--accent-deep)" : "var(--ink-2)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        textAlign: "center",
        border: "1px dashed var(--border-2)",
        borderRadius: 4,
        background: "var(--surface-2)",
        fontSize: 11,
        color: "var(--ink-3)",
      }}
    >
      {message}
    </div>
  );
}

function SectionPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <header
        className="mono"
        style={{
          height: 32,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
          fontSize: 11,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--ink-2)",
          fontWeight: 500,
        }}
      >
        {title}
      </header>
      <div style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

function SkillDetail({
  skill,
  versions,
  onDeleteSkill,
  onDeleteVersion,
  onInstallLocal,
  readOnly = false,
}: {
  skill: SkillDocument;
  versions: SkillDocument[];
  onDeleteSkill?: () => void;
  onDeleteVersion?: (version: string) => void;
  onInstallLocal?: () => void;
  readOnly?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "10px 12px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{skill.metadata.name}</div>
            <div className="mono" style={{ marginTop: 4, fontSize: 10, color: "var(--ink-3)" }}>
              id: {skill.metadata.id} · source: {skill.source}
            </div>
          </div>
          {readOnly ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Pill tone="neutral">read only</Pill>
              {onInstallLocal && (
                <Btn variant="solid" tone="accent" size="sm" onClick={onInstallLocal}>
                  <Upload style={{ width: 14, height: 14 }} /> Webアプリに登録
                </Btn>
              )}
            </div>
          ) : (
            <Btn
              variant="outline"
              size="sm"
              onClick={onDeleteSkill ?? (() => undefined)}
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              <Trash2 style={{ width: 14, height: 14 }} /> Skill を削除
            </Btn>
          )}
        </header>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--ink-2)" }}>
          {skill.metadata.description && <div>{skill.metadata.description}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {skill.metadata.providers.map((p) => (
              <Pill key={p} tone="neutral">
                provider: {p}
              </Pill>
            ))}
            {skill.metadata.roles.map((r) => (
              <Pill key={r} tone="ok">
                role: {r}
              </Pill>
            ))}
            {skill.metadata.tags.map((t) => (
              <Pill key={t} tone="neutral">
                #{t}
              </Pill>
            ))}
          </div>
        </div>
      </section>

      <SectionPanel title="バージョン">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          {versions.map((v) => (
            <div
              key={v.metadata.version}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 3,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                padding: "4px 10px",
              }}
            >
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                v{v.metadata.version}
              </span>
              {!readOnly && onDeleteVersion && (
                <Btn variant="ghost" size="sm" onClick={() => onDeleteVersion(v.metadata.version)} style={{ padding: "0 6px" }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </Btn>
              )}
            </div>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="SKILL.md 本文">
        <pre
          className="mono"
          style={{
            maxHeight: 384,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            borderRadius: 3,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            padding: 12,
            fontSize: 11,
            lineHeight: 1.6,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {skill.markdown}
        </pre>
      </SectionPanel>
    </div>
  );
}
