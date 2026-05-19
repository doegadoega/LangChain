import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Empty } from "../components/ui/Empty";
import { Alert } from "../components/ui/Alert";
import { Skeleton } from "../components/ui/Skeleton";
import { useApp } from "../state/store";
import { PROVIDER_LABEL, ROLE_LABEL, formatTime } from "../lib/format";
import { api } from "../api/client";
import { Bot, Download, RefreshCw, Search, Server, Table as TableIcon } from "lucide-react";
import clsx from "clsx";
import type { AgentLogSummary } from "../types";

type LogsTab = "turns" | "server" | "agents";
type StatusFilter = "all" | "PASS" | "ESCALATE";

const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }));

export function Logs() {
  const turns = useApp((s) => s.run.turns);
  const events = useApp((s) => s.run.events);
  const managedRequests = useApp((s) => s.managedRequests);
  const selectedManagedRequestId = useApp((s) => s.selectedManagedRequestId);
  const selectedRequest = managedRequests.find((item) => item.id === selectedManagedRequestId);
  const feedback = selectedRequest?.verification_feedback ?? [];

  const [tab, setTab] = useState<LogsTab>("turns");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [selected, setSelected] = useState<number | null>(null);

  const rows = useMemo(
    () =>
      turns.map((t, i) => ({
        idx: i,
        role: t.org_role,
        roleLabel: ROLE_LABEL[t.org_role],
        agent: t.agent_name,
        provider: t.provider,
        providerLabel: PROVIDER_LABEL[t.provider] ?? t.provider,
        status: (t.error ? "ESCALATE" : "PASS") as "PASS" | "ESCALATE",
        output: t.output,
        error: t.error,
      })),
    [turns],
  );

  const availableProviders = useMemo(
    () => Array.from(new Set(rows.map((r) => r.provider))),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (providerFilter !== "all" && r.provider !== providerFilter) return false;
      if (!needle) return true;
      return (
        r.agent.toLowerCase().includes(needle) ||
        r.roleLabel.toLowerCase().includes(needle) ||
        r.providerLabel.toLowerCase().includes(needle) ||
        (r.output ?? "").toLowerCase().includes(needle) ||
        (r.error ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, query, statusFilter, roleFilter, providerFilter]);

  const exportRun = () => {
    const data = { events, turns, verification_feedback: feedback };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setRoleFilter("all");
    setProviderFilter("all");
  };

  const hasActiveFilters =
    Boolean(query) || statusFilter !== "all" || roleFilter !== "all" || providerFilter !== "all";

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_400px] overflow-hidden">
      <div className="flex flex-col overflow-hidden p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold" style={{ fontSize: "var(--text-heading)" }}>
            Logs &amp; Artifacts
          </h2>
          <span className="text-[var(--color-fg-muted)]" style={{ fontSize: "var(--text-xs)" }}>
            監査性と再現性 · {turns.length} entries
          </span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={exportRun}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>

        <div role="tablist" className="mb-2 inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
          <TabButton active={tab === "turns"} onClick={() => setTab("turns")} icon={<TableIcon className="h-3.5 w-3.5" />} label="ターンログ" />
          <TabButton active={tab === "agents"} onClick={() => setTab("agents")} icon={<Bot className="h-3.5 w-3.5" />} label="エージェント別" />
          <TabButton active={tab === "server"} onClick={() => setTab("server")} icon={<Server className="h-3.5 w-3.5" />} label="サーバーログ" />
        </div>

        {tab === "turns" ? (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="relative w-72">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-muted)]" />
                <Input
                  placeholder="agent / role / provider / output を検索"
                  className="pl-7"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <FilterChip
                label="status"
                value={statusFilter}
                options={[
                  { value: "all", label: "全て" },
                  { value: "PASS", label: "PASS" },
                  { value: "ESCALATE", label: "ESCALATE" },
                ]}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
              />
              <FilterChip
                label="role"
                value={roleFilter}
                options={[{ value: "all", label: "全て" }, ...ROLE_OPTIONS]}
                onChange={setRoleFilter}
              />
              <FilterChip
                label="provider"
                value={providerFilter}
                options={[
                  { value: "all", label: "全て" },
                  ...availableProviders.map((p) => ({
                    value: p,
                    label: PROVIDER_LABEL[p] ?? p,
                  })),
                ]}
                onChange={setProviderFilter}
              />
              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters}>
                  クリア
                </Button>
              )}
              <div className="ml-auto text-[var(--color-fg-muted)]" style={{ fontSize: "var(--text-xs)" }}>
                {filtered.length} / {rows.length}
              </div>
            </div>

            <Card className="flex-1 overflow-hidden">
              <div className="overflow-auto">
                <table className="w-full" style={{ fontSize: "var(--text-sm)" }}>
                  <thead
                    className="sticky top-0 bg-[var(--color-surface)] uppercase tracking-widest text-[var(--color-fg-subtle)]"
                    style={{ fontSize: "var(--text-xs)" }}
                  >
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">role</th>
                      <th className="px-3 py-2 text-left">agent</th>
                      <th className="px-3 py-2 text-left">provider</th>
                      <th className="px-3 py-2 text-left">status</th>
                      <th className="px-3 py-2 text-left">timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6">
                          <Empty
                            dense
                            title={rows.length === 0 ? "ログはまだありません" : "条件に一致するログがありません"}
                            description={rows.length === 0 ? "実行を開始するとここに表示されます。" : "検索キーワードやフィルタを変更してください。"}
                          />
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r) => (
                        <tr
                          key={r.idx}
                          onClick={() => setSelected(r.idx)}
                          className={clsx(
                            "cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]",
                            selected === r.idx && "bg-[var(--color-surface-3)]",
                          )}
                        >
                          <td className="px-3 py-2 tabular-nums text-[var(--color-fg-subtle)]">{r.idx}</td>
                          <td className="px-3 py-2">{r.roleLabel}</td>
                          <td className="px-3 py-2 font-medium">{r.agent}</td>
                          <td className="px-3 py-2 text-[var(--color-fg-muted)]">{r.providerLabel}</td>
                          <td
                            className={clsx(
                              "px-3 py-2 font-semibold",
                              r.status === "PASS"
                                ? "text-[var(--color-status-pass)]"
                                : "text-[var(--color-status-escalate)]",
                            )}
                          >
                            {r.status}
                          </td>
                          <td className="px-3 py-2 text-[var(--color-fg-muted)] tabular-nums">
                            {formatTime(Date.now())}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : tab === "agents" ? (
          <AgentLogsPane />
        ) : (
          <ServerLogsPane />
        )}
      </div>

      <Card className="m-4 ml-0 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>プレビュー</CardTitle>
        </CardHeader>
        <CardBody className="flex-1 space-y-4 overflow-auto">
          <div>
            {selected === null ? (
              <Empty title="ログを選択" description="左の表から行を選択するとここに詳細を表示します。" dense />
            ) : (
              <pre
                className="whitespace-pre-wrap font-mono leading-relaxed"
                style={{ fontSize: "var(--text-code)" }}
              >
                {turns[selected]?.output ?? ""}
                {turns[selected]?.error ? `\n\nERROR: ${turns[selected]?.error}` : ""}
              </pre>
            )}
          </div>
          <div className="border-t border-[var(--color-border)] pt-3">
            <div className="mb-2 font-semibold" style={{ fontSize: "var(--text-sm)" }}>保存済みフィードバック</div>
            {feedback.length === 0 ? (
              <Empty title="フィードバックはありません" dense />
            ) : (
              <div className="space-y-2">
                {feedback.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2"
                    style={{ fontSize: "var(--text-xs)" }}
                  >
                    <div className="mb-1 font-semibold">{item.kind}</div>
                    <div className="whitespace-pre-wrap text-[var(--color-fg-muted)]">{item.comment}</div>
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

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded px-3 py-1 transition-colors",
        active
          ? "bg-[var(--color-surface-3)] text-[var(--color-fg)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
      )}
      style={{ fontSize: "var(--text-sm)" }}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterChip({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-fg-muted)]"
      style={{ fontSize: "var(--text-xs)" }}
    >
      <span className="uppercase tracking-wider text-[var(--color-fg-subtle)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[var(--color-fg)] outline-none"
        style={{ fontSize: "var(--text-xs)" }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[var(--color-surface)]">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AgentLogsPane() {
  const [list, setList] = useState<AgentLogSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [path, setPath] = useState("");
  const [size, setSize] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [query, setQuery] = useState("");

  const loadList = async () => {
    try {
      const res = await api.listAgentLogs();
      setList(res.agents);
      if (!selected && res.agents.length > 0) {
        setSelected(res.agents[0].agent_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const loadContent = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getAgentLog(id);
      setContent(res.content);
      setPath(res.path);
      setSize(res.size);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) void loadContent(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void loadList();
      if (selected) void loadContent(selected);
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selected]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return content;
    return content
      .split("\n")
      .filter((line) => line.toLowerCase().includes(needle))
      .join("\n");
  }, [content, query]);

  return (
    <Card className="flex-1 overflow-hidden">
      <CardBody className="grid h-full grid-cols-[220px_minmax(0,1fr)] gap-2 overflow-hidden p-2">
        <aside className="flex flex-col overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-2 py-1.5">
            <span className="font-semibold" style={{ fontSize: "var(--text-sm)" }}>
              エージェント
            </span>
            <Button size="sm" variant="ghost" onClick={() => void loadList()}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <Empty
                dense
                title="ログがまだありません"
                description="実行を開始するとここに表示されます。"
              />
            ) : (
              <ul>
                {list.map((item) => (
                  <li key={item.agent_id}>
                    <button
                      type="button"
                      onClick={() => setSelected(item.agent_id)}
                      className={clsx(
                        "flex w-full flex-col items-start gap-0.5 border-b border-[var(--color-border)] px-2 py-1.5 text-left transition-colors",
                        selected === item.agent_id
                          ? "bg-[var(--color-surface-3)]"
                          : "hover:bg-[var(--color-surface-3)]/50",
                      )}
                    >
                      <span
                        className="truncate text-[var(--color-fg)]"
                        style={{ fontSize: "var(--text-sm)" }}
                      >
                        {item.agent_id}
                      </span>
                      <span
                        className="tabular-nums text-[var(--color-fg-subtle)]"
                        style={{ fontSize: "var(--text-xs)" }}
                      >
                        {(item.size / 1024).toFixed(1)} KB · {new Date(item.modified_at * 1000).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="flex flex-col gap-2 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-72">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-muted)]" />
              <Input
                placeholder="行を検索"
                className="pl-7"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label
              className="inline-flex items-center gap-1 text-[var(--color-fg-muted)]"
              style={{ fontSize: "var(--text-xs)" }}
            >
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              自動更新 (3s)
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (selected) void loadContent(selected);
              }}
              disabled={loading}
            >
              <RefreshCw className={clsx("h-3 w-3", loading && "animate-spin")} />
              {loading ? "読込中" : "更新"}
            </Button>
            <div
              className="ml-auto tabular-nums text-[var(--color-fg-muted)]"
              style={{ fontSize: "var(--text-xs)" }}
            >
              {path && (
                <span>
                  {path} · {(size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          </div>
          {error && <Alert kind="error" title="ログ取得に失敗">{error}</Alert>}
          {!selected ? (
            <Empty title="左から エージェントを選択" dense />
          ) : loading && !content ? (
            <Skeleton variant="text" lines={10} />
          ) : filtered ? (
            <pre
              className="flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 font-mono text-[var(--color-fg-muted)]"
              style={{ fontSize: "var(--text-code)", lineHeight: "var(--text-code--line-height)" }}
            >
              {filtered}
            </pre>
          ) : (
            <Empty
              title={query ? "条件に一致する行がありません" : "ログはまだありません"}
              dense
            />
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function ServerLogsPane() {
  const [content, setContent] = useState("");
  const [path, setPath] = useState("");
  const [size, setSize] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [query, setQuery] = useState("");
  const [tailKb, setTailKb] = useState(64);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getServerLogs(tailKb * 1024);
      setContent(res.content);
      setPath(res.path);
      setSize(res.size);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailKb]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, tailKb]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return content;
    return content
      .split("\n")
      .filter((line) => line.toLowerCase().includes(needle))
      .join("\n");
  }, [content, query]);

  return (
    <Card className="flex-1 overflow-hidden">
      <CardBody className="flex h-full flex-col gap-2 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-muted)]" />
            <Input
              placeholder="行を検索"
              className="pl-7"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <FilterChip
            label="tail"
            value={String(tailKb)}
            options={[16, 64, 256, 512].map((kb) => ({
              value: String(kb),
              label: `${kb} KB`,
            }))}
            onChange={(v) => setTailKb(Number(v))}
          />
          <label
            className="inline-flex items-center gap-1 text-[var(--color-fg-muted)]"
            style={{ fontSize: "var(--text-xs)" }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            自動更新 (3s)
          </label>
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={clsx("h-3 w-3", loading && "animate-spin")} />
            {loading ? "読込中" : "更新"}
          </Button>
          <div className="ml-auto tabular-nums text-[var(--color-fg-muted)]" style={{ fontSize: "var(--text-xs)" }}>
            {path && (
              <span>
                {path} · {(size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>
        </div>
        {error && <Alert kind="error" title="ログ取得に失敗">{error}</Alert>}
        {loading && !content ? (
          <Skeleton variant="text" lines={10} />
        ) : filtered ? (
          <pre
            className="flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 font-mono text-[var(--color-fg-muted)]"
            style={{ fontSize: "var(--text-code)", lineHeight: "var(--text-code--line-height)" }}
          >
            {filtered}
          </pre>
        ) : (
          <Empty
            title={query ? "条件に一致する行がありません" : "ログはまだありません"}
            description={query ? "検索キーワードを変更してください。" : "サーバーを起動するとここに表示されます。"}
            dense
          />
        )}
      </CardBody>
    </Card>
  );
}
