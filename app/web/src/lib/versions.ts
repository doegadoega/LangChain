// Shared version-history helpers for refinement screens.
// buildBaseVersion produces the WorkspaceVersion fields common to writing and
// coding runs; each screen spreads it and adds its own extras
// (Workspace: parent_version_id / review_feedback / flow_json,
//  Coding: version_control). Behavior is identical to the original per-screen
// builders — only the shared field mapping is centralized here.
import type { RefineRequest, StreamEvent, TurnResult, WorkspaceVersion } from "../types";

export interface VersionRunSnapshot {
  finalText?: string;
  diff?: string;
  fileChanges?: string;
  error?: string;
  turns: TurnResult[];
  events: StreamEvent[];
  startedAt?: number;
  endedAt?: number;
}

export interface BaseVersionInput {
  id: string;
  versionNo: number;
  title: string;
  createdAt: string;
  /** Already-cloned request snapshot — caller owns cloning. */
  request: RefineRequest;
  run: VersionRunSnapshot;
}

export function buildBaseVersion({
  id,
  versionNo,
  title,
  createdAt,
  request,
  run,
}: BaseVersionInput): WorkspaceVersion {
  return {
    id,
    version_no: versionNo,
    title,
    created_at: createdAt,
    request,
    final_text: run.finalText,
    diff: run.diff,
    file_changes: run.fileChanges,
    error: run.error,
    agent_turns: run.turns.length > 0 ? run.turns : undefined,
    stream_events: run.events.length > 0 ? run.events : undefined,
    run_started_at: run.startedAt ? new Date(run.startedAt).toISOString() : undefined,
    run_ended_at: run.endedAt ? new Date(run.endedAt).toISOString() : undefined,
  };
}

// Skip appending a new version when the latest one captures the same run.
// Coding additionally compares file_changes (worktree diffs); writing does not.
export const isDuplicateVersion = (
  latest: WorkspaceVersion | undefined,
  next: WorkspaceVersion,
  compareFileChanges = false,
) =>
  Boolean(
    latest &&
      latest.run_started_at === next.run_started_at &&
      latest.run_ended_at === next.run_ended_at &&
      latest.final_text === next.final_text &&
      latest.diff === next.diff &&
      (!compareFileChanges || latest.file_changes === next.file_changes),
  );
