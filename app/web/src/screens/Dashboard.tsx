import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useApp } from "../state/store";
import { ROLE_LABEL, formatDuration, formatTime } from "../lib/format";
import {
  AlertCircle,
  CheckCircle2,
  Hourglass,
  Workflow,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

export function Dashboard() {
  const run = useApp((s) => s.run);
  const agents = useApp((s) => s.request.agents);
  const enabled = agents.filter((a) => a.enabled !== false);

  const passCount = run.turns.filter((t) => !t.error).length;
  const failCount = run.turns.filter((t) => t.error).length;
  const passRate =
    run.turns.length === 0 ? 0 : Math.round((passCount / run.turns.length) * 100);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-xs text-[var(--color-fg-muted)]">
          全体状況の即時把握 · CEO/Manager 用ビュー
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Active Run"
          value={run.status === "running" ? "1" : "0"}
          icon={<Workflow className="h-4 w-4" />}
          tone="running"
        />
        <Kpi
          label="PASS率"
          value={`${passRate}%`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="pass"
        />
        <Kpi
          label="Rework"
          value={String(failCount)}
          icon={<Hourglass className="h-4 w-4" />}
          tone="rework"
        />
        <Kpi
          label="Escalation"
          value={run.status === "failed" ? "1" : "0"}
          icon={<AlertCircle className="h-4 w-4" />}
          tone="escalate"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>実行タイムライン</CardTitle>
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-fg-subtle)]">
              <TrendingUp className="h-3 w-3" />
              {formatDuration(run.startedAt, run.endedAt)}
            </span>
          </CardHeader>
          <CardBody className="space-y-1.5">
            {run.events.length === 0 && (
              <div className="text-xs text-[var(--color-fg-subtle)]">イベントなし</div>
            )}
            {run.events.slice(-12).map((ev, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]"
              >
                <span className="text-[var(--color-fg-subtle)] tabular-nums">
                  {formatTime(Date.now())}
                </span>
                <span className="font-mono">{ev.type}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>意思決定キュー</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {enabled.filter((a) => a.model_decision === "ceo_decides").length === 0 && (
              <div className="text-xs text-[var(--color-fg-subtle)]">
                CEO 決定対象なし
              </div>
            )}
            {enabled
              .filter((a) => a.model_decision === "ceo_decides")
              .map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-[10px] text-[var(--color-fg-subtle)]">
                      {ROLE_LABEL[a.org_role]} · model={a.model || "未決定"}
                    </div>
                  </div>
                  <StatusBadge status={a.model ? "PASS" : "RUNNING"} />
                </div>
              ))}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>アラート</CardTitle>
          </CardHeader>
          <CardBody>
            {run.error ? (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                {run.error}
              </div>
            ) : (
              <div className="text-xs text-[var(--color-fg-subtle)]">エラーなし</div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "pass" | "rework" | "escalate" | "running";
}) {
  const toneCls =
    tone === "pass"
      ? "text-[var(--color-status-pass)] border-[var(--color-status-pass)]/30 bg-[color-mix(in_srgb,var(--color-status-pass)_8%,transparent)]"
      : tone === "rework"
      ? "text-[var(--color-status-rework)] border-[var(--color-status-rework)]/30 bg-[color-mix(in_srgb,var(--color-status-rework)_8%,transparent)]"
      : tone === "escalate"
      ? "text-[var(--color-status-escalate)] border-[var(--color-status-escalate)]/30 bg-[color-mix(in_srgb,var(--color-status-escalate)_8%,transparent)]"
      : "text-[var(--color-status-running)] border-[var(--color-status-running)]/30 bg-[color-mix(in_srgb,var(--color-status-running)_8%,transparent)]";
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-widest opacity-80">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
