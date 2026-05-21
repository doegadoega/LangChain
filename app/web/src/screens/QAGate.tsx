// STRAND — QA Gate (artboard 04). 3-person QA judgment lanes, real verdicts.
import { useMemo, useState } from "react";
import { useApp } from "../state/store";
import { StrandShell } from "../components/strand/Chrome";
import { Avatar, Btn, Dot, Icon, Pill, RoleBadge, type IconName, type Tone } from "../components/strand/primitives";
import type { QAJudgement } from "../types";

type Verdict = QAJudgement | "PENDING";

const VERDICT_TONE: Record<Verdict, Tone> = {
  PASS: "ok",
  REWORK: "warn",
  ESCALATE: "danger",
  PENDING: "info",
};

export function QAGate() {
  const agents = useApp((s) => s.request.agents);
  const turns = useApp((s) => s.run.turns);
  const verdicts = useApp((s) => s.qaVerdicts);
  const setQaVerdict = useApp((s) => s.setQaVerdict);
  const managedRequests = useApp((s) => s.managedRequests);
  const selectedManagedRequestId = useApp((s) => s.selectedManagedRequestId);
  const selectedRequest = managedRequests.find((item) => item.id === selectedManagedRequestId);

  const qaList = useMemo(
    () => agents.filter((a) => a.org_role === "qa" && a.enabled !== false),
    [agents],
  );

  const passCount = qaList.filter((q) => verdicts.find((v) => v.qaId === q.id)?.judgement === "PASS").length;
  const pendingCount = qaList.filter((q) => !verdicts.find((v) => v.qaId === q.id)).length;
  const reworkCount = qaList.filter((q) => verdicts.find((v) => v.qaId === q.id)?.judgement === "REWORK").length;
  const escalateCount = qaList.filter((q) => verdicts.find((v) => v.qaId === q.id)?.judgement === "ESCALATE").length;

  const overall: Verdict = useMemo(() => {
    if (qaList.length < 3 || pendingCount > 0) return "PENDING";
    if (escalateCount > 0) return "ESCALATE";
    if (reworkCount > 0) return "REWORK";
    return "PASS";
  }, [qaList.length, pendingCount, escalateCount, reworkCount]);

  const title = selectedRequest?.title ?? "未選択のワーク";

  return (
    <StrandShell
      breadcrumb={["workspace", "qa-gate", selectedRequest?.id?.slice(0, 18) ?? "—"]}
      mainStyle={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
          {/* Header */}
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Pill tone={VERDICT_TONE[overall]}>
                <Dot tone={VERDICT_TONE[overall]} size={5} /> {overall === "PENDING" ? "AWAITING DECISION" : overall}
              </Pill>
              <Pill tone="agent">
                {qaList.length} QA · {passCount} PASS · {pendingCount} PENDING
              </Pill>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {selectedRequest?.id ?? "no request selected"}
              </span>
            </div>
            <h1
              className="serif"
              style={{ fontSize: 28, fontStyle: "italic", letterSpacing: "-0.02em", marginTop: 10 }}
            >
              {title}
            </h1>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 18, fontSize: 12, color: "var(--ink-2)", flexWrap: "wrap" }}>
              <span className="mono">2 / 3 PASS で次工程へ · 全 PASS でマージ可</span>
              <span style={{ flex: 1 }} />
              <Btn variant="outline" icon="branch" size="sm">View diff</Btn>
              <Btn variant="outline" icon="eye" size="sm">Replay turns</Btn>
              <Btn variant="solid" tone="accent" icon="check" size="md">Commit verdict</Btn>
            </div>
          </div>

          {/* Aggregate strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
              borderBottom: "1px solid var(--border)",
              background: "var(--paper-2)",
            }}
          >
            <VerdictCell label="GATE STATUS" value={`${passCount} PASS · ${pendingCount} PENDING`} tone={pendingCount ? "warn" : "ok"} icon="check" />
            <VerdictCell label="ESCALATIONS" value={`${escalateCount}`} tone={escalateCount ? "danger" : "ok"} icon="issue" />
            <VerdictCell label="REWORK ITEMS" value={`${reworkCount}`} tone={reworkCount ? "warn" : "ok"} icon="x" />
            <VerdictCell label="NEXT STAGE" value={overall === "PASS" ? "Act → CEO sign-off" : "Awaiting QA"} tone="info" icon="arrow" />
          </div>

          {/* QA lanes */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: qaList.length ? `repeat(${Math.max(qaList.length, 1)}, 1fr)` : "1fr", minHeight: 0 }}>
            {qaList.length === 0 ? (
              <div style={{ display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 13 }}>
                QA エージェントが有効になっていません (最低 3 名推奨)。Team Composer で追加してください。
              </div>
            ) : (
              qaList.map((q) => {
                const verdict = verdicts.find((v) => v.qaId === q.id);
                const myTurn = [...turns].reverse().find((t) => t.agent_id === q.id);
                return (
                  <QALane
                    key={q.id}
                    name={q.name}
                    model={q.model ? `${q.provider} · ${q.model}` : q.provider}
                    output={myTurn?.output}
                    verdict={(verdict?.judgement as Verdict) ?? "PENDING"}
                    reason={verdict?.reason ?? ""}
                    onSubmit={(j, reason) => setQaVerdict({ qaId: q.id, judgement: j, reason })}
                  />
                );
              })
            )}
          </div>

          {/* Escalation bar */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              background: "var(--paper-2)",
              padding: "10px 18px",
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.12em" }}>UNCLEAR-SPEC ISSUES</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                {escalateCount} open
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="outline" icon="plus" size="md">Open issue</Btn>
              <Btn variant="solid" tone="accent" icon="arrow" size="md">Escalate to CEO</Btn>
            </div>
          </div>
    </StrandShell>
  );
}

function VerdictCell({ label, value, tone, icon }: { label: string; value: string; tone: Tone; icon: IconName }) {
  return (
    <div style={{ padding: "12px 18px", borderRight: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 28, height: 28, display: "grid", placeItems: "center", background: `var(--${tone}-bg)`, color: `var(--${tone})`, borderRadius: 3 }}>
        <Icon name={icon} size={14} />
      </span>
      <div>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{label}</div>
        <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function QALane({
  name,
  model,
  output,
  verdict,
  reason: initialReason,
  onSubmit,
}: {
  name: string;
  model: string;
  output?: string;
  verdict: Verdict;
  reason: string;
  onSubmit: (j: QAJudgement, reason: string) => void;
}) {
  const [reason, setReason] = useState(initialReason);
  const [draft, setDraft] = useState<QAJudgement>(verdict === "PENDING" ? "PASS" : verdict);
  const tone = VERDICT_TONE[verdict];

  return (
    <div style={{ borderRight: "1px solid var(--border)", background: "var(--paper)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header
        style={{
          padding: "14px 16px",
          borderBottom: `2px solid var(--${tone})`,
          background: `color-mix(in oklab, var(--${tone}-bg) 35%, var(--surface))`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar ai size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{model}</div>
          </div>
          <RoleBadge role="QA" />
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <VerdictStamp verdict={verdict} />
        </div>
      </header>

      {/* Rationale = latest turn output */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>レビュー対象 (直近出力)</div>
        <div
          className="mono"
          style={{
            maxHeight: 160,
            overflow: "auto",
            background: "var(--surface-sunk)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "8px 10px",
            fontSize: 11,
            lineHeight: 1.55,
            color: "var(--ink-2)",
            whiteSpace: "pre-wrap",
          }}
        >
          {output ?? "(未実行)"}
        </div>
      </div>

      {/* Reason */}
      <div style={{ padding: "12px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em", marginBottom: 6 }}>理由 / 差し戻し点</div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="必要に応じて記載"
          style={{
            flex: 1,
            minHeight: 72,
            resize: "none",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: "8px 10px",
            fontSize: 12,
            color: "var(--ink)",
            fontFamily: "var(--strand-font-sans)",
            outline: "none",
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--paper-2)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["PASS", "REWORK", "ESCALATE"] as QAJudgement[]).map((j) => {
            const jt = VERDICT_TONE[j];
            const active = draft === j;
            return (
              <button
                key={j}
                onClick={() => setDraft(j)}
                className="mono"
                style={{
                  flex: 1,
                  height: 26,
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  border: `1px solid ${active ? `var(--${jt})` : "var(--border)"}`,
                  background: active ? `var(--${jt})` : "var(--surface)",
                  color: active ? "white" : "var(--ink-2)",
                }}
              >
                {j}
              </button>
            );
          })}
        </div>
        <Btn variant="solid" tone="accent" size="sm" icon="check" style={{ justifyContent: "center" }} onClick={() => onSubmit(draft, reason)}>
          判定を提出
        </Btn>
      </div>
    </div>
  );
}

function VerdictStamp({ verdict }: { verdict: Verdict }) {
  const tone = VERDICT_TONE[verdict];
  const running = verdict === "PENDING";
  return (
    <div
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        background: `var(--${tone}-bg)`,
        border: `1px solid var(--${tone})`,
        borderRadius: 3,
        color: `var(--${tone})`,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.06em",
      }}
    >
      {running && <span style={{ width: 8, height: 8, borderRadius: 99, background: `var(--${tone})`, animation: "pulse 1.6s ease-out infinite" }} />}
      {verdict}
    </div>
  );
}
