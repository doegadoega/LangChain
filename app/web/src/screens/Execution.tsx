import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Label, Select, Textarea } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { StatusBadge, type Status } from "../components/ui/StatusBadge";
import { useApp } from "../state/store";
import { PROVIDER_LABEL, ROLE_LABEL, formatDuration, formatTime } from "../lib/format";
import { Activity, FileDiff, Hash, RefreshCcw, Terminal } from "lucide-react";
import clsx from "clsx";

export function Execution() {
  const request = useApp((s) => s.request);
  const updateRequest = useApp((s) => s.updateRequest);
  const run = useApp((s) => s.run);
  const startRun = useApp((s) => s.startRun);
  const stopRun = useApp((s) => s.stopRun);
  const resetRun = useApp((s) => s.resetRun);

  const [activeTurn, setActiveTurn] = useState<string | null>(null);

  const enabledAgents = useMemo(
    () => request.agents.filter((a) => a.enabled !== false),
    [request.agents],
  );

  const turnStatusFor = (agentId: string): Status => {
    const last = [...run.turns].reverse().find((t) => t.agent_id === agentId);
    if (!last) return "IDLE";
    if (last.error) return "ESCALATE";
    return "PASS";
  };

  return (
    <div className="grid h-full grid-cols-[360px_minmax(0,1fr)_minmax(0,1fr)] gap-4 overflow-hidden p-4">
      {/* Run config */}
      <Card className="flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Run Settings</CardTitle>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
            {enabledAgents.length} agents
          </span>
        </CardHeader>
        <CardBody className="flex-1 space-y-3 overflow-y-auto">
          <div>
            <Label>workflow_mode</Label>
            <Select
              value={request.workflow_mode}
              onChange={(e) => updateRequest({ workflow_mode: e.target.value as never })}
            >
              <option value="writing">writing</option>
              <option value="coding">coding</option>
            </Select>
          </div>
          <div>
            <Label>orchestration_mode</Label>
            <Select
              value={request.orchestration_mode}
              onChange={(e) => updateRequest({ orchestration_mode: e.target.value as never })}
            >
              <option value="sequential">sequential</option>
              <option value="role_based">role_based</option>
              <option value="dependency_graph">dependency_graph</option>
            </Select>
          </div>
          <div>
            <Label>rounds (1-5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={request.rounds}
              onChange={(e) => updateRequest({ rounds: Math.max(1, Math.min(5, +e.target.value)) })}
            />
          </div>
          {request.workflow_mode === "coding" && (
            <div>
              <Label>working_directory</Label>
              <Input
                placeholder="/path/to/repo"
                value={request.code_context.working_directory}
                onChange={(e) =>
                  updateRequest({
                    code_context: { ...request.code_context, working_directory: e.target.value },
                  })
                }
              />
            </div>
          )}
          <div>
            <Label>objective</Label>
            <Input
              placeholder="目的"
              value={request.objective}
              onChange={(e) => updateRequest({ objective: e.target.value })}
            />
          </div>
          <div>
            <Label>global_instruction</Label>
            <Textarea
              placeholder="全体ルール"
              value={request.global_instruction}
              onChange={(e) => updateRequest({ global_instruction: e.target.value })}
            />
          </div>
          <div>
            <Label>source_text · 要件</Label>
            <Textarea
              rows={6}
              placeholder="推敲対象のテキスト / 要件"
              value={request.source_text}
              onChange={(e) => updateRequest({ source_text: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            {run.status === "running" ? (
              <Button variant="danger" onClick={stopRun} className="flex-1">
                停止
              </Button>
            ) : (
              <Button variant="primary" onClick={() => startRun()} className="flex-1">
                ▶ 実行開始
              </Button>
            )}
            <Button variant="outline" onClick={resetRun} title="リセット">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Stream log */}
      <Card className="flex flex-col overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-fg-muted)]" />
            <CardTitle>Stream Events</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-fg-subtle)]">
            <span>round {run.currentRound}/{request.rounds}</span>
            <span>·</span>
            <span>{formatDuration(run.startedAt, run.endedAt)}</span>
          </div>
        </CardHeader>
        <CardBody className="flex-1 space-y-1 overflow-y-auto font-mono text-xs">
          {run.events.length === 0 && (
            <div className="grid h-full place-items-center text-[var(--color-fg-subtle)]">
              実行待機中
            </div>
          )}
          {run.events.map((ev, i) => (
            <EventRow key={i} ev={ev} onSelectTurn={setActiveTurn} />
          ))}
          {run.error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-red-300">
              {run.error}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Right: turns & diff */}
      <div className="flex flex-col gap-4 overflow-hidden">
        <Card className="flex min-h-[40%] flex-col overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[var(--color-fg-muted)]" />
              <CardTitle>Agent Outputs</CardTitle>
            </div>
            <span className="text-[10px] text-[var(--color-fg-subtle)]">
              {run.turns.length} turns
            </span>
          </CardHeader>
          <CardBody className="flex-1 overflow-y-auto">
            {enabledAgents.length === 0 && (
              <div className="text-xs text-[var(--color-fg-subtle)]">エージェント未配置</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {enabledAgents.map((a) => {
                const status = turnStatusFor(a.id);
                const last = [...run.turns].reverse().find((t) => t.agent_id === a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => setActiveTurn(a.id)}
                    className={clsx(
                      "rounded-lg border p-2 text-left transition-colors",
                      activeTurn === a.id
                        ? "border-[var(--color-accent)]/60 bg-[var(--color-surface-3)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold truncate">{a.name}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
                      {ROLE_LABEL[a.org_role]} · {PROVIDER_LABEL[a.provider]}
                    </div>
                    {last?.output && (
                      <div className="mt-2 line-clamp-2 text-[11px] text-[var(--color-fg-muted)]">
                        {last.output.slice(0, 120)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileDiff className="h-4 w-4 text-[var(--color-fg-muted)]" />
              <CardTitle>{activeTurn ? "Turn Output" : "Diff Viewer"}</CardTitle>
            </div>
            {run.finalText && !activeTurn && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-fg-subtle)]">
                <Hash className="h-3 w-3" />
                final {run.finalText.length}c
              </span>
            )}
          </CardHeader>
          <CardBody className="flex-1 overflow-auto">
            {activeTurn ? (
              <TurnView agentId={activeTurn} />
            ) : run.diff ? (
              <DiffView text={run.diff} />
            ) : (
              <div className="grid h-full place-items-center text-xs text-[var(--color-fg-subtle)]">
                差分・最終稿はここに表示
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function TurnView({ agentId }: { agentId: string }) {
  const turns = useApp((s) => s.run.turns.filter((t) => t.agent_id === agentId));
  if (turns.length === 0)
    return <div className="text-xs text-[var(--color-fg-subtle)]">出力なし</div>;
  const last = turns[turns.length - 1];
  return (
    <div className="space-y-3">
      {last.error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
          {last.error}
        </div>
      )}
      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--color-fg)]">
        {last.output || "(空)"}
      </pre>
      {last.file_changes && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
            file changes
          </div>
          <DiffView text={last.file_changes} />
        </div>
      )}
    </div>
  );
}

function DiffView({ text }: { text: string }) {
  return (
    <div className="overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
      {text.split("\n").map((line, i) => {
        const cls = line.startsWith("+")
          ? "text-emerald-300 bg-emerald-500/5"
          : line.startsWith("-")
          ? "text-red-300 bg-red-500/5"
          : line.startsWith("@@")
          ? "text-violet-300"
          : "text-[var(--color-fg-muted)]";
        return (
          <div key={i} className={clsx("font-mono px-3 py-0.5 text-[11px] whitespace-pre", cls)}>
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}

function EventRow({
  ev,
  onSelectTurn,
}: {
  ev: ReturnType<typeof useApp.getState>["run"]["events"][number];
  onSelectTurn: (id: string) => void;
}) {
  const time = formatTime(Date.now());
  let label = "";
  let tone = "text-[var(--color-fg-muted)]";
  switch (ev.type) {
    case "run_started":
      label = "run_started";
      tone = "text-[var(--color-status-running)]";
      break;
    case "round_started":
      label = `round_started · ${ev.round_index}`;
      tone = "text-[var(--color-status-running)]";
      break;
    case "turn_started":
      label = `turn_started · ${ev.agent_name} (${ROLE_LABEL[ev.org_role]})`;
      tone = "text-cyan-300";
      break;
    case "turn_completed":
      label = `turn_completed · ${ev.turn.agent_name}${ev.turn.error ? " · ERROR" : ""}`;
      tone = ev.turn.error ? "text-[var(--color-status-escalate)]" : "text-emerald-300";
      break;
    case "round_completed":
      label = `round_completed · ${ev.round_index}`;
      tone = "text-violet-300";
      break;
    case "run_completed":
      label = "run_completed";
      tone = "text-[var(--color-status-pass)]";
      break;
    case "run_failed":
      label = `run_failed · ${ev.error}`;
      tone = "text-[var(--color-status-escalate)]";
      break;
  }
  const clickable = ev.type === "turn_completed";
  return (
    <button
      disabled={!clickable}
      onClick={() => clickable && onSelectTurn((ev as { turn: { agent_id: string } }).turn.agent_id)}
      className={clsx(
        "flex w-full items-start gap-2 rounded px-2 py-1 text-left",
        clickable && "hover:bg-[var(--color-surface-2)]",
      )}
    >
      <span className="text-[var(--color-fg-subtle)]">[{time}]</span>
      <span className={tone}>{label}</span>
    </button>
  );
}
