import type { RefineRequest, StreamEvent } from "../types";

export async function* streamRefine(
  request: RefineRequest,
  signal?: AbortSignal,
  options?: { force?: boolean },
): AsyncGenerator<StreamEvent, void, unknown> {
  const qs = options?.force ? "?force=true" : "";
  const res = await fetch(`/api/refine/stream${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`stream error ${res.status}: ${text}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sequence = 0;
  const withTimelineMeta = (event: StreamEvent): StreamEvent => ({
    ...event,
    received_at: new Date().toISOString(),
    sequence: sequence++,
  });
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        yield withTimelineMeta(JSON.parse(line) as StreamEvent);
      } catch {
        // ignore malformed
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      yield withTimelineMeta(JSON.parse(tail) as StreamEvent);
    } catch {
      // ignore
    }
  }
}
