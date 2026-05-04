import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FolderInput, Library, Trash2, Upload, X } from "lucide-react";
import clsx from "clsx";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Label, Textarea } from "../components/ui/Field";
import { api } from "../api/client";
import type { CandidateBatch, SkillDocument } from "../types";

type Tab = "library" | "candidates";

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

export function Skills() {
  const [tab, setTab] = useState<Tab>("library");
  const [installed, setInstalled] = useState<SkillDocument[]>([]);
  const [candidates, setCandidates] = useState<CandidateBatch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importPath, setImportPath] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [installMarkdown, setInstallMarkdown] = useState("");
  const [showInstaller, setShowInstaller] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const refresh = async () => {
    setError("");
    try {
      const [docs, batches] = await Promise.all([
        api.listSkills(),
        api.listSkillCandidates(),
      ]);
      setInstalled(docs);
      setCandidates(batches);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const groupedInstalled = useMemo(() => {
    const groups = new Map<string, SkillDocument[]>();
    for (const doc of installed) {
      const arr = groups.get(doc.metadata.id) ?? [];
      arr.push(doc);
      groups.set(doc.metadata.id, arr);
    }
    return Array.from(groups.entries()).map(([id, docs]) => ({
      id,
      latest: docs.slice().sort((a, b) => b.metadata.version.localeCompare(a.metadata.version))[0],
      versions: docs.slice().sort((a, b) => b.metadata.version.localeCompare(a.metadata.version)),
    }));
  }, [installed]);

  const selectedSkill = useMemo(
    () => groupedInstalled.find((entry) => entry.id === selectedId)?.latest,
    [groupedInstalled, selectedId],
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
    if (!externalUrl.trim()) {
      setError("外部 SKILL.md の URL を入力してください。");
      return;
    }
    try {
      const doc = await api.importExternalSkill(externalUrl.trim());
      setStatus(`${doc.metadata.name} を外部URLから候補へ取り込みました。承認すると登録済みに追加されます。`);
      setExternalUrl("");
      setTab("candidates");
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

  return (
    <div className="grid h-full grid-cols-[360px_minmax(0,1fr)] overflow-hidden">
      <div className="flex flex-col overflow-hidden border-r border-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] p-3 space-y-2">
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">スキル管理</div>
            <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
              SKILL.md の登録、候補承認、エージェントへの参照元を管理します。
            </div>
          </div>
          <div className="flex gap-1">
            <TabButton label={`登録済み (${groupedInstalled.length})`} active={tab === "library"} onClick={() => setTab("library")} icon={<Library className="h-3.5 w-3.5" />} />
            <TabButton
              label={`候補 (${candidates.reduce((sum, b) => sum + b.skills.length, 0)})`}
              active={tab === "candidates"}
              onClick={() => setTab("candidates")}
              icon={<FolderInput className="h-3.5 w-3.5" />}
            />
          </div>
          {tab === "library" && (
            <Button size="sm" variant="primary" className="w-full" onClick={() => setShowInstaller((value) => !value)}>
              <Upload className="h-3.5 w-3.5" /> SKILL.md を直接登録
            </Button>
          )}
          {tab === "candidates" && (
            <div className="space-y-2">
              <div className="space-y-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
                <Label className="text-[10px]">外部 URL から取り込み</Label>
                <Input
                  placeholder="https://github.com/org/repo/blob/main/path/SKILL.md"
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                  className="text-xs"
                />
                <Button size="sm" variant="primary" className="w-full" onClick={() => void handleImportExternal()}>
                  <Upload className="h-3.5 w-3.5" /> URLから候補へ取り込み
                </Button>
              </div>
              <div className="space-y-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
                <Label className="text-[10px]">ローカルディレクトリから取り込み</Label>
                <Input
                  placeholder="例: /Users/me/skills"
                  value={importPath}
                  onChange={(event) => setImportPath(event.target.value)}
                  className="text-xs"
                />
                <Button size="sm" variant="primary" className="w-full" onClick={() => void handleImportLocal()}>
                  <FolderInput className="h-3.5 w-3.5" /> 取り込み
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tab === "library" && groupedInstalled.length === 0 && (
            <EmptyState message="登録済みスキルはありません。SKILL.md を直接登録するか、候補から承認してください。" />
          )}
          {tab === "library" &&
            groupedInstalled.map((entry) => {
              const skill = entry.latest;
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className={clsx(
                    "block w-full rounded-md border bg-[var(--color-surface-2)] p-2.5 text-left transition-colors",
                    selectedId === entry.id
                      ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/40"
                      : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{skill.metadata.name}</div>
                    <span className="text-[10px] tabular-nums text-[var(--color-fg-subtle)]">v{skill.metadata.version}</span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-[var(--color-fg-muted)]">
                    {skill.metadata.description || "(説明なし)"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
                    {skill.metadata.providers.map((p) => (
                      <span key={p} className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-[1px] text-[var(--color-fg-muted)]">
                        {p}
                      </span>
                    ))}
                    {skill.metadata.roles.map((r) => (
                      <span key={r} className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-[1px] text-emerald-300">
                        {r}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          {tab === "candidates" && candidates.length === 0 && (
            <EmptyState message="候補はありません。外部URLまたはローカルディレクトリから取り込んでください。" />
          )}
          {tab === "candidates" &&
            candidates.map((batch) => (
              <div key={batch.id} className="space-y-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">{batch.id}</div>
                {batch.skills.map((skill) => (
                  <div key={skill.metadata.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{skill.metadata.name}</div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="primary" onClick={() => void handleApprove(batch.id, skill.metadata.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> 承認
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void handleDiscardCandidate(batch.id, skill.metadata.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 truncate text-[11px] text-[var(--color-fg-muted)]">
                      {skill.metadata.description || "(説明なし)"} · v{skill.metadata.version}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>

      <div className="overflow-y-auto p-4 space-y-3">
        {(status || error) && (
          <div
            className={clsx(
              "rounded-md border p-2 text-xs",
              error
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
            )}
          >
            {error || status}
          </div>
        )}

        {showInstaller && (
          <Card>
            <CardHeader>
              <CardTitle>SKILL.md を登録済みに追加</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowInstaller(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardBody className="space-y-3">
              <Textarea
                rows={14}
                value={installMarkdown || SAMPLE_MARKDOWN}
                onChange={(event) => setInstallMarkdown(event.target.value)}
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => void handleInstall()}>
                  <Upload className="h-3.5 w-3.5" /> 登録済みに追加
                </Button>
                <Button variant="ghost" onClick={() => setInstallMarkdown(SAMPLE_MARKDOWN)}>
                  サンプルを挿入
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {selectedSkill && tab === "library" ? (
          <SkillDetail
            skill={selectedSkill}
            versions={groupedInstalled.find((entry) => entry.id === selectedSkill.metadata.id)?.versions ?? []}
            onDeleteSkill={() => void handleDeleteSkill(selectedSkill.metadata.id)}
            onDeleteVersion={(version) => void handleDeleteVersion(selectedSkill.metadata.id, version)}
          />
        ) : (
          <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-fg-subtle)]">
            {tab === "library" ? "Skill を選択して詳細を表示" : "候補を承認すると登録済みに移動します。"}
          </div>
        )}
      </div>
    </div>
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
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-fg)]"
          : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-center text-[11px] text-[var(--color-fg-subtle)]">
      {message}
    </div>
  );
}

function SkillDetail({
  skill,
  versions,
  onDeleteSkill,
  onDeleteVersion,
}: {
  skill: SkillDocument;
  versions: SkillDocument[];
  onDeleteSkill: () => void;
  onDeleteVersion: (version: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{skill.metadata.name}</CardTitle>
            <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
              id: {skill.metadata.id} · source: {skill.source}
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={onDeleteSkill}>
            <Trash2 className="h-3.5 w-3.5" /> Skill を削除
          </Button>
        </CardHeader>
        <CardBody className="space-y-2 text-xs">
          {skill.metadata.description && <div>{skill.metadata.description}</div>}
          <div className="flex flex-wrap gap-1.5">
            {skill.metadata.providers.map((p) => (
              <span key={p} className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-[1px] text-[var(--color-fg-muted)]">
                provider: {p}
              </span>
            ))}
            {skill.metadata.roles.map((r) => (
              <span key={r} className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-[1px] text-emerald-300">
                role: {r}
              </span>
            ))}
            {skill.metadata.tags.map((t) => (
              <span key={t} className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] px-1.5 py-[1px] text-[var(--color-fg-subtle)]">
                #{t}
              </span>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>バージョン</CardTitle>
        </CardHeader>
        <CardBody className="space-y-1 text-xs">
          {versions.map((v) => (
            <div key={v.metadata.version} className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1">
              <span className="tabular-nums">v{v.metadata.version}</span>
              <Button size="sm" variant="ghost" onClick={() => onDeleteVersion(v.metadata.version)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SKILL.md 本文</CardTitle>
        </CardHeader>
        <CardBody>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 font-mono text-[11px] leading-relaxed text-[var(--color-fg)]">
            {skill.markdown}
          </pre>
        </CardBody>
      </Card>
    </div>
  );
}
