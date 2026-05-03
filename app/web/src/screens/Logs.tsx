import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { useApp } from "../state/store";
import { ROLE_LABEL, formatTime } from "../lib/format";
import { Download, Search } from "lucide-react";

export function Logs() {
  const turns = useApp((s) => s.run.turns);
  const events = useApp((s) => s.run.events);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const rows = useMemo(
    () =>
      turns.map((t, i) => ({
        idx: i,
        role: ROLE_LABEL[t.org_role],
        agent: t.agent_name,
        provider: t.provider,
        status: t.error ? "ESCALATE" : "PASS",
        output: t.output,
        error: t.error,
      })),
    [turns],
  );

  const filtered = rows.filter(
    (r) =>
      !query ||
      r.agent.toLowerCase().includes(query.toLowerCase()) ||
      r.role.toLowerCase().includes(query.toLowerCase()),
  );

  const exportRun = () => {
    const data = { events, turns };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_400px] overflow-hidden">
      <div className="flex flex-col overflow-hidden p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Logs & Artifacts</h2>
          <span className="text-xs text-[var(--color-fg-muted)]">
            監査性と再現性 · {turns.length} entries
          </span>
          <div className="flex-1" />
          <div className="relative w-72">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-muted)]" />
            <Input
              placeholder="フィルタ"
              className="pl-7"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportRun}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>

        <Card className="flex-1 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--color-surface)] text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
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
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-[var(--color-fg-subtle)]"
                    >
                      ログなし
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr
                    key={r.idx}
                    onClick={() => setSelected(r.idx)}
                    className={
                      "cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]" +
                      (selected === r.idx ? " bg-[var(--color-surface-3)]" : "")
                    }
                  >
                    <td className="px-3 py-2 tabular-nums text-[var(--color-fg-subtle)]">
                      {r.idx}
                    </td>
                    <td className="px-3 py-2">{r.role}</td>
                    <td className="px-3 py-2 font-medium">{r.agent}</td>
                    <td className="px-3 py-2 text-[var(--color-fg-muted)]">{r.provider}</td>
                    <td
                      className={
                        "px-3 py-2 font-semibold " +
                        (r.status === "PASS"
                          ? "text-[var(--color-status-pass)]"
                          : "text-[var(--color-status-escalate)]")
                      }
                    >
                      {r.status}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-fg-muted)] tabular-nums">
                      {formatTime(Date.now())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="m-4 ml-0 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>プレビュー</CardTitle>
        </CardHeader>
        <CardBody className="flex-1 overflow-auto">
          {selected === null ? (
            <div className="grid h-full place-items-center text-xs text-[var(--color-fg-subtle)]">
              ログを選択
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
              {turns[selected]?.output ?? ""}
              {turns[selected]?.error ? `\n\nERROR: ${turns[selected]?.error}` : ""}
            </pre>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
