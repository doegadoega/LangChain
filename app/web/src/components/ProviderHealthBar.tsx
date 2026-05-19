import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, RefreshCw, Terminal } from "lucide-react";
import { api } from "../api/client";
import { Button } from "./ui/Button";
import type { ProviderHealth, ProviderKind } from "../types";
import { PROVIDER_LABEL } from "../lib/format";

interface Props {
  providers: ProviderKind[];
  className?: string;
  compact?: boolean;
}

export function ProviderHealthBar({ providers, className, compact = false }: Props) {
  const uniqueProviders = useMemo(
    () => Array.from(new Set(providers)).sort(),
    [providers],
  );
  const [results, setResults] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (uniqueProviders.length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.getProvidersHealth(uniqueProviders);
      setResults(res.providers);
      setLastCheckedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [uniqueProviders]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dead = results.filter((r) => !r.alive);
  const alive = results.length - dead.length;

  if (uniqueProviders.length === 0) {
    return null;
  }

  return (
    <div
      className={clsx(
        "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-fg)]">
          {dead.length === 0 ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-status-pass)]" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-status-rework)]" />
          )}
          Provider Health
          <span className="text-[10px] font-normal text-[var(--color-fg-muted)]">
            {alive}/{results.length} alive
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={clsx("h-3 w-3", loading && "animate-spin")} />
          {loading ? "確認中" : "再チェック"}
        </Button>
      </div>
      {error && (
        <div className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
          {error}
        </div>
      )}
      {lastCheckedAt && !error && (
        <div className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
          last check: {new Date(lastCheckedAt).toLocaleTimeString()}
        </div>
      )}
      <ul className={clsx("mt-2 space-y-1", compact && "text-[11px]")}>
        {results.map((row) => (
          <HealthRow key={row.provider} row={row} compact={compact} />
        ))}
      </ul>
    </div>
  );
}

function HealthRow({ row, compact }: { row: ProviderHealth; compact: boolean }) {
  const label = PROVIDER_LABEL[row.provider] ?? row.provider;
  return (
    <li
      className={clsx(
        "rounded-md border px-2 py-1.5",
        row.alive
          ? "border-[var(--color-border)] bg-[var(--color-surface-2)]"
          : "border-amber-500/40 bg-amber-500/10",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={clsx(
              "inline-block h-2 w-2 rounded-full",
              row.alive ? "bg-[var(--color-status-pass)]" : "bg-[var(--color-status-escalate)]",
            )}
          />
          <span className={clsx("font-medium", compact ? "text-[11px]" : "text-xs")}>{label}</span>
          {row.endpoint && (
            <span className="text-[10px] text-[var(--color-fg-subtle)]">{row.endpoint}</span>
          )}
        </div>
        <span
          className={clsx(
            "text-[10px]",
            row.alive ? "text-[var(--color-fg-muted)]" : "text-amber-200",
          )}
        >
          {row.detail}
        </span>
      </div>
      {!row.alive && row.start_command && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 font-mono text-[11px] text-[var(--color-fg)]">
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
      {!row.alive && row.docs_url && (
        <div className="mt-1">
          <a
            href={row.docs_url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-[var(--color-accent)] hover:underline"
          >
            {row.docs_url}
          </a>
        </div>
      )}
    </li>
  );
}
