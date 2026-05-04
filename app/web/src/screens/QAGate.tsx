import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Textarea } from "../components/ui/Field";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useApp } from "../state/store";
import type { QAJudgement } from "../types";
import clsx from "clsx";
import { AlertTriangle, Send } from "lucide-react";

export function QAGate() {
  const agents = useApp((s) => s.request.agents);
  const turns = useApp((s) => s.run.turns);
  const verdicts = useApp((s) => s.qaVerdicts);
  const setQaVerdict = useApp((s) => s.setQaVerdict);
  const managedRequests = useApp((s) => s.managedRequests);
  const selectedManagedRequestId = useApp((s) => s.selectedManagedRequestId);
  const selectedRequest = managedRequests.find((item) => item.id === selectedManagedRequestId);
  const feedback = selectedRequest?.verification_feedback ?? [];

  const qaList = useMemo(
    () => agents.filter((a) => a.org_role === "qa" && a.enabled !== false),
    [agents],
  );

  const overall = useMemo<QAJudgement | "PENDING">(() => {
    if (qaList.length < 3) return "PENDING";
    if (qaList.some((q) => !verdicts.find((v) => v.qaId === q.id))) return "PENDING";
    if (qaList.every((q) => verdicts.find((v) => v.qaId === q.id)?.judgement === "PASS"))
      return "PASS";
    if (qaList.some((q) => verdicts.find((v) => v.qaId === q.id)?.judgement === "ESCALATE"))
      return "ESCALATE";
    return "REWORK";
  }, [qaList, verdicts]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">QA Gate</h2>
          <p className="text-xs text-[var(--color-fg-muted)]">
            QA 3名ルール · 全員 PASS で次工程に進行可能
          </p>
        </div>
        {qaList.length < 3 ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> QA が {qaList.length} 名 (最低3名必要)
          </span>
        ) : (
          <StatusBadge status={overall === "PENDING" ? "RUNNING" : (overall as never)} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {qaList.map((q) => {
          const verdict = verdicts.find((v) => v.qaId === q.id);
          const myTurn = [...turns].reverse().find((t) => t.agent_id === q.id);
          return (
            <QALane
              key={q.id}
              name={q.name}
              output={myTurn?.output}
              verdict={verdict?.judgement}
              reason={verdict?.reason ?? ""}
              onSubmit={(j, reason) => setQaVerdict({ qaId: q.id, judgement: j, reason })}
            />
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>合意判定サマリー</CardTitle>
          {overall !== "PENDING" && <StatusBadge status={overall as never} />}
        </CardHeader>
        <CardBody className="space-y-2">
          {verdicts.length === 0 && (
            <div className="text-xs text-[var(--color-fg-subtle)]">未判定</div>
          )}
          {verdicts.map((v) => (
            <div
              key={v.qaId}
              className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
            >
              <StatusBadge status={v.judgement} />
              <div className="flex-1 text-xs">
                <div className="font-semibold">{v.qaId}</div>
                <div className="text-[var(--color-fg-muted)] whitespace-pre-wrap">
                  {v.reason || "(理由未記載)"}
                </div>
              </div>
            </div>
          ))}
          {overall === "ESCALATE" && (
            <Button variant="danger" className="mt-2">
              <Send className="h-3.5 w-3.5" /> CEO へエスカレーション
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>保存済みフィードバック</CardTitle>
          <span className="text-xs text-[var(--color-fg-muted)]">{feedback.length}件</span>
        </CardHeader>
        <CardBody className="space-y-2">
          {feedback.length === 0 && (
            <div className="text-xs text-[var(--color-fg-subtle)]">
              Workspaceで保存したフィードバックはありません。
            </div>
          )}
          {feedback.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold text-[var(--color-fg-muted)]">
                  {item.kind}
                </span>
                <span className="text-[10px] text-[var(--color-fg-subtle)]">
                  {new Date(item.created_at).toLocaleString("ja-JP")}
                </span>
              </div>
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-fg-muted)]">
                {item.comment}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function QALane({
  name,
  output,
  verdict,
  reason: initialReason,
  onSubmit,
}: {
  name: string;
  output?: string;
  verdict?: QAJudgement;
  reason: string;
  onSubmit: (j: QAJudgement, reason: string) => void;
}) {
  const [reason, setReason] = useState(initialReason);
  const [draft, setDraft] = useState<QAJudgement>(verdict ?? "PASS");
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        {verdict ? <StatusBadge status={verdict} /> : <StatusBadge status="IDLE" />}
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
            レビュー対象
          </div>
          <div className="max-h-40 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono text-[11px] text-[var(--color-fg-muted)]">
            {output ?? "(未実行)"}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)]">
            理由 / 差し戻し点
          </div>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="必要に応じて記載"
          />
        </div>
        <div className="flex items-center gap-1">
          {(["PASS", "REWORK", "ESCALATE"] as QAJudgement[]).map((j) => (
            <button
              key={j}
              onClick={() => setDraft(j)}
              className={clsx(
                "flex-1 rounded-md border py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                draft === j
                  ? j === "PASS"
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                    : j === "REWORK"
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                    : "border-red-500/60 bg-red-500/15 text-red-300"
                  : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]",
              )}
            >
              {j}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => onSubmit(draft, reason)}>
          判定を提出
        </Button>
      </CardBody>
    </Card>
  );
}
