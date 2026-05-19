import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastKind = "info" | "success" | "warn" | "error";

export interface ToastInput {
  kind?: ToastKind;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastRecord extends Required<Pick<ToastInput, "title">> {
  id: string;
  kind: ToastKind;
  description?: string;
  durationMs: number;
  createdAt: number;
}

interface ToastContextValue {
  notify: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, ReactNode> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warn: <AlertTriangle className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
};

const TONE_CLASS: Record<ToastKind, string> = {
  info: "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg)]",
  success:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  error: "border-red-500/40 bg-red-500/10 text-red-100",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeouts = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const tid = timeouts.current.get(id);
    if (tid !== undefined) {
      window.clearTimeout(tid);
      timeouts.current.delete(id);
    }
    setToasts((items) => items.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (input: ToastInput) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const record: ToastRecord = {
        id,
        kind: input.kind ?? "info",
        title: input.title,
        description: input.description,
        durationMs: input.durationMs ?? (input.kind === "error" ? 8000 : 4000),
        createdAt: Date.now(),
      };
      setToasts((items) => [...items, record]);
      const tid = window.setTimeout(() => dismiss(id), record.durationMs);
      timeouts.current.set(id, tid);
      return id;
    },
    [dismiss],
  );

  useEffect(() => () => {
    timeouts.current.forEach((tid) => window.clearTimeout(tid));
    timeouts.current.clear();
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="通知"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={clsx(
              "pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 shadow-lg",
              TONE_CLASS[toast.kind],
            )}
            style={{ fontSize: "var(--text-sm)" }}
          >
            <span className="mt-0.5 shrink-0">{ICONS[toast.kind]}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-snug">{toast.title}</div>
              {toast.description && (
                <div
                  className="mt-0.5 break-words text-[var(--color-fg-muted)]"
                  style={{ fontSize: "var(--text-xs)" }}
                >
                  {toast.description}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
