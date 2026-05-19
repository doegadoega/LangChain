import { useState } from "react";
import { AlertTriangle, Terminal, X } from "lucide-react";
import { useApp } from "../state/store";
import { Button } from "./ui/Button";
import { PROVIDER_LABEL } from "../lib/format";

export function PrecheckBlockedDialog() {
  const pendingPrecheck = useApp((s) => s.pendingPrecheck);
  const clearPendingPrecheck = useApp((s) => s.clearPendingPrecheck);
  const startRun = useApp((s) => s.startRun);
  const [busy, setBusy] = useState(false);

  if (!pendingPrecheck || pendingPrecheck.length === 0) return null;

  const handleRetry = async () => {
    setBusy(true);
    try {
      await startRun();
    } finally {
      setBusy(false);
    }
  };

  const handleForce = async () => {
    setBusy(true);
    try {
      await startRun({ force: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="precheck-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-2xl rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--color-status-rework)]" />
            <h2 id="precheck-dialog-title" className="text-sm font-semibold text-[var(--color-fg)]">
              起動していない provider があります
            </h2>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => clearPendingPrecheck()}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto px-4 py-3">
          <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
            実行に必要な provider のうち、以下が起動していません。下記コマンドで起動するか、
            「警告を無視して実行」を選択してください。
          </p>
          <ul className="space-y-2">
            {pendingPrecheck.map((row) => (
              <li
                key={row.provider}
                className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--color-fg)]">
                    {PROVIDER_LABEL[row.provider] ?? row.provider}
                  </span>
                  <span className="text-[11px] text-amber-200">{row.detail}</span>
                </div>
                {row.endpoint && (
                  <div className="mb-1 text-[10px] text-[var(--color-fg-subtle)]">
                    endpoint: {row.endpoint}
                  </div>
                )}
                {row.start_command && (
                  <div className="flex items-start gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 font-mono text-[11px] text-[var(--color-fg)]">
                    <Terminal className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-fg-muted)]" />
                    <code className="break-all">{row.start_command}</code>
                    <button
                      type="button"
                      className="ml-auto text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                      onClick={() => {
                        if (row.start_command) void navigator.clipboard.writeText(row.start_command);
                      }}
                    >
                      copy
                    </button>
                  </div>
                )}
                {row.docs_url && (
                  <a
                    href={row.docs_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-[10px] text-[var(--color-accent)] hover:underline"
                  >
                    {row.docs_url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <Button variant="ghost" onClick={() => clearPendingPrecheck()} disabled={busy}>
            キャンセル
          </Button>
          <Button variant="outline" onClick={() => void handleForce()} disabled={busy}>
            警告を無視して実行
          </Button>
          <Button onClick={() => void handleRetry()} disabled={busy}>
            {busy ? "再チェック中..." : "再チェックして実行"}
          </Button>
        </div>
      </div>
    </div>
  );
}
